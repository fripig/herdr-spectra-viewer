# herdr-plugin-packaging Specification

## Purpose

TBD - created by archiving change 'herdr-spectra-pane-core'. Update Purpose after archive.

## Requirements

### Requirement: Declare the plugin manifest

The repository root SHALL contain a `herdr-plugin.toml` manifest with id `spectra-viewer`, a name, a semantic version, and a `min_herdr_version`. The manifest SHALL declare one `[[build]]` entry that installs npm dependencies and compiles TypeScript, one `[[panes]]` entry with id `changes`, placement `overlay`, and command `["node", "dist/pane.js"]`, and one `[[actions]]` entry with id `open`, contexts `["workspace", "pane"]`, and command `["node", "dist/open.js"]`. Commands SHALL be argv arrays, because Herdr does not run them through a shell.

#### Scenario: Manifest declares the pane and the action

- **WHEN** `herdr-plugin.toml` is parsed as TOML
- **THEN** it contains a pane with id `changes` whose command is `node dist/pane.js` and an action with id `open` whose command is `node dist/open.js`

#### Scenario: Linking the plugin registers the pane

- **GIVEN** a running Herdr session
- **WHEN** the user runs `herdr plugin link` with the repository path and then `herdr plugin pane open --plugin spectra-viewer --entrypoint changes`
- **THEN** the Spectra changes pane opens as an overlay

---
### Requirement: Build produces the pane and action entry points

Running `npm run build` SHALL compile the TypeScript sources into `dist/pane.js` and `dist/open.js`, and `npm test` SHALL run the Vitest suites. The `[[build]]` entry in the manifest SHALL run `npm ci` followed by `npm run build` so that `herdr plugin install` produces a runnable plugin without manual steps.

#### Scenario: Build emits both entry points

- **WHEN** `npm run build` completes
- **THEN** `dist/pane.js` and `dist/open.js` exist and are executable by `node`

#### Scenario: Tests run from the package script

- **WHEN** `npm test` runs
- **THEN** the Vitest suites under `test/` execute and the exit code reflects their result

---
### Requirement: The open action launches the pane

Running `dist/open.js` SHALL execute the Herdr binary named by `HERDR_BIN_PATH` with the arguments `plugin pane open --plugin <HERDR_PLUGIN_ID> --entrypoint changes --placement split --direction right`, and SHALL exit with that command's exit code. The placement arguments are what put the pane beside the working pane rather than over it; the manifest's own placement stays the fallback for an invocation that passes none. No target pane SHALL be named, because Herdr splits the focused pane, which is the pane that invoked the action. When `HERDR_BIN_PATH` is unset, it SHALL print `HERDR_BIN_PATH is not set; run this action from Herdr.` to stderr and exit with code 1.

#### Scenario: Action opens the pane as a right split

- **GIVEN** `HERDR_BIN_PATH` is `/usr/local/bin/herdr` and `HERDR_PLUGIN_ID` is `spectra-viewer`
- **WHEN** `dist/open.js` runs
- **THEN** it executes `/usr/local/bin/herdr plugin pane open --plugin spectra-viewer --entrypoint changes --placement split --direction right`

#### Scenario: Action run outside Herdr

- **GIVEN** `HERDR_BIN_PATH` is unset
- **WHEN** `dist/open.js` runs
- **THEN** it prints `HERDR_BIN_PATH is not set; run this action from Herdr.` to stderr and exits with code 1


<!-- @trace
source: persistent-split-pane
updated: 2026-09-09
code:
  - src/herdr/index.ts
  - src/herdr/client.ts
  - src/open.ts
  - src/pane.tsx
  - src/tui/App.tsx
  - README.md
tests:
  - test/herdr/open.test.ts
  - test/tui/App.test.tsx
  - test/herdr/client.test.ts
-->

---
### Requirement: Resolve the invocation context from the environment

The Herdr adapter SHALL build an invocation context from the process environment. The project root SHALL be taken from the JSON in `HERDR_PLUGIN_CONTEXT_JSON` when that variable is set and parses as JSON: the `workspace_cwd` field when it holds a non-empty string, otherwise the `workspace.cwd` field when it holds a non-empty string; when neither is present the project root SHALL be the process working directory. When the variable is set but does not parse, a warning SHALL be written to stderr. The pane id SHALL be the value of `HERDR_PANE_ID` when set and non-empty, otherwise null.

