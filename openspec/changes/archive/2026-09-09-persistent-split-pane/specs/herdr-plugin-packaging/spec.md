## MODIFIED Requirements

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
