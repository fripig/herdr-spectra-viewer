## 1. Adapter

- [x] 1.1 Implement the decision "Return the new pane id from the adapter": the adapter's artifact-open function reports the id of the pane it created as part of its success result, while its failure result keeps the reason shape it has today, and the exported adapter result type reflects both. Verified by assertions in `test/herdr/client.test.ts` on the returned pane id for a successful open and on the unchanged failure result when the split exits non-zero.
- [x] 1.2 Implement the decisions "Close the previous viewer pane before splitting a new one" and "Ignore the outcome of the close call": the open function accepts the previously created viewer pane id or null, issues a Herdr pane close for it before the split when one is given, issues no close when it is null, and proceeds to split and run regardless of what the close reported. Verified by assertions in `test/herdr/client.test.ts` on the full call sequence for both cases, including an open whose close reports a not-found pane still succeeding.

## 2. Pane component

- [x] 2.1 Implement the decision "Remember the viewer pane in the pane component": the component holds the id of the viewer pane most recently created, hands it to the next open, replaces it when an open succeeds, and holds no pane after an open whose split failed. Verified by assertions in `test/tui/App.test.tsx` that a first open passes no previous pane, a second open passes the pane the first one created, and the open after a failed split passes none.

## 3. Requirement coverage

- [x] 3.1 Deliver the modified requirement "Open an artifact in the editor" end to end: opening an artifact while a previous viewer pane is remembered replaces that pane rather than adding one, a first open closes nothing, a missing file closes nothing and keeps the remembered pane, and the status bar messages and self-closing pane behaviour are unchanged. Verified by the scenarios of that requirement appearing as cases in `test/tui/App.test.tsx`, including the three rows of the Herdr-calls-per-open example table.

## 4. Documentation

- [x] 4.1 Document the single viewer pane in `README.md` so a reader learns that opening a second artifact replaces the previous viewer pane instead of stacking a new one, alongside the existing note that a viewer that ends closes its own pane. Verified by a content review of the viewer section against the delta spec wording.

## 5. Verification

- [x] 5.1 Confirm the whole change is green and one viewer pane is really the maximum: `npm run typecheck` and `npm test` both pass, and in a live Herdr session opening one artifact, leaving its viewer running, then opening a second artifact leaves a single viewer pane while `herdr pane get <first pane id>` reports that the first pane is not found. Verified by pasting the test summary and the pane lookup output into the change record.

## Verification log

Recorded for task 5.1 on 2026-09-09.

```
$ npm run typecheck
tsc -p tsconfig.json --noEmit   (exit 0)

$ npm test
 Test Files  16 passed (16)
      Tests  174 passed (174)
```

Live Herdr 0.9.0 session, driving the real pane with key presses:

```
$ herdr plugin pane open --plugin spectra-viewer --entrypoint changes \
    --placement split --direction right --focus          -> changes pane w5:p2
  (navigate to design.md, press e)
$ herdr pane list                                        -> w5:p2 Spectra changes, w5:p3 viewer
$ herdr pane get w5:p3                                   -> terminal_title "less ; exit", showing design.md
  (viewer left running; navigate to proposal.md, press e)
$ herdr pane list                                        -> w5:p2 Spectra changes, w5:p4 viewer (no w5:p3)
$ herdr pane get w5:p3
{"error":{"code":"pane_not_found","message":"pane w5:p3 not found"},"id":"cli:pane:get"}
$ herdr pane get w5:p4                                   -> terminal_title "less ; exit", showing proposal.md
```

One viewer pane before the second open, one after: the first was replaced, not added to.

Interface note beyond the original task list: the design contract states a failed run still leaves
its pane on screen and therefore remembered, so the adapter's failure result carries the pane id as
an optional field. Covered by the adapter test "reports the pane a failed run left on screen so it
can be closed next time".

Known unrelated flake: App.test.tsx occasionally fails one key-press timing case (seen on
`grouped tree > expands parked with Right` and `send a Spectra command > key c`). Reproduced on
unmodified HEAD before the viewer-pager change, so it is pre-existing and out of scope here.