The context SHALL also carry a command target pane id, which is the pane a Spectra command is written into. It SHALL be the `focused_pane_id` field of the context JSON when that field holds a non-empty string, otherwise the pane id. The pane id and the command target pane id SHALL be separate fields: the pane id identifies the pane the plugin itself runs in and is the pane used for splitting and for reading a working directory, while the command target pane id identifies the pane that invoked the plugin. The Herdr binary path SHALL be the value of `HERDR_BIN_PATH` when set and non-empty, otherwise null.

#### Scenario: Context from a Herdr invocation

- **GIVEN** `HERDR_PLUGIN_CONTEXT_JSON` is `{"workspace":{"cwd":"/repo"}}`, `HERDR_PANE_ID` is `p1`, and `HERDR_BIN_PATH` is `/usr/local/bin/herdr`
- **WHEN** the context is read
- **THEN** the project root is `/repo`, the pane id is `p1`, the command target pane id is `p1`, and the binary path is `/usr/local/bin/herdr`

#### Scenario: Context from a plugin pane opened by an action

- **GIVEN** `HERDR_PANE_ID` is `w4:p1C` and `HERDR_PLUGIN_CONTEXT_JSON` is `{"workspace_cwd":"/repo","focused_pane_id":"w4:p1"}`
- **WHEN** the context is read
- **THEN** the project root is `/repo`, the pane id is `w4:p1C`, and the command target pane id is `w4:p1`

#### Scenario: Context without Herdr

- **GIVEN** none of the Herdr environment variables are set and the process working directory is `/work`
- **WHEN** the context is read
- **THEN** the project root is `/work`, the pane id is null, the command target pane id is null, and the binary path is null

##### Example: project root resolution cases

| `HERDR_PLUGIN_CONTEXT_JSON`     | cwd     | Project root | stderr warning |
| ------------------------------- | ------- | ------------ | -------------- |
| `{"workspace_cwd":"/repo"}`     | `/work` | `/repo`      | no             |
| `{"workspace":{"cwd":"/repo"}}` | `/work` | `/repo`      | no             |
| `{"workspace_cwd":""}`          | `/work` | `/work`      | no             |
| `{"workspace":{}}`              | `/work` | `/work`      | no             |
| `not json`                      | `/work` | `/work`      | yes            |
| unset                           | `/work` | `/work`      | no             |

##### Example: command target pane resolution cases

| `HERDR_PANE_ID` | `focused_pane_id` in context JSON | Command target pane id |
| --------------- | --------------------------------- | ---------------------- |
| `w4:p1C`        | `w4:p1`                           | `w4:p1`                |
| `w4:p1C`        | absent                            | `w4:p1C`               |
| `w4:p1C`        | `""`                              | `w4:p1C`               |
| unset           | `w4:p1`                           | `w4:p1`                |
| unset           | absent                            | null                   |


<!-- @trace
source: command-target-pane
updated: 2026-09-09
code:
  - README.md
  - src/herdr/context.ts
  - src/tui/App.tsx
tests:
  - test/herdr/context.test.ts
  - test/tui/App.test.tsx
-->

---
### Requirement: Herdr adapter executes the Herdr binary without a shell

All calls to Herdr SHALL go through a `HerdrClient` whose production implementation runs the binary at the context's binary path with an argv array and no shell, returning stdout and the exit code. Sending text to a pane SHALL run `pane send-text <paneId> <text>` with the text as one argv element. Focusing the working pane SHALL run `pane focus --pane <paneId> --direction left`, where the pane id is the plugin's own pane and the direction is fixed by the right split the open action asks for. Opening an editor split SHALL run `pane split --direction right --cwd <projectRoot>`, adding `--pane <paneId>` when the invocation context has a pane id, read `result.pane.pane_id` from the JSON on stdout, then run `pane run <newPaneId> <editorCommand>` where the editor command is the editor followed by the shell-quoted absolute artifact path. Any non-zero exit or spawn error SHALL be reported to the caller as a failure result, never as a thrown exception. When the binary path is null, every adapter call SHALL report failure without spawning anything.

