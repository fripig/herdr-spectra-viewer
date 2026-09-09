# mouse-support acceptance

Date: 2026-09-09. Herdr 0.9.0, Node 24.20.0, Ink 5.2.1, plugin built from the working tree after
tasks 1.1 to 3.1.

## Automated (task 3.1)

```
npm test         Test Files 15 passed, Tests 156 passed, 0 errors
npm run check-dist   exit 0 (dist/pane.js and dist/open.js present)
```

README.md gained a "Keys and mouse" table and the paragraph about holding Shift to select text
while mouse reporting is on.

## Live Herdr split pane (task 3.2)

The pane was opened as split `w4:pG` (right of the Claude Code pane `w4:p1`) with
`HERDR_PANE_ID=w4:p1 HERDR_PLUGIN_ID=spectra-viewer node dist/pane.js`. Mouse events were injected
with `herdr pane send-text` using the exact byte sequences a real click produces (see the probe in
`2026-09-09-mouse-support-spike.md`); a physical mouse was not used in this run, so the last row of the
table is the one item still worth a human glance.

| Step | Injected | Observed on `herdr pane read --source visible` | Result |
| ---- | -------- | ----------------------------------------------- | ------ |
| Click change label, row 2 col 10 | `ESC[<0;10;2M` | cursor moved to `mouse-support (7/9)`, node stayed collapsed | pass |
| Click marker cells, row 2 col 5 | `ESC[<0;5;2M` | `mouse-support` expanded (`▾`), cursor stayed on it | pass |
| Wheel down, row 3 | `ESC[<65;10;3M` | cursor moved one row to `design.md` | pass |
| Click artifact label, row 3 col 12 | `ESC[<0;12;3M` | status bar `Opened in vi`; new split `w4:pH` appeared running vi on `design.md` | pass |
| Quit with `q` | `q` | pane returned to the shell prompt | pass |
| Terminal restored | – | see pty capture below; shell noise on a physical mouse move not checked by hand | see note |

Cleanup: vi in `w4:pH` was closed with `:q!`.

## Mouse reporting lifecycle (pty capture)

`expect` spawned `node dist/pane.js` on a pty, waited for the first frame, sent `q`, and logged every
byte. Offsets into the log:

```
enable  ESC[?1000h ESC[?1006h  at byte 44
first frame ("Active")          at byte 298
disable ESC[?1006l ESC[?1000l  at byte 955 (written twice: onExit and the exit event)
order enable < frame < disable: true
```

So the disable sequence reaches the terminal before the process ends on the `q` path. SIGINT and
SIGTERM run the same `shutdown()` before `process.exit` (`src/pane.tsx`); they were not exercised in
this run.
