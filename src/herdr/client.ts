import { execFile } from "node:child_process";

export interface RunResult {
  stdout: string;
  exitCode: number;
}

export interface HerdrClient {
  run(args: string[]): Promise<RunResult>;
}

export type AdapterResult = { ok: true } | { ok: false; reason: string };

/**
 * An open reports the pane it created, so the caller can close it next time.
 * A run that fails still leaves its pane on screen, so the failure carries the
 * id too; a split that never produced one carries nothing.
 */
export type ViewerResult = { ok: true; paneId: string } | { ok: false; reason: string; paneId?: string };

/** Production client: spawns the Herdr binary directly, never through a shell. */
export function createHerdrClient(bin: string | null): HerdrClient {
  return {
    run(args) {
      if (!bin) return Promise.resolve({ stdout: "", exitCode: 127 });
      return new Promise((resolve) => {
        execFile(bin, args, { encoding: "utf8" }, (err, stdout) => {
          if (err) {
            const code = typeof (err as { code?: unknown }).code === "number" ? (err as { code: number }).code : 1;
            resolve({ stdout: stdout ?? "", exitCode: code });
          } else resolve({ stdout, exitCode: 0 });
        });
      });
    },
  };
}

export async function sendTextToPane(client: HerdrClient, paneId: string, text: string): Promise<AdapterResult> {
  const r = await client.run(["pane", "send-text", paneId, text]);
  return r.exitCode === 0 ? { ok: true } : { ok: false, reason: `send-text exited ${r.exitCode}` };
}

export function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

export function extractPaneId(stdout: string): string | null {
  try {
    const parsed = JSON.parse(stdout) as { result?: { pane?: { pane_id?: unknown } } };
    const id = parsed?.result?.pane?.pane_id;
    return typeof id === "string" && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

export function extractPaneCwd(stdout: string): string | null {
  try {
    const parsed = JSON.parse(stdout) as { result?: { pane?: { cwd?: unknown } } };
    const cwd = parsed?.result?.pane?.cwd;
    return typeof cwd === "string" && cwd.length > 0 ? cwd : null;
  } catch {
    return null;
  }
}

/**
 * Splits a pane and shows the artifact in it. The command ends with `exit` so
 * the pane's shell dies with the viewer and Herdr reclaims the pane; the
 * separator is `;` rather than `&&` so a failing viewer leaves nothing behind
 * either.
 *
 * `previousViewerPane` is closed first, so only one viewer pane is ever on
 * screen. Closing is best-effort: Herdr exits zero for a pane that is already
 * gone, so the result carries no signal worth acting on. Closing before the
 * split also keeps the new pane in the layout the user had before the old one
 * appeared.
 */
export async function openInEditorSplit(
  client: HerdrClient,
  opts: { projectRoot: string; paneId: string | null; viewer: string; filePath: string; previousViewerPane: string | null },
): Promise<ViewerResult> {
  if (opts.previousViewerPane) await client.run(["pane", "close", opts.previousViewerPane]);
  const splitArgs = ["pane", "split"];
  if (opts.paneId) splitArgs.push("--pane", opts.paneId);
  splitArgs.push("--direction", "right", "--cwd", opts.projectRoot);
  const split = await client.run(splitArgs);
  if (split.exitCode !== 0) return { ok: false, reason: `pane split exited ${split.exitCode}` };
  const newPane = extractPaneId(split.stdout);
  if (!newPane) return { ok: false, reason: "pane split output has no pane id" };
  const run = await client.run(["pane", "run", newPane, `${opts.viewer} ${shellQuote(opts.filePath)}; exit`]);
  return run.exitCode === 0 ? { ok: true, paneId: newPane } : { ok: false, reason: `pane run exited ${run.exitCode}`, paneId: newPane };
}

export async function paneCwd(client: HerdrClient, paneId: string): Promise<string | null> {
  const r = await client.run(["pane", "get", paneId]);
  return r.exitCode === 0 ? extractPaneCwd(r.stdout) : null;
}
