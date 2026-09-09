## Why

Opening an artifact from the changes pane splits a new pane and runs `$EDITOR` (defaulting to `vi`) in it. When the user leaves the editor the shell that ran it is still alive, so the pane stays behind. Reading three artifacts leaves three dead panes that have to be closed by hand. Browsing a proposal or a task list is a read-only act, so a full editor is the wrong default tool for it.

## What Changes

- The viewer command is read from the `SPECTRA_VIEWER` environment variable, falling back to `less` when it is unset or empty.
- **BREAKING**: the `EDITOR` environment variable is no longer consulted. A user who relied on `EDITOR=nvim` must now set `SPECTRA_VIEWER=nvim` to keep that behaviour.
- The command sent to the new pane gains a trailing `; exit`, so the shell terminates once the viewer does and Herdr reclaims the pane automatically. This happens whether the viewer succeeded or failed.
- Status bar wording follows the viewer vocabulary: `Opened in <viewer command>` on success, `Could not open viewer` on adapter failure.
- The README key table and a new environment-variable section describe the viewer and its auto-closing pane.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `changes-pane`: the requirement that opens an artifact changes its command source, its pane lifetime, and its status bar wording; the click requirement that references it is reworded to match.

## Impact

- Affected specs: `changes-pane`
- Affected code:
  - Modified: `src/pane.tsx`, `src/herdr/client.ts`, `src/tui/App.tsx`, `test/herdr/client.test.ts`, `test/tui/App.test.tsx`, `README.md`
  - New: (none)
  - Removed: (none)
- Affected environment: `SPECTRA_VIEWER` is introduced; `EDITOR` stops affecting this plugin.
