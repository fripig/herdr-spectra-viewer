## Why

The changes pane is keyboard-only. Herdr users often reach for the mouse to glance at a change list, and a probe run on 2026-09-09 confirmed that Herdr 0.9.0 forwards SGR 1006 mouse reports (clicks, drags, wheel) into a plugin pane unchanged. With the transport verified, the missing piece is a small amount of hit-testing in the TUI.

## What Changes

- Enable terminal mouse reporting (button events with SGR encoding) when the pane starts and disable it when the pane exits by any path, so the shell that regains the terminal is not left receiving mouse escapes.
- Parse SGR mouse sequences from stdin into click, release, and wheel events with terminal column and row, ignoring anything else.
- Map a click at a row inside the tree column to the visible tree row under it: a click moves the cursor there; a click on a group or change node's marker area (the two columns holding the expand arrow) toggles expansion; a click on an artifact node moves the cursor and opens it in the editor split, the same as Enter or `e`.
- Map wheel up and down inside the tree to moving the cursor by one row, which already scrolls the window. The tree occupies the full pane width since the preview column was removed on 2026-09-09, so there is no second column to scroll.
- Keep every keyboard behaviour unchanged. Mouse is an addition, never a replacement, and the status bar keeps its key hints.

## Non-Goals (optional)

(Recorded in design.md under Goals / Non-Goals.)

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `changes-pane`: adds mouse reporting lifecycle, click-to-select, click-to-toggle, click-to-open, and wheel scrolling; modifies the pane lifecycle requirement so exit always restores the terminal.

## Impact

- Affected specs: `changes-pane` (modified)
- Affected code:
  - New: `src/tui/mouse.ts` (SGR parser, enable/disable sequences, hit-test)
  - New: `test/tui/mouse.test.ts`
  - Modified: `src/tui/App.tsx`, `src/pane.tsx`, `test/tui/App.test.tsx`, `README.md`
  - Removed: (none)
- Dependencies: none added. Relies on Ink's `useInput` delivering escape sequences, or on a raw `stdin` listener if it does not; the first task settles which.
- Interaction with the parked change `herdr-spectra-pane-actions`: that change adds a header row above the tree. Hit-testing therefore reads the tree's top row and column width from a layout value computed by `App`, never from constants, so either change can land first.
