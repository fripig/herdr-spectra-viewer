import React, { useEffect, useState } from "react";
import { render, useStdout } from "ink";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { scanChanges } from "./discovery/scan.js";
import { readInvocationContext } from "./herdr/context.js";
import { createHerdrClient, openInEditorSplit, sendTextToPane } from "./herdr/client.js";
import { copyToClipboard } from "./herdr/clipboard.js";
import { resolveProjectRoot } from "./herdr/project-root.js";
import { App, type AppDeps } from "./tui/App.js";

/** Ink must render strictly fewer rows than the terminal has, or the frame scrolls off the top. */
export function frameHeight(rows: number | undefined): number {
  return Math.max(8, (rows || 24) - 1);
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
  const editor = process.env.EDITOR && process.env.EDITOR.trim().length > 0 ? process.env.EDITOR.trim() : "vi";

  const app = render(
    <Sized
      projectRoot={projectRoot}
      context={context}
      client={client}
      editor={editor}
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
        process.exit(code);
      }}
    />,
  );
  await app.waitUntilExit();
}

void main();
