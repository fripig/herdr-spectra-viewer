# herdr-spectra-pane-actions acceptance

Date: 2026-09-09. Herdr 0.9.0, Node 24.20.0, Ink 5.2.1, plugin built from the working tree after
tasks 1.1 to 3.5.

## Automated (task 4.1)

```
npm test              exit 0   Test Files 18 passed (18), Tests 259 passed (259)
npm run typecheck     exit 0   tsc -p tsconfig.json --noEmit, no diagnostics
npm run check-dist    exit 0   dist/pane.js and dist/open.js present
```

New test files added by this change and present on disk:

```
test/tui/change-order.test.ts     9 tests
test/tui/change-filter.test.ts   28 tests
```

`test/tui/App.test.tsx` went from 52 to 79 tests: the node-text-by-proposer-and-progress table, the
`Active (1/3)` filtered counts, the sort cycle, the six filter-mode cases, the four author-picker
cases, the four copy cases, and the two rescan-preservation cases.

Two changes to existing test code were needed and are not behaviour regressions:

- The four `mouse` click cases shifted their terminal row by one, because the header line now sits
  above the tree (`layout.treeTop` went from 0 to 1, and from 1 to 2 during a rescan).
- The harness now waits two macrotasks per keystroke instead of one. The pane renders more per
  frame than before, and a single 30 ms tick was not always enough for React to flush the passive
  effect that re-registers Ink's input handler, which made the first keystroke after mount flaky
  under a loaded machine. Nothing in `src/` depends on that timing.

## Live Herdr session (task 4.2)

Run from a scratch shell pane `w4:p2X` split below the Claude pane and then focused, so the plugin
pane split the scratch pane rather than the working session. Keys were delivered with
`herdr pane send-keys` and frames read with `herdr pane read --source visible --format text`. The
`herdr pane read` round trip lags one command behind the pane, so each observation below is the
frame read after the following command.

Layout after `herdr plugin action invoke open --plugin spectra-viewer`:

```
w4:p1  x=0  y=0  w=155      Claude pane
w4:p2X x=0  y=24 w=78       scratch working pane
w4:p20 x=78 y=24 w=77       plugin pane, right split of the working pane
```

| Step | Key(s) | Observed | Result |
| ---- | ------ | -------- | ------ |
| Header on open | — | `sort: modified`, change row `herdr-spectra-pane-actions fripig (10/11)` | pass |
| Cycle the sort mode | `s` `s` | header went `modified` → `name` → `created`, no rescan | pass |
| Enter filter mode and type | `/` `c` `o` `r` `e` | header became the input line `/ cor▌` and the counts were already `Archived (1/7)` before the last character | pass |
| Keep the filter | Enter | `sort: created  filter: core`, `Active (0/1)`, `Parked (0/0)`, `Archived (1/7)` | pass |
| Copy the change name | `j` `j` `l` `j` `y` | status bar `Copied: 2026-09-09-herdr-spectra-pane-core`; `pbpaste` returned exactly `2026-09-09-herdr-spectra-pane-core`, without the `fripig` proposer or the `(21/21)` counts that the node shows | pass |
| Author picker with one candidate | `@` | status bar `No authors to filter by`, the tree stayed on screen and the pane stayed in tree mode | pass |
| Quit | `q` | plugin pane `w4:p20` closed, working pane `w4:p2X` stayed | pass |

The repository has a single proposer, so the picker itself could not be exercised live; its four
cases are covered by `test/tui/App.test.tsx`.

### Defect found and fixed during this run

Typing `/` immediately followed by a character ran the character as a tree-mode command key instead
of appending it to the filter. Ink re-registers its input handler in a passive effect, so a key that
arrives before React commits is dispatched against the mode of the previous render. The mode is now
held in a ref that `setMode` writes synchronously, and the sort cycle uses a functional updater, so
each keystroke sees what the one before it did. Covered by the four `keys arriving faster than a
render` cases; three of them fail against the previous implementation.

One keystroke sent in the same instant as the pane's first frame is still dropped, both here and in
the test harness. That is Ink's first render, not a mode problem, and a person cannot type into a
pane that has not drawn yet.

Final automated run after the fix:

```
npm test              exit 0   Test Files 18 passed (18), Tests 263 passed (263)
npm run check-dist    exit 0
```

Probe panes `w4:p2X` and `w4:p20` were closed afterwards; the pre-existing `w4:t3` tab was left
untouched.
