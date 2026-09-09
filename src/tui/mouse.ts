// SGR (mode 1006) mouse reporting: enable/disable sequences, a parser for the
// reports the terminal sends, and a hit-test from terminal cells to tree rows.
// Pure functions only; no terminal or Ink access here.

export const MOUSE_ENABLE = "\x1b[?1000h\x1b[?1006h";
export const MOUSE_DISABLE = "\x1b[?1006l\x1b[?1000l";

export type MouseKind = "press" | "right-press" | "release" | "wheel-up" | "wheel-down";

export interface MouseEvent {
  kind: MouseKind;
  button: number;
  /** 1-based terminal column, as reported. */
  col: number;
  /** 1-based terminal row, as reported. */
  row: number;
}

/** True when the chunk starts like an SGR mouse report (with or without the leading ESC). */
export function looksLikeMouse(input: string): boolean {
  return /^\x1b?\[</.test(input);
}

const REPORT = /\x1b?\[<(\d+);(\d+);(\d+)([Mm])/g;

/**
 * Finds every complete SGR report in the chunk. Ink hands `useInput` the report
 * without its leading ESC, so the ESC is optional. Partial reports and unknown
 * buttons yield nothing.
 *
 * The button field carries no modifier bits: a right press with Alt held
 * reports the same button as a plain one, so nothing here can tell them apart.
 */
export function parseMouse(input: string): MouseEvent[] {
  const events: MouseEvent[] = [];
  for (const m of input.matchAll(REPORT)) {
    const button = Number(m[1]);
    const col = Number(m[2]);
    const row = Number(m[3]);
    const kind = kindOf(button, m[4] === "m");
    if (kind) events.push({ kind, button, col, row });
  }
  return events;
}

/** The button field of a right press. Release reports carry it too, and stay releases. */
const RIGHT_BUTTON = 2;

function kindOf(button: number, release: boolean): MouseKind | null {
  if (release) return "release";
  if (button === 0) return "press";
  if (button === RIGHT_BUTTON) return "right-press";
  if (button === 64) return "wheel-up";
  if (button === 65) return "wheel-down";
  return null;
}

/** 0-based geometry of the tree inside the pane, as rendered by App. */
export interface Layout {
  /** Rows rendered above the first tree row (header lines). */
  treeTop: number;
  /** Rows the tree renders. */
  treeHeight: number;
  /** Columns left of the tree. */
  treeLeft: number;
  /** Width of the tree in cells. */
  treeWidth: number;
  /** Index of the first rendered row within the full row list. */
  windowStart: number;
  /** Number of rows in the full row list. */
  rowCount: number;
}

export interface TreeHit {
  area: "tree";
  /** Index into the full row list. */
  rowIndex: number;
  /** True when the click landed on the two expand-marker cells of that row. */
  onMarker: boolean;
}

export type Hit = TreeHit;

/** Prefix cells before the marker for a row at `depth`: cursor column plus indent. */
export const markerStart = (depth: number): number => 2 + 2 * depth;

/**
 * Maps an event to the tree row under it, or null when it falls outside the
 * rendered tree rows (header, status bar, past the last node). `depthAt`
 * gives a row's depth so the marker cells can be located; it defaults to 0.
 */
export function hitTest(event: MouseEvent, layout: Layout, depthAt: (rowIndex: number) => number = () => 0): Hit | null {
  const treeRow = event.row - 1 - layout.treeTop;
  if (treeRow < 0 || treeRow >= layout.treeHeight) return null;
  const colInTree = event.col - 1 - layout.treeLeft;
  if (colInTree < 0 || colInTree >= layout.treeWidth) return null;
  const rowIndex = layout.windowStart + treeRow;
  if (rowIndex < 0 || rowIndex >= layout.rowCount) return null;
  const start = markerStart(depthAt(rowIndex));
  const onMarker = colInTree === start || colInTree === start + 1;
  return { area: "tree", rowIndex, onMarker };
}
