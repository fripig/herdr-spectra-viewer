# changes-pane Specification

## Purpose

TBD - created by archiving change 'herdr-spectra-pane-core'. Update Purpose after archive.

## Requirements

### Requirement: Provide a Spectra changes pane

The plugin SHALL provide a Herdr pane with entrypoint id `changes` that renders a terminal UI listing Spectra changes. The pane SHALL run one scan of the resolved project root when it starts, and SHALL exit with code 0 when the user presses `q` or Escape.

#### Scenario: Pane opens and scans

- **WHEN** Herdr launches the `changes` pane in a workspace whose project root contains an `openspec` directory
- **THEN** a scan runs and the tree is populated from its result

#### Scenario: Pane exits on request

- **WHEN** the user presses `q` or Escape
- **THEN** the pane process exits with code 0 and the overlay closes

---
### Requirement: Display changes as a grouped tree

The pane SHALL display the scan snapshot as a tree. The first level SHALL consist of exactly three group nodes labelled Active, Parked, and Archived, each followed by the number of changes in that group. The second level SHALL consist of change nodes showing the change name. The third level SHALL consist of artifact nodes showing each Markdown file path relative to its change directory.

A group node SHALL be displayed even when it contains no changes. Active SHALL be expanded when the pane starts; Parked and Archived SHALL be collapsed. A cursor SHALL mark exactly one visible node at all times, starting on the Active group node. Up and Down arrow keys, and `k` and `j`, SHALL move the cursor across visible nodes without wrapping. Right arrow and `l` SHALL expand the node under the cursor; Left arrow and `h` SHALL collapse it, or move the cursor to its parent when it is already collapsed or is a leaf.

Only the rows that fit the terminal height SHALL be rendered, and the rendered window SHALL scroll so the cursor row is always visible.

#### Scenario: Groups render with counts

- **GIVEN** a snapshot with two active changes, one parked change, and no archived changes
- **WHEN** the pane renders the snapshot
- **THEN** the tree shows `Active (2)`, `Parked (1)`, and `Archived (0)`

#### Scenario: Parked changes are visible

- **GIVEN** a change that has been parked and therefore no longer exists under `openspec/changes/`
- **WHEN** the user expands the Parked group
- **THEN** that change appears under the Parked group with its name

#### Scenario: Cursor movement stays within visible nodes

- **GIVEN** the cursor is on the last visible node
- **WHEN** the user presses Down
- **THEN** the cursor stays on that node

#### Scenario: Left on a collapsed change moves to its group

- **GIVEN** the cursor is on a collapsed change node inside Active
- **WHEN** the user presses Left
- **THEN** the cursor moves to the Active group node

#### Scenario: Cursor row stays visible in a tall tree

- **GIVEN** the tree has more visible rows than the terminal height
- **WHEN** the user moves the cursor below the last rendered row
- **THEN** the rendered window scrolls so the cursor row is rendered

---
### Requirement: Show task progress on change nodes

A change node SHALL display its completed and total task counts as `(<complete>/<total>)` after the change name when progress information is available. A change node SHALL NOT display counts when no progress information is available.

#### Scenario: Change with tasks

- **GIVEN** a change whose `tasks.md` has 3 of 8 items complete
- **WHEN** the pane renders that change node
- **THEN** the node text is the change name followed by `(3/8)`

#### Scenario: Change without tasks

- **GIVEN** a change with no counted task items
- **WHEN** the pane renders that change node
- **THEN** the node text shows the change name without task counts

---
### Requirement: Enter opens an artifact or toggles a node

The tree SHALL occupy the full pane width; there is no preview column. Pressing Enter on an artifact node SHALL behave exactly like pressing `e`: it opens that file in the editor split. Enter on a group or change node SHALL toggle that node's expansion. When the file no longer exists at the time Enter is pressed, the status bar SHALL show `File not found: <relative path>`, no editor SHALL be opened, and the pane SHALL remain usable.

#### Scenario: Enter on an artifact opens the editor

- **GIVEN** the cursor is on the artifact node `design.md` of change `add-search`
- **WHEN** the user presses Enter
- **THEN** the pane asks Herdr to open that file in the editor split, as if `e` had been pressed

#### Scenario: Enter on a change node toggles expansion

- **GIVEN** the cursor is on a collapsed change node
- **WHEN** the user presses Enter
- **THEN** the change node expands and no editor is opened

#### Scenario: Enter on a deleted artifact

- **GIVEN** the cursor is on an artifact node whose file has been deleted since the last scan
- **WHEN** the user presses Enter
- **THEN** the status bar shows `File not found: <relative path>`, no editor is opened, and the tree is unchanged

---
### Requirement: Open an artifact in the editor

Pressing `e` on an artifact node SHALL open that file in the user's editor in a new pane split to the right of the pane that invoked the plugin, using the Herdr adapter. The editor command SHALL be the value of the `EDITOR` environment variable, or `vi` when it is unset or empty. The status bar SHALL show `Opened in <editor command>` on success. The plugin pane SHALL stay open afterwards. When the file does not exist, the status bar SHALL show `File not found: <relative path>` and no split SHALL be created. When the adapter reports a failure, the status bar SHALL show `Could not open editor` and nothing else SHALL change. Pressing `e` on a group or change node SHALL do nothing.

