## Context

The pane is an Ink application. `App` in `src/tui/App.tsx` keeps a cursor by node key, an expansion set, and a window start; `ChangeTree` renders rows from `windowStart` for `treeHeight` rows across the full pane width (the preview column was removed on 2026-09-09; Enter on an artifact now opens it in the editor split, the same as `e`). All input arrives through Ink's `useInput`.

On 2026-09-09 a probe script run inside a Herdr 0.9.0 split pane, after writing `ESC[?1000h ESC[?1002h ESC[?1006h`, received SGR-encoded reports on stdin: `ESC[<0;17;18M` (left press at column 17, row 18), `ESC[<0;17;18m` (release), `ESC[<64;10;21M` and `ESC[<65;10;21M` (wheel up and down), and `ESC[<32;9;5M` (drag). No right-button report arrived. Coordinates are 1-based terminal cells. This establishes that Herdr forwards mouse input unchanged, so the whole feature lives in the TUI.

The parked change `herdr-spectra-pane-actions` will add a header row above the tree, which shifts the tree's first row down by one. Hit-testing has to be driven by the layout `App` actually renders.

## Goals / Non-Goals

**Goals:**

- Click a tree row to move the cursor there; click a node's marker to expand or collapse; click an artifact to open it in the editor split.
- Wheel over the tree moves the cursor.
- Mouse reporting is switched on at start and off on every exit path, so the user's shell is never left in mouse mode.
- Keyboard behaviour and tests remain unchanged.

**Non-Goals:**

- Drag selection, double-click, right-click, or context menus. Herdr did not deliver a right-button report, and the pane has no multi-selection.
- Clicking status bar hints to trigger commands.
- Any preview or in-pane file viewer; the preview column was removed and is not coming back with this change.
- Mouse support in the author picker or filter line of the actions change; those can be added there once both changes land.
- Text selection inside the pane. With reporting enabled the terminal's native selection needs Shift held; this is documented in the README install paragraph, not worked around.

## Decisions

### Mouse sequences are parsed in a pure module

`src/tui/mouse.ts` exports:

- `MOUSE_ENABLE = "\x1b[?1000h\x1b[?1006h"` and `MOUSE_DISABLE = "\x1b[?1006l\x1b[?1000l"`. Mode 1002 (drag reports) is deliberately not enabled because drags are a non-goal and they flood stdin.
- `parseMouse(input: string): MouseEvent[]` which finds every `[<button;col;row(M|m)` occurrence in a string (with or without a leading ESC) and returns `{ kind: "press" | "release" | "wheel-up" | "wheel-down", button, col, row }` using 1-based coordinates as the terminal sends them; button 64 is wheel-up, 65 is wheel-down, 0 with `M` is press, anything with `m` is release. Unknown buttons are dropped.
- `hitTest(event, layout, depthAt?): Hit | null` where `depthAt(rowIndex)` returns a row's depth (App passes a lookup into its rows) and `layout` is `{ treeTop, treeHeight, treeLeft, treeWidth, windowStart, rowCount }` (0-based rows and columns inside the pane) and `Hit` is `{ area: "tree", rowIndex, onMarker }`; a press outside the tree rows (header, status bar, past `treeHeight`) returns `null`. `rowIndex` is `windowStart + (row - 1 - treeTop)`; `onMarker` is true when the column falls within the two cells of the expand arrow for that depth, computed from the same indent rule `ChangeTree` uses (`2 + 2 * depth` cells of prefix, marker in the two cells after the indent).

Alternative rejected: an npm terminal-mouse package. Each one parses the same SGR triple; a 40-line parser with table tests is smaller than a dependency.

### Layout is computed by App and shared with the tree renderer

`App` computes a `Layout` value each render from the pieces it already knows: `treeTop` is the number of rows rendered above the tree (0 today, 1 once the actions change adds its header), `treeHeight` is the existing `treeHeight`, `treeLeft` is 0, `treeWidth` is `columns` where `columns` comes from `useStdout().stdout.columns` (falling back to 80), because the tree spans the full pane width, and `windowStart` and `rowCount` are the current values. `ChangeTree` keeps rendering exactly `treeHeight` rows from `windowStart`, so the two stay in step by construction. A unit test renders `App` at a known size, clicks row 3, and asserts the cursor moved to the third visible row.

### Input arrives through useInput, with a raw-stdin fallback decided by a spike

Ink's `useInput` receives escape sequences as `input` text. The first task verifies with a real terminal (the probe script adapted to Ink) whether an SGR report reaches the handler intact and whether Ink flags it as `key.escape`. If it arrives intact, the handler calls `parseMouse(input)` first and returns early when events were found, so the sequence never reaches the `q`/Escape branch. If Ink mangles or splits it, the fallback is a `useStdin().stdin.on("data")` listener registered in `App` that parses mouse reports and a module-level flag that makes the `useInput` handler ignore the same bytes. The spike records which path was taken in the acceptance notes so the tests target the real one.

### Mouse reporting lifecycle lives in the pane entry point

