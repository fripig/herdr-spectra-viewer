## MODIFIED Requirements

### Requirement: Provide a Spectra changes pane

The plugin SHALL provide a Herdr pane with entrypoint id `changes` that renders a terminal UI listing Spectra changes. The pane SHALL run one scan of the resolved project root when it starts, and SHALL exit with code 0 when the user presses `q` or Escape. Those two keys SHALL be the only ways the pane exits on its own: sending a command SHALL NOT end the process. Before rendering its first frame the pane SHALL enable terminal mouse reporting by writing `ESC[?1000h` followed by `ESC[?1006h` to stdout. On every exit path, including `q`, Escape, SIGINT, SIGTERM, and SIGHUP, the pane SHALL disable mouse reporting by writing `ESC[?1006l` followed by `ESC[?1000l` before the process ends.

On every one of those exit paths the pane SHALL also close the viewer pane it remembers, so no viewer pane outlives the pane that opened it. The close SHALL run synchronously, because a pane closed by Herdr leaves the process only a signal handler's worth of time. The remembered pane id SHALL be cleared by the close, so an exit path that runs after another one issues no second close. When no viewer pane is remembered, the exit path SHALL issue no close. The outcome of the close SHALL be ignored: a non-zero exit, a not-found error for a viewer that has already gone, and a failure to run Herdr at all SHALL NOT change the process exit code, SHALL NOT be written to stderr, and SHALL NOT prevent the process from ending.

#### Scenario: Pane opens and scans

- **WHEN** Herdr launches the `changes` pane in a workspace whose project root contains an `openspec` directory
- **THEN** a scan runs and the tree is populated from its result

#### Scenario: Pane exits on request

- **WHEN** the user presses `q` or Escape
- **THEN** the pane process exits with code 0

#### Scenario: Sending a command is not an exit path

- **GIVEN** the cursor is on a change and the command target pane accepts the text
- **WHEN** the user presses a command key
- **THEN** the process does not exit and the tree stays on screen

#### Scenario: Quitting closes the viewer pane

- **GIVEN** an earlier open created viewer pane `p9` and it is the remembered viewer pane
- **WHEN** the user presses `q`
- **THEN** Herdr is asked to close pane `p9` before the process ends, and the process exits with code 0

#### Scenario: Exiting without a viewer pane closes nothing

- **GIVEN** no artifact has been opened since the pane started
- **WHEN** the user presses `q`
- **THEN** no close is issued and the process exits with code 0

#### Scenario: A second exit path issues no second close

- **GIVEN** an exit path has already closed remembered viewer pane `p9`
- **WHEN** another exit path runs before the process ends
- **THEN** no further close is issued

#### Scenario: The close outcome is ignored

- **GIVEN** the remembered viewer pane has already gone and Herdr reports it as not found
- **WHEN** the user presses `q`
- **THEN** nothing is written to stderr and the process exits with code 0

#### Scenario: Mouse reporting is enabled at start

- **WHEN** the pane process starts
- **THEN** it writes `ESC[?1000h` followed by `ESC[?1006h` to stdout before the first frame

#### Scenario: Mouse reporting is disabled on every exit

- **WHEN** the pane exits through `q`, Escape, SIGINT, SIGTERM, or SIGHUP
- **THEN** stdout receives `ESC[?1006l` and `ESC[?1000l` before the process ends

##### Example: exit paths

| Exit path     | Exit code | Mouse disabled | Remembered viewer pane closed |
| ------------- | --------- | -------------- | ----------------------------- |
| `q` or Escape | 0         | yes            | yes                           |
| SIGINT        | 130       | yes            | yes                           |
| SIGTERM       | 143       | yes            | yes                           |
| SIGHUP        | 129       | yes            | yes                           |

---
### Requirement: Send a Spectra command for the selected change

The pane SHALL bind five keys to Spectra commands applied to the selected change: `d` for `/spectra-discuss`, `a` for `/spectra-apply`, `i` for `/spectra-ingest`, `r` for `/spectra-archive`, and `c` for `/spectra-commit`. The pane SHALL NOT offer `/spectra-propose`, because that command creates a change rather than acting on an existing one. The status bar SHALL list these five keys with their command names in that order.

The selected change SHALL be the change node under the cursor, or the change that owns the artifact node under the cursor. When the cursor is on a group node, the five keys SHALL do nothing and the status bar SHALL show `Select a change first`.

The command text SHALL be a single line consisting of the slash command name, one space, and the change name, with no trailing newline. It SHALL NOT include the group, the task progress counts, or the proposer.

