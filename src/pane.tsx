import React, { useEffect, useState } from "react";
import { render, useStdout } from "ink";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { scanChanges } from "./discovery/scan.js";
import { readInvocationContext } from "./herdr/context.js";
import { createHerdrClient, openInEditorSplit, sendTextToPane } from "./herdr/client.js";
import { copyToClipboard } from "./herdr/clipboard.js";
import { resolveProjectRoot } from "./herdr/project-root.js";
import { App, type AppDeps } from "./tui/App.js";
import { MOUSE_DISABLE, MOUSE_ENABLE } from "./tui/mouse.js";

/** Ink must render strictly fewer rows than the terminal has, or the frame scrolls off the top. */
export function frameHeight(rows: number | undefined): number {
  return Math.max(8, (rows || 24) - 1);
}

export const DEFAULT_VIEWER = "less";

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

function Sized(props: Omit<AppDeps, "height">) {
  const { stdout } = useStdout();
  const [height, setHeight] = useState(frameHeight(stdout.rows));
  useEffect(() => {
    const onResize = () => setHeight(frameHeight(stdout.rows));
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);
  return <App {...props} height={height} />;
}

async function main(): Promise<void> {
  const context = readInvocationContext(process.env, process.cwd());
  const client = createHerdrClient(context.herdrBin);
  const projectRoot = await resolveProjectRoot(context, client);
  const viewer = resolveViewer(process.env);

  const mouse = mouseLifecycle((s) => process.stdout.write(s));
  mouse.start();
  process.on("exit", mouse.shutdown);
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      mouse.shutdown();
      process.exit(signal === "SIGINT" ? 130 : 143);
    });
  }

  const app = render(
    <Sized
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
      openEditor={openInEditorSplit}
      copy={(text) => copyToClipboard(text)}
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
