import React, { useEffect, useState } from "react";
import { render, useStdout } from "ink";
import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { scanChanges } from "./discovery/scan.js";
import { readInvocationContext } from "./herdr/context.js";
import { createHerdrClient, focusPane, openInEditorSplit, sendTextToPane } from "./herdr/client.js";
import { copyToClipboard } from "./herdr/clipboard.js";
import { resolveProjectRoot } from "./herdr/project-root.js";
import { paneGeometry, type PaneGeometry } from "./herdr/client.js";
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
 * The command that shows an artifact. `EDITOR` is deliberately not consulted:
 * it is shared with git and every other tool, so a pager here would leak into
 * them. Blank and whitespace-only values fall back to the pager.
 */
export function resolveViewer(env: NodeJS.ProcessEnv): string {
  const value = env.SPECTRA_VIEWER?.trim();
  return value ? value : DEFAULT_VIEWER;
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

function Sized({ initial, ...props }: Omit<AppDeps, "height" | "width"> & { initial: PaneGeometry | null }) {
  const { stdout } = useStdout();
  const [size, setSize] = useState(() => startupSize(initial, stdout));
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

async function main(): Promise<void> {
  const context = readInvocationContext(process.env, process.cwd());
  const client = createHerdrClient(context.herdrBin);
  // Independent lookups, both needed before the first frame.
  const [projectRoot, geometry] = await Promise.all([
    resolveProjectRoot(context, client),
    startupGeometry(client, context.paneId),
  ]);
  const viewer = resolveViewer(process.env);

  const mouse = mouseLifecycle((s) => process.stdout.write(s));
  mouse.start();
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
      projectRoot={projectRoot}
      context={context}
      client={client}
      viewer={viewer}
      scan={scanChanges}
      hasOpenspec={async (root) => {
        try {
          return (await stat(path.join(root, "openspec"))).isDirectory();
        } catch {
          return false;
        }
      }}
      readArtifact={(p) => readFile(p, "utf8")}
      sendText={sendTextToPane}
      focusPane={focusPane}
      openEditor={openInEditorSplit}
      copy={(text) => copyToClipboard(text)}
      viewerPane={viewerPane}
      onExit={(code) => {
        app.unmount();
        mouse.shutdown();
        process.exit(code);
      }}
    />,
  );
  await app.waitUntilExit();
  mouse.shutdown();
}

const isEntryPoint = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) void main();