When the invocation context has a command target pane id, invoking a command key SHALL ask the Herdr adapter to write the command text into that pane without submitting it. The pane the plugin itself runs in SHALL NOT be used as the destination unless it is also the command target pane. On success the plugin pane SHALL stay open, the status bar SHALL show `Sent: <command text>`, and the pane SHALL ask the Herdr adapter to move keyboard focus to the pane on its left, so the next keystroke reaches the command that is waiting there. When the focus call reports a failure, or when the invocation context has no pane id of its own to focus from, the status bar SHALL show `Sent, but could not focus pane` instead; the send has already succeeded, so no clipboard write SHALL follow.

When the invocation context has no command target pane id, or when the adapter reports a failure on the send, the command text SHALL be written to the system clipboard, the plugin pane SHALL stay open, no focus call SHALL be made, and the status bar SHALL show `Copied: <command text>` for the no-pane case or `Herdr send failed, copied instead` for the failure case. When the clipboard write also fails, the status bar SHALL show `Copy failed: <command text>`.

Invoking any command key SHALL NOT run a file system scan, and the tree SHALL keep its expansion state.

#### Scenario: Send a command and hand focus back

- **GIVEN** the invocation context has command target pane id `p1` and its own pane id `p7`, and the cursor is on change `add-search` under Active
- **WHEN** the user presses `a`
- **THEN** the adapter is asked to send the text `/spectra-apply add-search` to pane `p1` without a newline, then to focus the pane left of `p7`, the plugin pane stays open, and the status bar shows `Sent: /spectra-apply add-search`

#### Scenario: The focus call fails after a successful send

- **GIVEN** the send to the command target pane succeeds and the adapter reports a failure on the focus call
- **WHEN** the user presses `a` on change `add-search`
- **THEN** the status bar shows `Sent, but could not focus pane`, the pane stays open, and nothing is written to the clipboard

#### Scenario: No pane of its own to focus from

- **GIVEN** the invocation context has command target pane id `p1` and no pane id of its own
- **WHEN** the user presses `a` on change `add-search`
- **THEN** the text is sent to `p1`, no focus call is made, and the status bar shows `Sent, but could not focus pane`

#### Scenario: The artifact's owning change is used

- **GIVEN** the cursor is on artifact `tasks.md` of change `add-search`
- **WHEN** the user presses `i`
- **THEN** the command text is `/spectra-ingest add-search`

#### Scenario: Fall back to the clipboard when no pane id is known

- **GIVEN** the invocation context has no command target pane id, and the cursor is on change `add-search`
- **WHEN** the user presses `c`
- **THEN** the clipboard contains exactly `/spectra-commit add-search`, no focus call is made, the pane stays open, and the status bar shows `Copied: /spectra-commit add-search`

#### Scenario: Sending to the pane fails

- **GIVEN** the invocation context has command target pane id `p1` and the adapter reports a failure on send
- **WHEN** the user presses `d` on change `add-search`
- **THEN** the clipboard contains `/spectra-discuss add-search`, no focus call is made, the pane stays open, and the status bar shows `Herdr send failed, copied instead`

#### Scenario: Command keys are inert on a group node

- **GIVEN** the cursor is on the Archived group node
- **WHEN** the user presses `r`
- **THEN** nothing is sent or copied and the status bar shows `Select a change first`

#### Scenario: The five commands are listed in workflow order

- **WHEN** the pane renders the status bar with a change selected
- **THEN** it lists `d discuss`, `a apply`, `i ingest`, `r archive`, `c commit` in that order and does not list propose

##### Example: command text per key

| Key | Change       | Command text                  |
| --- | ------------ | ----------------------------- |
| d   | `add-search` | `/spectra-discuss add-search` |
| a   | `add-search` | `/spectra-apply add-search`   |
| i   | `add-search` | `/spectra-ingest add-search`  |
| r   | `add-search` | `/spectra-archive add-search` |
| c   | `add-search` | `/spectra-commit add-search`  |

##### Example: outcome per context and adapter result

| Command target pane | Own pane | Send result | Focus result | Status bar                       | Pane stays open |
| ------------------- | -------- | ----------- | ------------ | -------------------------------- | --------------- |
| `p1`                | `p7`     | ok          | ok           | `Sent: <command text>`           | yes             |
| `p1`                | `p7`     | ok          | fails        | `Sent, but could not focus pane` | yes             |
| `p1`                | none     | ok          | not called   | `Sent, but could not focus pane` | yes             |
| `p1`                | `p7`     | fails       | not called   | `Herdr send failed, copied instead` | yes          |
| none                | `p7`     | not called  | not called   | `Copied: <command text>`         | yes             |
