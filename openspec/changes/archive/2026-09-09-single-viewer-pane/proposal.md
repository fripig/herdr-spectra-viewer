## Why

Opening an artifact splits a fresh pane every time. The pane closes itself when the viewer ends, so panes stop accumulating once the user quits each viewer — but a user who leaves a viewer open and goes back to the tree to open the next artifact gets a second pane, then a third. Reading four artifacts in a row without quitting in between fills the tab with viewer panes that all have to be closed by hand.

## What Changes

- The pane remembers the viewer pane it most recently created.
- Before splitting a new viewer pane, the plugin closes the remembered one. At most one viewer pane exists at any time.
- Closing the remembered pane is best-effort: the Herdr close call exits zero even when the pane is already gone, so its outcome is ignored and a new split follows either way.
- The Herdr adapter reports the pane id it created, so the pane component has something to remember.
- The existing self-closing behaviour is kept: a viewer that ends still takes its pane with it, and the remembered id simply goes stale until the next open overwrites it.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `changes-pane`: the requirement that opens an artifact gains the single-viewer-pane rule and the close-before-split step; the click requirement that references it inherits the same behaviour.

## Impact

- Affected specs: `changes-pane`
- Affected code:
  - Modified: `src/herdr/client.ts`, `src/herdr/index.ts`, `src/tui/App.tsx`, `test/herdr/client.test.ts`, `test/tui/App.test.tsx`, `README.md`
  - New: (none)
  - Removed: (none)
- Affected Herdr surface: the plugin starts issuing pane close calls in addition to pane split and pane run.
