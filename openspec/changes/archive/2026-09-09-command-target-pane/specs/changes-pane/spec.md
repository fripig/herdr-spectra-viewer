## MODIFIED Requirements

### Requirement: Send a Spectra command for the selected change

The pane SHALL bind five keys to Spectra commands applied to the selected change: `d` for `/spectra-discuss`, `a` for `/spectra-apply`, `i` for `/spectra-ingest`, `r` for `/spectra-archive`, and `c` for `/spectra-commit`. The pane SHALL NOT offer `/spectra-propose`, because that command creates a change rather than acting on an existing one. The status bar SHALL list these five keys with their command names in that order.

The selected change SHALL be the change node under the cursor, or the change that owns the artifact node under the cursor. When the cursor is on a group node, the five keys SHALL do nothing and the status bar SHALL show `Select a change first`.

The command text SHALL be a single line consisting of the slash command name, one space, and the change name, with no trailing newline. It SHALL NOT include the group, the task progress counts, or the proposer.

When the invocation context has a command target pane id, invoking a command key SHALL ask the Herdr adapter to write the command text into that pane without submitting it, and on success the plugin pane SHALL exit with code 0 so the overlay closes and focus returns to that pane. The pane the plugin itself runs in SHALL NOT be used as the destination unless it is also the command target pane. When the invocation context has no command target pane id, or when the adapter reports a failure, the command text SHALL be written to the system clipboard, the plugin pane SHALL stay open, and the status bar SHALL show `Copied: <command text>` for the no-pane case or `Herdr send failed, copied instead` for the failure case. When the clipboard write also fails, the status bar SHALL show `Copy failed: <command text>`.

Invoking any command key SHALL NOT run a file system scan, and the tree SHALL keep its expansion state.

#### Scenario: Send a command to the invoking pane

- **GIVEN** the invocation context has pane id `p1` and command target pane id `p1`, and the cursor is on change `add-search` under Active
- **WHEN** the user presses `a`
- **THEN** the adapter is asked to send the text `/spectra-apply add-search` to pane `p1` without a newline, and the plugin pane exits with code 0

#### Scenario: Send a command from a plugin pane opened by an action

- **GIVEN** the invocation context has pane id `w4:p1C` and command target pane id `w4:p1`, and the cursor is on change `add-search`
- **WHEN** the user presses `a`
- **THEN** the adapter is asked to send `/spectra-apply add-search` to pane `w4:p1`, nothing is sent to `w4:p1C`, and the plugin pane exits with code 0

#### Scenario: The artifact's owning change is used

- **GIVEN** the cursor is on artifact `tasks.md` of change `add-search`
- **WHEN** the user presses `i`
- **THEN** the command text is `/spectra-ingest add-search`

#### Scenario: Fall back to the clipboard when no pane id is known

- **GIVEN** the invocation context has no command target pane id, and the cursor is on change `add-search`
- **WHEN** the user presses `c`
- **THEN** the clipboard contains exactly `/spectra-commit add-search`, the pane stays open, and the status bar shows `Copied: /spectra-commit add-search`

#### Scenario: Sending to the pane fails

- **GIVEN** the invocation context has command target pane id `p1` and the adapter reports a failure on send
- **WHEN** the user presses `d` on change `add-search`
- **THEN** the clipboard contains `/spectra-discuss add-search`, the pane stays open, and the status bar shows `Herdr send failed, copied instead`

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

##### Example: destination pane per context

| Pane id  | Command target pane id | Destination           |
| -------- | ---------------------- | --------------------- |
| `w4:p1C` | `w4:p1`                | `w4:p1`               |
| `p1`     | `p1`                   | `p1`                  |
| null     | null                   | clipboard, pane stays |
