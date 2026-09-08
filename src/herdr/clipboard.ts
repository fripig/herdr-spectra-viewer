import { spawn } from "node:child_process";
import type { AdapterResult } from "./client.js";

export type Spawner = (cmd: string, args: string[], stdinText: string) => Promise<number>;

const defaultSpawner: Spawner = (cmd, args, stdinText) =>
  new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ["pipe", "ignore", "ignore"] });
    child.on("error", () => resolve(1));
    child.on("exit", (code) => resolve(code ?? 1));
    child.stdin.on("error", () => {});
    child.stdin.end(stdinText);
  });

export function clipboardCommands(platform: NodeJS.Platform): Array<[string, string[]]> {
  if (platform === "darwin") return [["pbcopy", []]];
  if (platform === "linux") return [["wl-copy", []], ["xclip", ["-selection", "clipboard"]]];
  return [];
}

export async function copyToClipboard(
  text: string,
  platform: NodeJS.Platform = process.platform,
  spawner: Spawner = defaultSpawner,
): Promise<AdapterResult> {
  for (const [cmd, args] of clipboardCommands(platform)) {
    if ((await spawner(cmd, args, text)) === 0) return { ok: true };
  }
  return { ok: false, reason: "no clipboard command succeeded" };
}