#### Scenario: Open an artifact in the editor split

- **GIVEN** `EDITOR` is `nvim` and the cursor is on artifact `proposal.md` of change `add-search`
- **WHEN** the user presses `e`
- **THEN** the adapter is asked to split a pane and run `nvim` with the artifact's absolute path, and the status bar shows `Opened in nvim`

#### Scenario: Editor falls back to vi

- **GIVEN** `EDITOR` is unset
- **WHEN** the user presses `e` on an artifact node
- **THEN** the adapter runs `vi` with the artifact's absolute path

#### Scenario: Editor split fails

- **GIVEN** the adapter reports that the split could not be created
- **WHEN** the user presses `e` on an artifact node
- **THEN** the status bar shows `Could not open editor` and the tree is unchanged

---
### Requirement: Rescan on demand

Pressing `R` SHALL trigger a new scan and rebuild the tree from the resulting snapshot. Expansion state of group and change nodes that still exist SHALL be preserved across the rebuild, and the cursor SHALL stay on the same node when it still exists, otherwise on the nearest group node above it.

#### Scenario: Rescan reflects a newly parked change

- **GIVEN** the pane shows a change under the Active group
- **WHEN** the change is parked outside the pane and the user presses `R`
- **THEN** the change appears under the Parked group and no longer under the Active group

#### Scenario: Expansion state survives rescan

- **GIVEN** the user has expanded the Parked group and one change node inside it
- **WHEN** the user presses `R` and those nodes still exist
- **THEN** the Parked group and that change node are expanded again

#### Scenario: Cursor survives removal of its node

- **GIVEN** the cursor is on change `add-search` under Active
- **WHEN** the user presses `R` and `add-search` no longer exists in Active
- **THEN** the cursor is on the Active group node

---
### Requirement: Indicate loading, empty, and warning states

While a scan is running, the tree area SHALL show `Scanning…`. When the project root has no `openspec` directory, the pane SHALL replace the tree with the message `This project is not initialised for Spectra (no openspec directory).` and the status bar SHALL still show the quit key. When the snapshot's warning list is non-empty, the status bar SHALL show `<N> change(s) skipped` where N is the number of warnings.

#### Scenario: Loading indicator

- **WHEN** a scan is in progress
- **THEN** the tree area shows `Scanning…`

#### Scenario: Project without Spectra

- **GIVEN** a project root with no `openspec` directory
- **WHEN** the pane starts
- **THEN** the message `This project is not initialised for Spectra (no openspec directory).` is shown instead of the tree

#### Scenario: Skipped changes are counted in the status bar

- **GIVEN** a scan whose warning list has two entries
- **WHEN** the pane renders the snapshot
- **THEN** the status bar shows `2 change(s) skipped`

---
### Requirement: Send a Spectra command for the selected change

The pane SHALL bind five keys to Spectra commands applied to the selected change: `d` for `/spectra-discuss`, `a` for `/spectra-apply`, `i` for `/spectra-ingest`, `r` for `/spectra-archive`, and `c` for `/spectra-commit`. The pane SHALL NOT offer `/spectra-propose`, because that command creates a change rather than acting on an existing one. The status bar SHALL list these five keys with their command names in that order.

The selected change SHALL be the change node under the cursor, or the change that owns the artifact node under the cursor. When the cursor is on a group node, the five keys SHALL do nothing and the status bar SHALL show `Select a change first`.

The command text SHALL be a single line consisting of the slash command name, one space, and the change name, with no trailing newline. It SHALL NOT include the group, the task progress counts, or the proposer.

When the invocation context has a pane id, invoking a command key SHALL ask the Herdr adapter to write the command text into that pane without submitting it, and on success the plugin pane SHALL exit with code 0 so the overlay closes and focus returns to that pane. When the invocation context has no pane id, or when the adapter reports a failure, the command text SHALL be written to the system clipboard, the plugin pane SHALL stay open, and the status bar SHALL show `Copied: <command text>` for the no-pane case or `Herdr send failed, copied instead` for the failure case. When the clipboard write also fails, the status bar SHALL show `Copy failed: <command text>`.

Invoking any command key SHALL NOT run a file system scan, and the tree SHALL keep its expansion state.

#### Scenario: Send a command to the invoking pane

- **GIVEN** the invocation context has pane id `p1`, and the cursor is on change `add-search` under Active
- **WHEN** the user presses `a`
- **THEN** the adapter is asked to send the text `/spectra-apply add-search` to pane `p1` without a newline, and the plugin pane exits with code 0

#### Scenario: The artifact's owning change is used

- **GIVEN** the cursor is on artifact `tasks.md` of change `add-search`
- **WHEN** the user presses `i`
- **THEN** the command text is `/spectra-ingest add-search`

#### Scenario: Fall back to the clipboard when no pane id is known

- **GIVEN** the invocation context has no pane id, and the cursor is on change `add-search`
- **WHEN** the user presses `c`
- **THEN** the clipboard contains exactly `/spectra-commit add-search`, the pane stays open, and the status bar shows `Copied: /spectra-commit add-search`

#### Scenario: Sending to the pane fails

- **GIVEN** the invocation context has pane id `p1` and the adapter reports a failure on send
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
