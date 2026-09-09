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

/**
 * Hands keyboard focus back to the pane the plugin sits beside. The direction
 * is fixed by the right split the open action asks for: the plugin pane is on
 * the right, so the working pane is to its left.
 */
export async function focusPane(client: HerdrClient, opts: { paneId: string }): Promise<AdapterResult> {
  const r = await client.run(["pane", "focus", "--pane", opts.paneId, "--direction", "left"]);
  return r.exitCode === 0 ? { ok: true } : { ok: false, reason: `pane focus exited ${r.exitCode}` };
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

/** The terminal size the pane actually has, in pty columns and rows. */
export interface PaneGeometry {
  columns: number;
  rows: number;
}

function positiveInt(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null;
}

interface LayoutPane {
  pane_id?: unknown;
  rect?: { width?: unknown; height?: unknown };
}

/** The rows Herdr draws around a pane, which its `rect` counts and the pty does not. */
export const PANE_CHROME_ROWS = 2;

/** The pane's own box in the layout: correct from the moment the pane exists. */
export function extractPaneRect(stdout: string, paneId: string): { width: number; height: number } | null {
  try {
    const parsed = JSON.parse(stdout) as { result?: { layout?: { panes?: unknown } } };
    const panes = parsed?.result?.layout?.panes;
    if (!Array.isArray(panes)) return null;
    const own = (panes as LayoutPane[]).find((p) => p?.pane_id === paneId);
    if (!own) return null;
    const width = positiveInt(own.rect?.width);
    const height = positiveInt(own.rect?.height);
    return width !== null && height !== null ? { width, height } : null;
  } catch {
    return null;
  }
}

/**
 * The pty's own row count. Herdr leaves a freshly created pane's pty carrying
 * the pre-split size, so this is too large until the pane's focus changes.
 */
export function extractViewportRows(stdout: string): number | null {
  try {
    const parsed = JSON.parse(stdout) as { result?: { pane?: { scroll?: { viewport_rows?: unknown } } } };
    return positiveInt(parsed?.result?.pane?.scroll?.viewport_rows);
  } catch {
    return null;
  }
}

/**
 * Asks Herdr how big the pane is. Herdr gives a freshly split plugin pane a pty
 * that still carries the pre-split size and does not resize it until the pane's
 * focus changes, so the process's own view of its size is wrong for the whole
 * first frame; the layout Herdr reports is right from the start.
 *
 * The height takes the smaller of the two numbers Herdr offers, because neither
 * is reliable alone: the pty's row count is stale on a new pane, and the rect's
 * height counts the pane's chrome as well. The smaller one is whichever is
 * currently right, and if the chrome ever stops being two rows the frame comes
 * out shorter than the pane rather than taller than it.
 *
 * Anything missing makes the whole answer null rather than half an answer,
 * because a width from Herdr paired with a height from the stale pty describes
 * no terminal that exists.
 */
export async function paneGeometry(client: HerdrClient, paneId: string): Promise<PaneGeometry | null> {
  const [layout, info] = await Promise.all([
    client.run(["pane", "layout", "--pane", paneId]),
    client.run(["pane", "get", paneId]),
  ]);
  if (layout.exitCode !== 0 || info.exitCode !== 0) return null;
  const rect = extractPaneRect(layout.stdout, paneId);
  const viewportRows = extractViewportRows(info.stdout);
  if (rect === null || viewportRows === null) return null;
  return { columns: rect.width, rows: Math.min(viewportRows, rect.height - PANE_CHROME_ROWS) };
}
