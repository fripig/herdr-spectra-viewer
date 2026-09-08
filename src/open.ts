import { spawn } from "node:child_process";

export const MISSING_BIN_MESSAGE = "HERDR_BIN_PATH is not set; run this action from Herdr.";

export interface OpenDeps {
  env: NodeJS.ProcessEnv;
  spawnProcess: (bin: string, args: string[]) => Promise<number>;
  stderr: (line: string) => void;
}

export function openPaneArgs(pluginId: string): string[] {
  return ["plugin", "pane", "open", "--plugin", pluginId, "--entrypoint", "changes"];
}

export async function runOpenAction(deps: OpenDeps): Promise<number> {
  const bin = deps.env.HERDR_BIN_PATH;
  if (!bin) {
    deps.stderr(MISSING_BIN_MESSAGE);
    return 1;
  }
  const pluginId = deps.env.HERDR_PLUGIN_ID || "spectra-viewer";
  return deps.spawnProcess(bin, openPaneArgs(pluginId));
}

function spawnInherit(bin: string, args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { stdio: "inherit" });
    child.on("error", () => resolve(1));
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  runOpenAction({
    env: process.env,
    spawnProcess: spawnInherit,
    stderr: (line) => process.stderr.write(line + "\n"),
  }).then((code) => process.exit(code));
}