`src/pane.tsx` writes `MOUSE_ENABLE` to stdout before `render` and writes `MOUSE_DISABLE` from a single `shutdown()` used by `onExit`, by the `waitUntilExit` resolution, and by `process.on("SIGINT")`, `process.on("SIGTERM")`, and `process.on("exit")` handlers. Writing the disable sequence twice is harmless, so the handlers do not coordinate. The test for this is a unit test of `shutdown()` writing the sequence exactly once per call through an injected writer, plus a manual check that `cat -v` in the pane's shell after quitting shows no `ESC[<` noise when moving the mouse.

### Click semantics mirror the keyboard

A press inside the tree column maps to a row. If the row exists: the cursor moves there; if `onMarker` and the row is expandable, expansion is toggled (same as Right/Left); if the row is an artifact and not `onMarker`, the artifact is opened in the editor split through the existing `openEditor` path (same as Enter and `e`), including its `File not found: <relative path>` handling. A press on an empty tree row below the last node moves nothing. Releases are ignored. Wheel-up and wheel-down over the tree call the same `moveCursor(-1)` / `moveCursor(1)` as Up/Down, so window scrolling comes for free. Wheel events on the status bar or header do nothing. Any mouse event while the pane is not in tree mode (a state the actions change introduces) is ignored.

## Implementation Contract

**Behavior**

- Starting the pane writes `ESC[?1000h ESC[?1006h` to stdout before the first frame. Quitting with `q`, Escape, a command key, Ctrl-C, or SIGTERM writes `ESC[?1006l ESC[?1000l` before the process ends.
- With the tree showing `Active (2)` on row 1 and `add-search (3/8)` on row 2: a left press at row 2 moves the cursor to `add-search`; a press at row 2 within the marker cells toggles its expansion; a press at row 1 within the marker cells collapses Active.
- With `design.md` visible on row 3: a press at row 3 outside the marker cells moves the cursor there and calls the editor adapter with that file's path, and the status bar shows `Opened in <editor>`.
- Wheel-down over the tree moves the cursor down one row; wheel-up moves it up; neither wraps. Wheel on the status bar does nothing.

**Interface / data shape**

```ts
type MouseEvent = { kind: "press" | "release" | "wheel-up" | "wheel-down"; button: number; col: number; row: number }; // 1-based
interface Layout { treeTop: number; treeHeight: number; treeLeft: number; treeWidth: number; windowStart: number; rowCount: number } // 0-based
type Hit = { area: "tree"; rowIndex: number; onMarker: boolean };
function parseMouse(input: string): MouseEvent[];
function hitTest(event: MouseEvent, layout: Layout, depthAt?: (rowIndex: number) => number): Hit | null; // depthAt locates the marker cells; defaults to depth 0
const MOUSE_ENABLE: string; const MOUSE_DISABLE: string;
```

**Failure modes**

- A malformed or partial sequence yields no events and is otherwise ignored; it never reaches the keyboard handler as a quit.
- A press outside the tree rows (status bar, header) does nothing.
- An artifact click whose file is missing shows `File not found: <relative path>` and opens nothing, exactly as Enter does.
- If the terminal never reports mouse events, the pane behaves exactly as before.

**Acceptance criteria**

- `test/tui/mouse.test.ts`: table tests for `parseMouse` over the five probe samples plus a partial sequence, and for `hitTest` over rows above, inside, below the tree, marker versus label columns at depths 0, 1, 2, and a status-bar press, with `treeTop` 0 and 1.
- `test/tui/App.test.tsx`: cases for click-to-select, marker click toggle, artifact click opens the editor, artifact click on a missing file, wheel over tree without wrapping, wheel on the status bar ignored, and that a mouse sequence does not trigger exit.
- Unit test of the shutdown writer in `test/tui/mouse-lifecycle.test.ts`.
- `npm test` and `npm run check-dist` exit 0.
- Manual in Herdr: open the pane as a split, click rows and markers, click an artifact and see the editor split open, wheel over the tree, quit, then move the mouse in the shell and confirm no escape noise.

**Scope boundaries**

- In scope: `src/tui/mouse.ts`, changes to `src/tui/App.tsx`, `src/pane.tsx`, their tests, a README paragraph about Shift-select.
- Out of scope: the author picker and filter line of the actions change, drag, double-click, right-click, discovery, adapter, manifest.

## Risks / Trade-offs

- [Ink may swallow or split SGR sequences across `useInput` calls] → Spike task decides between `useInput` and a raw stdin listener before any hit-test code is written.
- [Reporting left enabled after a crash leaves the shell printing escape noise] → Disable is written from `exit`, `SIGINT`, and `SIGTERM` handlers; the manual acceptance step checks the shell afterwards; the user can always run `printf '\e[?1000l'`.
- [Terminal native text selection stops working while the pane runs] → Documented; Shift-drag still selects in most terminals.
- [Column width for hit-testing depends on `stdout.columns` which may be 0 at startup in some panes] → Fall back to 80 and recompute on `resize`, reusing the `Sized` wrapper's listener.

## Migration Plan

No data changes. Rebuild with `npm run build` and reopen the pane.

## Open Questions

- Whether Ink delivers the sequence intact to `useInput` is settled by the spike task, not left open for implementation.
