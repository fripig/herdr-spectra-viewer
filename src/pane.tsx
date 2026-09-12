#!/usr/bin/env node
import React, { useEffect, useState } from "react";
import { render, useStdin, useStdout } from "ink";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { scanChanges, specDirExists } from "./discovery/index.js";
import { isEntryPoint } from "./entry-point.js";
import { readInvocationContext } from "./herdr/context.js";
import { readConfiguredViewer } from "./config.js";
import { HELP_HINT, packageVersion, parseCliArgs, USAGE } from "./cli-args.js";
import { createHerdrClient, focusPane, openInEditorSplit, sendTextToPane } from "./herdr/client.js";
import { copyToClipboard } from "./herdr/clipboard.js";
import { resolveProjectRoot } from "./herdr/project-root.js";
import { paneGeometry, type PaneGeometry } from "./herdr/client.js";
import {
  createTerminalControls,
  openInPager,
  spawnViewerProcess,
  terminalHandover,
  type SpawnViewer,
  type TerminalControls,
  type TerminalHandover,
} from "./pager.js";
import { App, type AppDeps } from "./tui/App.js";
import { MOUSE_DISABLE, MOUSE_ENABLE } from "./tui/mouse.js";

/** Ink must render strictly fewer rows than the terminal has, or the frame scrolls off the top. */
export function frameHeight(rows: number | undefined): number {
  return Math.max(8, (rows || 24) - 1);
}

/** Ink's own fallback when a terminal reports no width. */
export function frameWidth(columns: number | undefined): number {
  return columns && columns > 0 ? columns : 80;
}

/**
 * Herdr's answer for the pane's size, when there is one to ask for. Without a
 * pane id there is nothing to ask about, so no Herdr call is made at all.
 */
export function startupGeometry(
  client: { run: (args: string[]) => Promise<{ stdout: string; exitCode: number }> },
  paneId: string | null,
): Promise<PaneGeometry | null> {
  return paneId ? paneGeometry(client, paneId) : Promise.resolve(null);
}

/**
 * The size the first frame is drawn at. Herdr knows the pane's real size from
 * the moment it creates the pane; the pty does not, because Herdr leaves a
 * freshly split plugin pane carrying its pre-split size until the pane's focus
 * changes. So Herdr's answer wins, and the pty is the fallback.
 */
export function startupSize(
  geometry: PaneGeometry | null,
  stdout: { columns?: number; rows?: number },
): { width: number; height: number } {
  return {
    width: frameWidth(geometry?.columns ?? stdout.columns),
    height: frameHeight(geometry?.rows ?? stdout.rows),
  };
}

export const DEFAULT_VIEWER = "less";

/** 128 + the signal number, as a shell reports it. */
export const SIGNAL_EXIT_CODES = { SIGINT: 130, SIGTERM: 143, SIGHUP: 129 } as const;

/**
 * Where a viewer command can come from. Named rather than positional because the order these are
 * consulted in is not the order they would naturally be passed in: the command line is the last
 * thing added and the first thing honoured, so a third positional parameter would invite a reader to
 * take its position for its precedence. Only the environment is required — a caller with neither a
 * command line nor a configuration file to offer says nothing about them.
 */
export interface ViewerSources {
  flag?: string | null;
  env: NodeJS.ProcessEnv;
  configured?: string | null;
}

/**
 * The command that shows an artifact, taken from the first source that yields a
 * non-empty string: the command line, which settles one run outright; the
 * environment variable, which overrides for one shell; the plugin's own
 * configuration file, which is the standing preference; then the pager.
 * `EDITOR` is deliberately not consulted: it is shared with git and every other
 * tool, so a pager here would leak into them.
 *
 * All four live here rather than being split between this function and its caller, so that the
 * question the spec and the README both answer — which source wins — has exactly one answer in the
 * code as well.
 */
export function resolveViewer({ flag, env, configured }: ViewerSources): string {
  return flag?.trim() || env.SPECTRA_VIEWER?.trim() || configured?.trim() || DEFAULT_VIEWER;
}

/**
 * Which way an artifact gets shown, decided by how the program was started. With a Herdr binary the
 * artifact goes to a pane beside this one, exactly as it always has. Without one there is no Herdr
 * to ask, so the artifact takes over the terminal the pane already occupies.
 *
 * The binary path is the test rather than the pane id: no binary means no Herdr call can succeed,
 * while a pane id without a binary is not a combination that can occur. The two adapters share one
 * signature, so the component calls whichever it was given without knowing which it is.
 */
export function chooseOpenEditor(
  herdrBin: string | null,
  pager: { spawnViewer: SpawnViewer; terminal: TerminalHandover },
): AppDeps["openEditor"] {
  return herdrBin ? openInEditorSplit : openInPager(pager);
}

/**
 * Switches terminal mouse reporting on for the pane and off again on exit.
 * `shutdown` writes the disable sequence every time it is called; writing it
 * twice is harmless, so the exit paths below do not need to coordinate.
 */
export function mouseLifecycle(write: (s: string) => void) {
  return {
    start: () => write(MOUSE_ENABLE),
    shutdown: () => write(MOUSE_DISABLE),
  };
}

/**
 * Closes the viewer pane the plugin opened, once, on the way out. The close is
 * synchronous because `process.on("exit")` runs no async work and a pane closed
 * by Herdr leaves the process only a signal handler's worth of time. Clearing
 * the id keeps a second exit path from closing twice, and a close that fails —
 * a pane that has already gone, a Herdr that will not run — is nothing the exit
 * path can act on, so it is swallowed.
 */
