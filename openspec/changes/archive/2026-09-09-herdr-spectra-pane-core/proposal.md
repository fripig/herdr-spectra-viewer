## Why

Spectra changes (active, parked, archived) are only visible through the `spectra` CLI or an IntelliJ plugin. Herdr users who work in terminal panes with coding agents have no way to see the change list, task progress, or artifact contents without leaving the pane, and no shortcut for handing a `/spectra-*` command to the agent pane they are working in. This change ports the proven idea-spectra-viewer behaviour to a Herdr plugin so the same workflow is available inside Herdr.

## What Changes

- Add a Herdr plugin directory with a `herdr-plugin.toml` manifest that declares one pane (`changes`, overlay placement), one action (`open`) that opens that pane, and a build step that compiles the TypeScript sources.
- Add a change discovery module that scans the file system for Spectra changes from three sources (active, parked, archived) and reports per-change metadata, task progress, and derived status without invoking the `spectra` CLI. Behaviour is ported from the idea-spectra-viewer `change-discovery` spec.
- Add a terminal UI (Node.js + Ink) that renders the discovered changes as a grouped tree, shows task progress on change nodes, shows loading and empty states, rescans on demand, and previews a selected artifact's Markdown content inside the pane.
- Add a Herdr adapter that talks to the running Herdr through the binary at `HERDR_BIN_PATH`: it writes a `/spectra-*` command into the pane that invoked the plugin without submitting it, opens the selected artifact in the user's editor in a split pane, and falls back to the system clipboard when no invoking pane is known.
- Add keyboard shortcuts for the five workflow commands (`/spectra-discuss`, `/spectra-apply`, `/spectra-ingest`, `/spectra-archive`, `/spectra-commit`) applied to the selected change.

## Non-Goals (optional)

(Recorded in design.md under Goals / Non-Goals.)

## Capabilities

### New Capabilities

- `change-discovery`: Scan a project root for Spectra changes from the active, parked, and archived sources; report name, group, path, artifacts, task progress, status, dates, and proposer; degrade gracefully on unreadable changes.
- `changes-pane`: The Herdr pane TUI that displays discovered changes as a grouped tree, shows progress, previews artifacts, opens artifacts in the editor, rescans on demand, and sends or copies a Spectra command for the selected change.
- `herdr-plugin-packaging`: The plugin manifest, build step, and runtime contract that let Herdr install, link, and launch the pane, including how the project root and invoking pane are resolved from the Herdr invocation context.

### Modified Capabilities

(none)

## Impact

- Affected specs: `change-discovery`, `changes-pane`, `herdr-plugin-packaging` (all new)
- Affected code:
  - New: `herdr-plugin.toml`
  - New: `package.json`, `tsconfig.json`
  - New: `src/pane.tsx` (pane entry point)
  - New: `src/discovery/scan.ts`, `src/discovery/git-dir.ts`, `src/discovery/task-progress.ts`, `src/discovery/metadata.ts`, `src/discovery/types.ts`
  - New: `src/herdr/context.ts`, `src/herdr/client.ts`, `src/herdr/clipboard.ts`
  - New: `src/tui/App.tsx`, `src/tui/ChangeTree.tsx`, `src/tui/Preview.tsx`, `src/tui/StatusBar.tsx`, `src/tui/keymap.ts`
  - New: `test/discovery/*.test.ts`, `test/herdr/*.test.ts`, `test/tui/*.test.tsx`
  - Modified: (none)
  - Removed: (none)
- Dependencies: Node.js 20 or newer at install time and runtime, `ink`, `react`, `yaml`, `vitest`, `typescript`. Herdr version that supports `[[panes]]`, `[[actions]]`, and `pane send-text`.
- Runtime contract: reads `HERDR_BIN_PATH`, `HERDR_PANE_ID`, `HERDR_WORKSPACE_ID`, and `HERDR_PLUGIN_CONTEXT_JSON` injected by Herdr; falls back to the current working directory when no workspace context is present.
