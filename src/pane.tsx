import React from "react";
import { render } from "ink";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { scanChanges } from "./discovery/scan.js";
import { readInvocationContext } from "./herdr/context.js";
import { createHerdrClient, openInEditorSplit, sendTextToPane } from "./herdr/client.js";
import { copyToClipboard } from "./herdr/clipboard.js";
import { resolveProjectRoot } from "./herdr/project-root.js";
import { App } from "./tui/App.js";

async function main(): Promise<void> {
  const context = readInvocationContext(process.env, process.cwd());
  const client = createHerdrClient(context.herdrBin);
  const projectRoot = await resolveProjectRoot(context, client);
  const editor = process.env.EDITOR && process.env.EDITOR.trim().length > 0 ? process.env.EDITOR.trim() : "vi";

  const app = render(
    <App
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
      height={process.stdout.rows || 24}
    />,
  );
  await app.waitUntilExit();
}

void main();
