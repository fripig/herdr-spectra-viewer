# pane-initial-geometry acceptance

Date: 2026-09-09. Herdr 0.9.0, Node 24.20.0, Ink 5.2.1, plugin built from the working tree.

## Automated (task 4.1)

```
npm test              exit 0   Test Files 19 passed (19), Tests 305 passed (305)
npm run typecheck     exit 0   tsc -p tsconfig.json --noEmit, no diagnostics
npm run check-dist    exit 0   dist/pane.js and dist/open.js present
```

Test counts before and after this change:

```
test/herdr/client.test.ts       20 -> 31   paneGeometry
test/tui/frame-height.test.ts    2 -> 10   frameWidth, startupGeometry, startupSize
test/tui/hint-layout.test.ts     0 -> 12   new file
test/tui/App.test.tsx           83 -> 94   hint wrapping and frame height
```

Two existing tests needed adjusting, neither a behaviour regression:

- `mouse > click accounts for a scrolled window and a row rendered above the tree` now mounts at
  width 120. At the harness default of 80 the key hints wrap onto a second line, which is the
  point of this change, and that shortens the tree by a row. The test is about mouse row mapping,
  so it pins a width where the hints stay on one line; its tree height is 5, the same as before.
- The stale comment claiming that height 10 gives treeHeight 6 was corrected to 5.

## Live Herdr session (task 4.2)

The plugin pane was opened with `herdr plugin pane open --target-pane <scratch>`, which is the
command the open action runs, so the pane could be observed **without ever changing focus** — the
focus transition is what makes Herdr resize the pty, and the whole point is that the first frame
must already be right.

Layout: a scratch pane `w4:p3B` was split below the working pane, 78 columns wide; the plugin pane
`w4:p3C` was split off it, 77 columns by 24 rows. The pre-split width was 155.

Frame read immediately, before any focus change:

```
frame lines: 21   (pane rect height 24, pty viewport 22)
 1: sort: modified
 2: > ▾ Active (1)
 3:     ▸ pane-initial-geometry fripig (6/7)
 4:     Parked (0)
 5:   ▸ Archived (8)
 ...
19: ↑↓/jk move  ←→/hl fold  ⏎/e open  s sort  / filter  @ authors  y copy
20: R rescan  q quit
21: send to pane:  d discuss  a apply  i ingest  r archive  c commit

herdr pane get w4:p3C -> scroll {'max_offset_from_bottom': 0, 'viewport_rows': 48}
```

Both acceptance criteria hold: `q quit`, the last hint, is on screen, and
`scroll.max_offset_from_bottom` is 0, so no row was pushed off the top.

`viewport_rows` still reads 48 at this point — the stale pre-split value. That is exactly what the
smaller-of-two rule is for: `min(48, 24 - 2)` gives 22, and `frameHeight(22)` gives the 21 rows
above.

After a focus transition the pane reports `viewport_rows` 22 and the frame is still 21 lines, so
the resize path produces the same result and nothing jumps.

Pressing `q` closed the plugin pane. Both probe panes were closed afterwards and the working pane
returned to its full size.

### Design decision corrected during this run

The design first said the height should come from `scroll.viewport_rows`, rejecting
`rect.height - 2` as an observed constant rather than a published contract. The live run showed
that `viewport_rows` *is* the pty's row count, so it is stale at exactly the moment it is needed:
a pane whose rect was already 24 reported 48. `rect.height`, by contrast, is correct from the
moment the pane exists — the width proved it, resolving to 77 on the first frame.

The offset between the two was measured at three sizes, and is 2 every time:

| pane   | rect.height | viewport_rows (settled) |
| ------ | ----------- | ----------------------- |
| w4:p1  | 48          | 46                      |
| w4:p38 | 24          | 22                      |
| w4:p38 | 12          | 10                      |

The rule became `min(viewport_rows, rect.height - 2)`: the stale value loses on a new pane, the two
agree on a settled one, and if Herdr's chrome ever stops being two rows the frame comes out shorter
than the pane rather than overflowing it. `design.md`, the `herdr-plugin-packaging` delta spec, and
task 1.1 were all updated before the code changed.

## Upstream

Herdr 0.9.0 does not size a newly created plugin pane's pty until the pane's focus changes; both
`process.stdout` and `herdr pane get`'s `scroll.viewport_rows` carry the pre-split size until then.
Everything above is a workaround on the plugin side, not a fix. Worth reporting upstream.
