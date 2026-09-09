## 1. Viewer command resolution

- [x] 1.1 Implement the decision "Read the viewer command from SPECTRA_VIEWER" by exporting a viewer resolver from the pane entry point in `src/pane.tsx`: given a process environment it returns the trimmed `SPECTRA_VIEWER` value when that variable holds non-whitespace text, and the literal `less` otherwise, and it never reads `EDITOR`. Verified by a new Vitest file `test/tui/viewer.test.ts` covering the six rows of the resolved-viewer example table in the delta spec (unset, unset with EDITOR set, set, set with EDITOR set, whitespace-only, value with surrounding spaces).
- [x] 1.2 Wire the resolved viewer into the rendered app so the value passed to the App component is the resolver's result rather than the current `EDITOR`-based expression, keeping the prop name aligned with the viewer vocabulary. Verified by `npx vitest run test/tui` passing and by grep showing no remaining `process.env.EDITOR` read in `src/`.

## 2. Adapter command shape

- [x] 2.1 Implement the decision "Close the viewer pane by appending an exit to the shell command" in the Herdr adapter in `src/herdr/client.ts`: the command handed to the Herdr run call is the viewer command, a space, the shell-quoted absolute artifact path, then a semicolon, a space, and `exit`. Verified by assertions in `test/herdr/client.test.ts` on the exact command string for a default viewer and for a viewer value that carries flags, including a path containing a single quote.
- [x] 2.2 Confirm the decision "Keep one split per open instead of reusing a viewer pane" holds: two consecutive open calls each issue their own split call and the adapter retains no pane id between calls. Verified by a regression test in `test/herdr/client.test.ts` asserting two split invocations and two distinct target panes.

## 3. Status bar wording

- [x] 3.1 Implement the decision "Use viewer wording in the status bar" in `src/tui/App.tsx`: a successful open sets the status message to `Opened in <viewer command>` naming the resolved viewer, and an adapter failure sets it to `Could not open viewer`. Verified by updated assertions in `test/tui/App.test.tsx` for both the success and the adapter-failure paths.

## 4. Requirement coverage

- [x] 4.1 Deliver the modified requirement "Open an artifact in the editor" end to end: pressing `e` on an artifact node splits a pane to the right, runs the resolved viewer on the artifact with the trailing exit, reports `Opened in <viewer command>`, leaves the changes pane open, shows `File not found: <relative path>` without splitting when the file is gone, and shows `Could not open viewer` when the adapter fails. Verified by the scenarios of that requirement appearing as cases in `test/tui/App.test.tsx`.
- [x] 4.2 Deliver the modified requirement "Select, toggle, and open by clicking the tree" for its viewer wording: clicking an artifact row outside the marker cells takes the same path as `e`, so the status bar shows `Opened in <viewer command>` on success and `File not found: <relative path>` for a deleted file, while cursor, marker toggling, and out-of-range clicks keep their current behavior. Verified by the existing click cases in `test/tui/App.test.tsx` updated to the viewer wording and still passing.

## 5. Documentation

- [x] 5.1 Document the viewer contract in `README.md` so a reader learns that opening an artifact uses `SPECTRA_VIEWER` with a `less` default, that the split pane closes itself when the viewer ends, and that `EDITOR` is no longer consulted, naming the replacement variable. Verified by a content review of the keys table and the new environment section against the delta spec wording.

## 6. Verification

- [x] 6.1 Confirm the whole change is green and the pane really disappears: `npm test` passes with no skipped suites, and in a live Herdr session opening an artifact then leaving the viewer makes `herdr pane get <pane id from the split>` report that the pane is not found. Verified by pasting the test summary and the pane lookup output into the change record.

## Verification log

Recorded for task 6.1 on 2026-09-09.

```
$ npm run typecheck
tsc -p tsconfig.json --noEmit   (exit 0)

$ npm test
 Test Files  16 passed (16)
      Tests  166 passed (166)
```

Live Herdr 0.9.0 session, exercising the exact command the adapter builds:

```
$ herdr pane split --pane w4:p1 --direction down --ratio 0.3   -> pane_id w4:pQ
$ herdr pane run w4:pQ "less '<repo>/openspec/changes/viewer-pager/design.md'; exit"
$ herdr pane read w4:pQ                                        -> design.md content on screen
$ herdr pane send-keys w4:pQ q
$ herdr pane get w4:pQ
{"error":{"code":"pane_not_found","message":"pane w4:pQ not found"},"id":"cli:pane:get"}
```

Known unrelated flake: `test/tui/App.test.tsx > grouped tree > expands parked with Right` fails
intermittently on key-press timing. Reproduced on unmodified HEAD (1 failure in 6 runs) before this
change, so it is pre-existing and out of scope here.
