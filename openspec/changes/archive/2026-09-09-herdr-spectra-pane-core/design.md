## Context

Herdr is a terminal workspace manager. A Herdr plugin is a directory holding a `herdr-plugin.toml` manifest plus any executable Herdr can launch. There is no plugin SDK: a plugin pane is an ordinary terminal running the plugin's command as a TUI, and the plugin talks back to Herdr by executing the binary named in `HERDR_BIN_PATH`. Herdr injects the invocation context through environment variables (`HERDR_PANE_ID`, `HERDR_WORKSPACE_ID`, `HERDR_PLUGIN_CONTEXT_JSON`, and others).

The behaviour being ported comes from the idea-spectra-viewer IntelliJ plugin, whose specs are at [openspec/specs](https://github.com/fripig/idea-spectra-viewer/tree/main/openspec/specs). That plugin has two capabilities: `change-discovery` (file-system scan, pure logic) and `changes-tool-window` (Swing tree, editor integration, terminal integration). The discovery logic carries over unchanged. The tool-window behaviour has to be re-expressed for a keyboard-driven TUI and for Herdr's pane model.

This repository is currently empty apart from the Spectra configuration. The discussion that produced this design is recorded in `openspec/notes/2026-09-08-herdr-plugin-discussion.md`.

## Goals / Non-Goals

**Goals:**

- A Herdr user can open an overlay pane that lists Spectra changes grouped as Active, Parked, and Archived, with task progress per change.
- The user can preview any artifact Markdown file inside the pane and open it in their editor in a split pane.
- The user can hand a `/spectra-*` command for the selected change to the pane they were working in, without executing it, in one keystroke.
- The plugin installs with `herdr plugin install` and links with `herdr plugin link` with no manual steps beyond having Node.js available.
- The discovery module is testable without Herdr, and the Herdr adapter is testable without a live Herdr.

**Non-Goals:**

- Sorting, name filtering, author filtering, proposer display on nodes, and copying change names. These are the second change (`herdr-spectra-pane-actions`). The discovery module still reports proposer and dates so that change needs no discovery work.
- Executing the Spectra command. The pane only writes the text; the user presses Enter.
- Detecting or targeting AI agent panes through `herdr agent list`. Rejected: multi-agent workspaces would need a chooser and the invoking pane already matches the IDE semantics of "the selected terminal tab".
- Syntax highlighting or rendering of Markdown in the preview. The preview shows raw Markdown text.
- Watching the file system for changes. Rescan is manual, plus one scan at every pane start.
- Windows support. Clipboard fallback and editor launch are specified for macOS and Linux only; other platforms are not exercised.

## Decisions

### Node.js with Ink for the pane TUI

The pane is a Node.js program rendered with Ink (React for terminals). Herdr's own plugin examples use Node, and the scanning logic in the IntelliJ plugin is small imperative Kotlin that ports to TypeScript almost line for line. Alternatives considered: Rust with ratatui (single binary, no runtime, but two to three times the implementation effort and a slow `cargo build` at install time); Go with Bubble Tea (single binary but the author has no Go code to reuse); Bash with fzf (cannot express a three-level tree with progress and preview).

Ink's `useInput` hook handles keyboard events, and its `Box` and `Text` primitives are enough for a two-column layout: tree on the left, preview on the right. The TUI never blocks on file system access: scanning runs through Node's promise-based `fs` API and the tree renders a loading indicator until the promise resolves.

### Three-layer module split: discovery, herdr adapter, tui

- `src/discovery/` holds the port of `change-discovery`. It exports `scanChanges(projectRoot): Promise<ScanSnapshot>` and depends only on Node's `fs` and `path` plus a YAML parser. It knows nothing about Herdr or Ink.
- `src/herdr/` is the only module that executes the Herdr binary. It exports `readInvocationContext(env): InvocationContext`, `sendTextToPane(client, paneId, text)`, `openInEditorSplit(client, cwd, filePath)`, and `copyToClipboard(text)`. All Herdr calls go through a `HerdrClient` interface with one production implementation (spawns `HERDR_BIN_PATH` with `execFile`) and one fake for tests.
- `src/tui/` holds Ink components and the keymap. It receives the snapshot and the adapter as props, so components are testable with `ink-testing-library` and a fake client.

The deletion test from the discussion: removing `src/herdr/` breaks sending commands and opening the editor but leaves discovery and rendering intact. Removing `src/discovery/` breaks everything, which is correct because it is the core.

### Resolve the project root from the workspace cwd

The scan root is taken in this order: the `workspace.cwd` field of `HERDR_PLUGIN_CONTEXT_JSON` when that variable parses and contains it; otherwise the `cwd` field returned by `herdr pane get <HERDR_PANE_ID>` when a pane id and binary are known (verified against Herdr 0.9.0: `workspace get` carries no cwd, but `pane get` does); otherwise the current working directory of the pane process. Herdr creates each Git worktree as its own workspace, so the workspace cwd is the right root even inside a worktree. The `.git` file worktree indirection from the IntelliJ spec is still needed so parked changes, which live under the common git directory, are found from a worktree checkout.

### Send the command to the invoking pane and never submit it

When `HERDR_PANE_ID` is present, a Spectra command is delivered by running `herdr pane send-text <HERDR_PANE_ID> "<command text>"`. `send-text` inserts text without submitting, which matches the IntelliJ requirement that the user presses Enter. After a successful send, the plugin exits so the overlay closes and focus returns to the pane that now holds the text. When `HERDR_PANE_ID` is absent, or when `send-text` fails, the text is written to the system clipboard instead, the pane stays open, and the status bar reports which of the two happened. Alternative rejected: always copying to the clipboard, which wastes Herdr's ability to write directly into the pane.

### Clipboard through platform commands

The clipboard fallback runs `pbcopy` on macOS and tries `wl-copy` then `xclip -selection clipboard` on Linux. If none of those executables succeed, the status bar shows the command text itself so the user can select it manually. No npm clipboard dependency is used because each one wraps the same commands.

### Open the editor in a split pane with two Herdr calls

Herdr's `pane split` creates a shell pane and prints JSON (`result.pane.pane_id`; there is no `--json` flag, JSON is the default output, verified against Herdr 0.9.0), and `pane run <id> <command>` executes a command there. Opening an artifact in the editor is therefore `herdr pane split --pane <HERDR_PANE_ID> --direction right --cwd <projectRoot>` (the `--pane` option is omitted when no pane id is known) followed by `herdr pane run <newPaneId> "$EDITOR <absoluteArtifactPath>"`, where the editor command comes from the `EDITOR` environment variable, falling back to `vi`. The artifact path is quoted for the shell running in that pane. The overlay stays open after this so the user can keep browsing. Alternative rejected: opening a new tab, which takes the user away from the working pane.

### Keymap for the core change

| Key | Action |
| --- | --- |
| Up / Down, k / j | Move the cursor across visible nodes |
| Right / Left, l / h | Expand or collapse the node under the cursor |
| Enter | On an artifact node, show its content in the preview column |
| e | On an artifact node, open it in the editor split |
| R | Rescan |
| d, a, i, r, c | Send `/spectra-discuss`, `/spectra-apply`, `/spectra-ingest`, `/spectra-archive`, `/spectra-commit` for the change under the cursor or the change owning the artifact under the cursor |
| q, Esc | Exit the pane |

The five command keys follow the workflow order used by the IntelliJ submenu. `/spectra-propose` is deliberately absent because it creates a change rather than acting on one.

### Manifest declares one pane and one action

`herdr-plugin.toml` declares: `[[build]]` running `npm ci` then `npm run build`; `[[panes]]` with id `changes`, title `Spectra changes`, placement `overlay`, command `["node", "dist/pane.js"]` (no width or height: Herdr 0.9.0 accepts those only for `popup` placement); and `[[actions]]` with id `open`, title `Open Spectra changes`, contexts `["workspace", "pane"]`, command `["node", "dist/open.js"]`, whose script calls `herdr plugin pane open --plugin <HERDR_PLUGIN_ID> --entrypoint changes`. The action exists so users can bind a key to it in their Herdr config.

## Implementation Contract

**Behavior**

- Running `node dist/pane.js` inside a project with an `openspec/` directory renders three group nodes with counts, expandable to change nodes with `<name> (<complete>/<total>)` when progress exists, expandable to artifact nodes.
- Running it in a directory without `openspec/` renders the message `This project is not initialised for Spectra (no openspec directory).` and nothing else besides the status bar.
- While a scan runs, the tree area shows `Scanning…`.
- Pressing a command key on a change node with `HERDR_PANE_ID=p1` and `HERDR_BIN_PATH=/x/herdr` executes `/x/herdr pane send-text p1 "/spectra-apply <name>"` and then exits with code 0.
- Pressing the same key without `HERDR_PANE_ID` writes `/spectra-apply <name>` to the clipboard, keeps the pane open, and shows `Copied: /spectra-apply <name>` in the status bar.

**Interface / data shape**

```ts
type ChangeGroup = "active" | "parked" | "archived";
type ChangeStatus = "draft" | "not-started" | "in-progress" | "complete";
interface TaskProgress { complete: number; total: number }
interface SpectraChange {
  name: string; group: ChangeGroup; directory: string;
  artifacts: string[];                 // relative to directory, sorted as strings
  progress: TaskProgress | null; status: ChangeStatus;
  createdAt: string | null;            // ISO date from .openspec.yaml
  modifiedAt: number | null;           // epoch ms of newest .md file
  proposer: string | null;
}
interface ScanSnapshot { active: SpectraChange[]; parked: SpectraChange[]; archived: SpectraChange[]; warnings: string[] }
interface InvocationContext { projectRoot: string; paneId: string | null; herdrBin: string | null }
interface HerdrClient { run(args: string[]): Promise<{ stdout: string; exitCode: number }> }
```

- `scanChanges(projectRoot)` never rejects for a readable project root; per-change failures are appended to `warnings` and the change is omitted.
- The status bar shows the last warning count as `N change(s) skipped` when `warnings` is non-empty.

**Failure modes**

- `send-text` non-zero exit or spawn error: fall back to clipboard, keep the pane open, status bar shows `Herdr send failed, copied instead`.
- Clipboard command missing or failing: status bar shows `Copy failed: <command text>`.
- Artifact file deleted between scan and Enter or e: status bar shows `File not found: <relative path>`, pane stays usable, no throw.
- `HERDR_PLUGIN_CONTEXT_JSON` unparsable: log to stderr, use `process.cwd()`.
- `pane split` or `pane run` fails: status bar shows `Could not open editor`, nothing else changes.

**Acceptance criteria**

- `npm test` passes with Vitest suites covering every requirement in the three specs: `test/discovery/scan.test.ts`, `test/discovery/git-dir.test.ts`, `test/discovery/task-progress.test.ts`, `test/discovery/metadata.test.ts`, `test/herdr/context.test.ts`, `test/herdr/client.test.ts`, `test/tui/App.test.tsx`.
- `npm run build` produces `dist/pane.js` and `dist/open.js`.
- `herdr plugin link <repo>` followed by `herdr plugin pane open --plugin spectra-viewer --entrypoint changes` opens the pane in a running Herdr session, verified manually against this repository.

**Scope boundaries**

- In scope: everything in the three specs of this change, the manifest, build, and test setup.
- Out of scope: the keymap entries for sort, filter, author, and copy-name; any spec for those; publishing to the Herdr marketplace; README beyond an install paragraph.

## Risks / Trade-offs

- [Herdr CLI JSON shapes for `pane split` and `workspace get` are documented only partially] → The adapter parses only the fields named in this design (`result.pane.pane_id`, `workspace.cwd`) and tolerates absence by falling back; the manual acceptance step confirms the real shapes before the change is archived.
- [Ink re-renders the whole tree on every keypress, which flickers on very large archives] → Only visible rows are rendered by windowing the node list to the terminal height; archives with hundreds of changes stay responsive.
- [`send-text` behaviour with multi-line or shell-special text] → Command text is always a single line built from a slash command and a directory name, so no escaping beyond passing it as a separate argv element is needed.
- [Users without `EDITOR` set get `vi`] → The status bar shows which editor command was launched so the fallback is visible.
- [Node.js absent on the install machine] → `npm ci` in `[[build]]` fails with a clear error; the README install paragraph states the Node 20 requirement.

## Migration Plan

Not applicable: this is a new plugin with no existing installations. Rollback is `herdr plugin unlink` or `herdr plugin uninstall spectra-viewer`.

## Open Questions

- `min_herdr_version` in the manifest is set to the lowest version that documents `[[panes]]`; confirm the exact number against the installed Herdr during the manual acceptance step.