export function viewerLifecycle(close: (paneId: string) => void, ref: { current: string | null }) {
  return {
    shutdown: () => {
      const paneId = ref.current;
      if (!paneId) return;
      ref.current = null;
      try {
        close(paneId);
      } catch {
        // The process is ending; there is nowhere to report this.
      }
    },
  };
}

function Sized({
  initial,
  controls,
  ...props
}: Omit<AppDeps, "height" | "width"> & { initial: PaneGeometry | null; controls: TerminalControls }) {
  const { stdout, write } = useStdout();
  const { setRawMode, isRawModeSupported } = useStdin();
  const [size, setSize] = useState(() => startupSize(initial, stdout));
  // The two halves of the terminal handover that only a component can reach. A terminal that cannot
  // do raw mode has no input for Ink to stop reading, so that slot stays empty there.
  useEffect(() => {
    controls.setRawMode = isRawModeSupported ? setRawMode : null;
    controls.redraw = () => write("");
    return () => {
      controls.setRawMode = null;
      controls.redraw = null;
    };
  }, [controls, isRawModeSupported, setRawMode, write]);
  useEffect(() => {
    // Every later size comes from the pty, which is right once Herdr has resized it.
    const onResize = () => setSize(startupSize(null, stdout));
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);
  return <App {...props} width={size.width} height={size.height} />;
}

/** 128 + the signal number is the shell's convention; 2 is its convention for being asked wrongly. */
export const USAGE_ERROR_EXIT_CODE = 2;
/** Asked for something that should have been there and was not. */
export const UNREADABLE_VERSION_EXIT_CODE = 1;

async function main(): Promise<void> {
  // The arguments are settled first, ahead of every other startup step, so that asking this program
  // a question about itself never depends on there being a project to scan, a Herdr to reach, or a
  // terminal to draw on. Answering and exiting here leaves the rest of this function to the one
  // outcome that wants a pane.
  const invocation = parseCliArgs(process.argv.slice(2));
  if (invocation.kind === "help") {
    process.stdout.write(`${USAGE}\n`);
    return;
  }
  if (invocation.kind === "version") {
    try {
      process.stdout.write(`${packageVersion()}\n`);
    } catch (error) {
      process.stderr.write(`could not read the package version: ${(error as Error).message}\n`);
      process.exitCode = UNREADABLE_VERSION_EXIT_CODE;
    }
    return;
  }
  if (invocation.kind === "usage-error") {
    process.stderr.write(`${invocation.message}\n`);
    process.stderr.write(`${HELP_HINT}\n`);
    process.exitCode = USAGE_ERROR_EXIT_CODE;
    return;
  }
  // A source that could not be used is worth a line, and never worth refusing to start over.
  for (const line of invocation.warnings) process.stderr.write(`${line}\n`);

  const context = readInvocationContext(process.env, process.cwd());
  const client = createHerdrClient(context.herdrBin);
  // Independent lookups, both needed before the first frame.
  const [projectRoot, geometry] = await Promise.all([
    resolveProjectRoot(context, client),
    startupGeometry(client, context.paneId),
  ]);
  // One viewer command, resolved once, used by whichever adapter this run picked: the command line
  // settles it for both the Herdr split and the terminal hand-over.
  const viewer = resolveViewer({
    flag: invocation.viewer,
    env: process.env,
    configured: readConfiguredViewer(process.env),
  });

  const mouse = mouseLifecycle((s) => process.stdout.write(s));
  mouse.start();
  // Filled in from two sides: the component registers what only it can reach, and the clear below
  // waits for the render instance the call after it creates.
  const controls = createTerminalControls();
  const viewerPane: { current: string | null } = { current: null };
  const viewerExit = viewerLifecycle((paneId) => {
    if (!context.herdrBin) return;
    execFileSync(context.herdrBin, ["pane", "close", paneId], { timeout: 1000, stdio: "ignore" });
  }, viewerPane);
  // Both hooks run on every exit path, including the ones process.exit takes.
  process.on("exit", () => {
    mouse.shutdown();
    viewerExit.shutdown();
  });
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    process.on(signal, () => {
      mouse.shutdown();
      viewerExit.shutdown();
      process.exit(SIGNAL_EXIT_CODES[signal]);
    });
  }

  const app = render(
    <Sized
      initial={geometry}
      controls={controls}
      projectRoot={projectRoot}
      context={context}
      client={client}
      viewer={viewer}
      scan={scanChanges}
      hasSpecDir={specDirExists}
      readArtifact={(p) => readFile(p, "utf8")}
      sendText={sendTextToPane}
      focusPane={focusPane}
      openEditor={chooseOpenEditor(context.herdrBin, {
        spawnViewer: spawnViewerProcess,
        terminal: terminalHandover(controls, (s) => process.stdout.write(s)),
      })}
      copy={(text) => copyToClipboard(text)}
      viewerPane={viewerPane}
      onExit={(code) => {
        app.unmount();
        mouse.shutdown();
        process.exit(code);
      }}
    />,
  );
  controls.clear = () => app.clear();
  await app.waitUntilExit();
  mouse.shutdown();
}

if (isEntryPoint(import.meta.url, process.argv[1])) void main();