#### Scenario: Send text uses a single argv element

- **GIVEN** the binary path is `/x/herdr`
- **WHEN** the adapter sends `/spectra-apply add-search` to pane `p1`
- **THEN** it spawns `/x/herdr` with argv `["pane", "send-text", "p1", "/spectra-apply add-search"]` and reports success on exit code 0

#### Scenario: Focus runs one command from the plugin's own pane

- **GIVEN** the binary path is `/x/herdr`
- **WHEN** the adapter focuses the working pane from plugin pane `p7`
- **THEN** it spawns `/x/herdr` with argv `["pane", "focus", "--pane", "p7", "--direction", "left"]` and reports success on exit code 0

#### Scenario: Focus command fails

- **GIVEN** `pane focus` exits with code 2
- **WHEN** the adapter focuses the working pane from plugin pane `p7`
- **THEN** it reports failure with a reason naming the exit code and does not throw

#### Scenario: Editor split runs two commands

- **GIVEN** `pane split --direction right --cwd /repo` prints `{"result":{"pane":{"pane_id":"p9"}}}`
- **WHEN** the adapter opens `/repo/openspec/changes/add-search/design.md` with editor `nvim`
- **THEN** it then spawns `pane run p9 nvim '/repo/openspec/changes/add-search/design.md'` and reports success

#### Scenario: Split output lacks a pane id

- **GIVEN** `pane split` exits 0 but its stdout has no `result.pane.pane_id`
- **WHEN** the adapter opens an artifact
- **THEN** it reports failure and does not run `pane run`

#### Scenario: No binary path

- **GIVEN** the binary path is null
- **WHEN** any adapter call is made
- **THEN** it reports failure without spawning a process


<!-- @trace
source: persistent-split-pane
updated: 2026-09-09
code:
  - src/herdr/index.ts
  - src/herdr/client.ts
  - src/open.ts
  - src/pane.tsx
  - src/tui/App.tsx
  - README.md
tests:
  - test/herdr/open.test.ts
  - test/tui/App.test.tsx
  - test/herdr/client.test.ts
-->

---
### Requirement: Project root falls back to the invoking pane's cwd

When the invocation context did not obtain a project root from `HERDR_PLUGIN_CONTEXT_JSON` but has a pane id and a binary path, the pane entry point SHALL run `pane get <paneId>` and use the `result.pane.cwd` field as the project root when it is a non-empty string. When that call fails or the field is absent, the project root SHALL remain the process working directory.

#### Scenario: Pane cwd is used when the context JSON has no cwd

- **GIVEN** `HERDR_PLUGIN_CONTEXT_JSON` is unset, `HERDR_PANE_ID` is `p1`, and `pane get p1` prints `{"result":{"pane":{"cwd":"/repo","pane_id":"p1"}}}`
- **WHEN** the pane entry point resolves the project root
- **THEN** the project root is `/repo`

#### Scenario: Pane get fails

- **GIVEN** `HERDR_PLUGIN_CONTEXT_JSON` is unset, `HERDR_PANE_ID` is `p1`, and `pane get p1` exits non-zero
- **WHEN** the pane entry point resolves the project root
- **THEN** the project root is the process working directory

---
### Requirement: Clipboard fallback through platform commands

Writing to the clipboard SHALL run `pbcopy` on macOS. On Linux it SHALL try `wl-copy` first and `xclip -selection clipboard` second, using the first that exits with code 0. The text SHALL be written to the command's stdin without a trailing newline. When no command succeeds, the write SHALL report failure without throwing.

#### Scenario: macOS clipboard

- **GIVEN** the platform is `darwin`
- **WHEN** `/spectra-apply add-search` is written to the clipboard
- **THEN** `pbcopy` receives exactly `/spectra-apply add-search` on stdin

#### Scenario: Linux without any clipboard tool

- **GIVEN** the platform is `linux` and both `wl-copy` and `xclip` fail to spawn
- **WHEN** text is written to the clipboard
- **THEN** the write reports failure and no exception propagates