# changes-pane Specification

## Purpose

TBD - created by archiving change 'herdr-spectra-pane-core'. Update Purpose after archive.

## Requirements

### Requirement: Provide a Spectra changes pane

The plugin SHALL provide a Herdr pane with entrypoint id `changes` that renders a terminal UI listing Spectra changes. The pane SHALL run one scan of the resolved project root when it starts, and SHALL exit with code 0 when the user presses `q` or Escape. Before rendering its first frame the pane SHALL enable terminal mouse reporting by writing `ESC[?1000h` followed by `ESC[?1006h` to stdout. On every exit path, including `q`, Escape, exit after sending a command, SIGINT, and SIGTERM, the pane SHALL disable mouse reporting by writing `ESC[?1006l` followed by `ESC[?1000l` before the process ends.

#### Scenario: Pane opens and scans

- **WHEN** Herdr launches the `changes` pane in a workspace whose project root contains an `openspec` directory
- **THEN** a scan runs and the tree is populated from its result

#### Scenario: Pane exits on request

- **WHEN** the user presses `q` or Escape
- **THEN** the pane process exits with code 0 and the overlay closes

#### Scenario: Mouse reporting is enabled at start

- **WHEN** the pane process starts
- **THEN** stdout receives `ESC[?1000h` and `ESC[?1006h` before the first rendered frame

#### Scenario: Mouse reporting is disabled on every exit

- **WHEN** the pane exits through `q`, Escape, a successful command send, SIGINT, or SIGTERM
- **THEN** stdout receives `ESC[?1006l` and `ESC[?1000l` before the process ends


<!-- @trace
source: mouse-support
updated: 2026-09-09
code:
  - src/pane.tsx
  - src/tui/App.tsx
  - src/tui/mouse.ts
  - README.md
tests:
  - test/tui/App.test.tsx
  - test/tui/mouse.test.ts
  - test/tui/mouse-lifecycle.test.ts
-->

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

Pressing `e` on an artifact node SHALL open that file in the user's viewer in a new pane split to the right of the pane that invoked the plugin, using the Herdr adapter. The viewer command SHALL be the value of the `SPECTRA_VIEWER` environment variable with surrounding whitespace removed, or `less` when that variable is unset, empty, or whitespace only. The `EDITOR` environment variable SHALL NOT be consulted. The command run in the new pane SHALL be the viewer command, followed by the shell-quoted absolute path of the artifact, followed by a shell statement separator and the `exit` builtin, so the pane closes once the viewer ends, whether the viewer ended successfully or with an error. The status bar SHALL show `Opened in <viewer command>` on success. The plugin pane SHALL stay open afterwards. When the file does not exist, the status bar SHALL show `File not found: <relative path>` and no split SHALL be created. When the adapter reports a failure, the status bar SHALL show `Could not open viewer` and nothing else SHALL change. Pressing `e` on a group or change node SHALL do nothing.

#### Scenario: Open an artifact in the viewer split

- **GIVEN** `SPECTRA_VIEWER` is unset and the cursor is on artifact `proposal.md` of change `add-search`
- **WHEN** the user presses `e`
- **THEN** the adapter is asked to split a pane and to run a command that starts with `less`, carries the artifact's shell-quoted absolute path, and ends with the `exit` builtin, and the status bar shows `Opened in less`

#### Scenario: The viewer command comes from SPECTRA_VIEWER

- **GIVEN** `SPECTRA_VIEWER` is `nvim`
- **WHEN** the user presses `e` on an artifact node
- **THEN** the adapter runs a command that starts with `nvim`, carries the artifact's shell-quoted absolute path, and ends with the `exit` builtin, and the status bar shows `Opened in nvim`

#### Scenario: EDITOR no longer selects the viewer

- **GIVEN** `EDITOR` is `nvim` and `SPECTRA_VIEWER` is unset
- **WHEN** the user presses `e` on an artifact node
- **THEN** the adapter runs `less`, not `nvim`

##### Example: resolved viewer command

| SPECTRA_VIEWER | EDITOR | resolved viewer |
| -------------- | ------ | --------------- |
| unset          | unset  | `less`          |
| unset          | `nvim` | `less`          |
| `nvim`         | unset  | `nvim`          |
| `nvim`         | `vi`   | `nvim`          |
| `   `          | `nvim` | `less`          |
| `  bat  `      | unset  | `bat`           |

#### Scenario: The viewer pane closes itself

- **GIVEN** the user opened an artifact and the viewer is running in the split pane
- **WHEN** the viewer process ends
- **THEN** the shell in that pane ends as well, so Herdr reclaims the pane without any further call from the plugin, and the changes pane is unchanged

#### Scenario: A failing viewer still leaves no pane behind

- **GIVEN** `SPECTRA_VIEWER` names a command that does not exist
- **WHEN** the user presses `e` on an artifact node
- **THEN** the command run in the split pane still ends with the `exit` builtin, so the pane closes

#### Scenario: Viewer split fails

- **GIVEN** the adapter reports that the split could not be created
- **WHEN** the user presses `e` on an artifact node
- **THEN** the status bar shows `Could not open viewer` and the tree is unchanged


<!-- @trace
source: viewer-pager
updated: 2026-09-09
code:
  - README.md
  - src/herdr/client.ts
  - src/tui/App.tsx
  - src/pane.tsx
  - src/tui/mouse.ts
tests:
  - test/tui/mouse.test.ts
  - test/tui/App.test.tsx
  - test/herdr/client.test.ts
  - test/tui/mouse-lifecycle.test.ts
  - test/tui/viewer.test.ts
-->

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

---
### Requirement: Parse SGR mouse reports from input

The pane SHALL recognise SGR-encoded mouse reports of the form `ESC[<button;col;rowM` (press or wheel) and `ESC[<button;col;rowm` (release), with 1-based column and row, anywhere in an input chunk, and SHALL turn each into a mouse event: button 0 with `M` is a press, any button with `m` is a release, button 64 is wheel-up, button 65 is wheel-down. Reports with any other button SHALL be dropped. Input containing only a partial report SHALL produce no event. A mouse report SHALL NOT be interpreted as a keyboard key: in particular it SHALL NOT trigger the Escape exit or any command key.

#### Scenario: Probe samples parse to events

- **WHEN** the input chunk contains one SGR report
- **THEN** exactly one event with the corresponding kind, column, and row is produced

##### Example: reports observed in Herdr 0.9.0

| Input           | Kind       | col | row |
| --------------- | ---------- | --- | --- |
| `ESC[<0;17;18M` | press      | 17  | 18  |
| `ESC[<0;17;18m` | release    | 17  | 18  |
| `ESC[<64;10;21M` | wheel-up  | 10  | 21  |
| `ESC[<65;10;21M` | wheel-down | 10 | 21  |
| `ESC[<32;9;5M`  | dropped    | –   | –   |
| `ESC[<0;17`     | no event   | –   | –   |

#### Scenario: A mouse report never quits the pane

- **GIVEN** the pane is running
- **WHEN** stdin delivers `ESC[<0;17;18M`
- **THEN** the process keeps running and no command is sent or copied


<!-- @trace
source: mouse-support
updated: 2026-09-09
code:
  - src/pane.tsx
  - src/tui/App.tsx
  - src/tui/mouse.ts
  - README.md
tests:
  - test/tui/App.test.tsx
  - test/tui/mouse.test.ts
  - test/tui/mouse-lifecycle.test.ts
-->

---
### Requirement: Select, toggle, and open by clicking the tree

A press whose row falls on a rendered tree row and whose column falls within the tree column SHALL move the cursor to that row. When the press falls within the two marker cells of that row (the cells immediately after the row's indent where the expand arrow is drawn) and the row is a group or change node, the pane SHALL toggle that node's expansion in addition to moving the cursor. When the press falls outside the marker cells and the row is an artifact node, the pane SHALL open that artifact in the viewer split exactly as Enter and `e` do, including showing `File not found: <relative path>` when the file is missing. A press on a tree row with no node, on the status bar, or on any row above the tree SHALL do nothing. Releases SHALL be ignored. The row-to-node mapping SHALL account for the tree's top offset and current window start, so it stays correct when rows are rendered above the tree or the window is scrolled.

#### Scenario: Click moves the cursor

- **GIVEN** the tree renders `Active (2)` on its first row and `add-search (3/8)` on its second
- **WHEN** the user presses the left button on the second row, on the label
- **THEN** the cursor is on `add-search` and its expansion is unchanged

#### Scenario: Click on the marker toggles expansion

- **GIVEN** the cursor is on `Active (2)`, which is expanded
- **WHEN** the user presses the left button on the first row within its marker cells
- **THEN** Active collapses and the cursor stays on it

#### Scenario: Click on an artifact opens it in the viewer

- **GIVEN** `design.md` of `add-search` is rendered on the third row
- **WHEN** the user presses the left button on the third row, on the label
- **THEN** the cursor is on `design.md`, the viewer adapter is asked to open that file, and the status bar shows `Opened in <viewer command>`

#### Scenario: Click on a missing artifact reports it

- **GIVEN** an artifact node is rendered whose file has been deleted since the last scan
- **WHEN** the user presses the left button on that row, on the label
- **THEN** the status bar shows `File not found: <relative path>`, no viewer is opened, and the tree is unchanged

#### Scenario: Click below the last node does nothing

- **GIVEN** the tree has three rows
- **WHEN** the user presses the left button on the eighth row inside the tree column
- **THEN** the cursor and expansion state are unchanged

#### Scenario: Click accounts for scrolled window and rows above the tree

- **GIVEN** one row is rendered above the tree and the window starts at row index 5
- **WHEN** the user presses the left button on the second rendered tree row
- **THEN** the cursor moves to the node at row index 6

##### Example: row mapping

| treeTop | windowStart | pressed terminal row | node row index |
| ------- | ----------- | -------------------- | -------------- |
| 0       | 0           | 1                    | 0              |
| 0       | 0           | 3                    | 2              |
| 1       | 0           | 1                    | none           |
| 1       | 5           | 3                    | 6              |


<!-- @trace
source: viewer-pager
updated: 2026-09-09
code:
  - README.md
  - src/herdr/client.ts
  - src/tui/App.tsx
  - src/pane.tsx
  - src/tui/mouse.ts
tests:
  - test/tui/mouse.test.ts
  - test/tui/App.test.tsx
  - test/herdr/client.test.ts
  - test/tui/mouse-lifecycle.test.ts
  - test/tui/viewer.test.ts
-->

---
### Requirement: Scroll with the mouse wheel

A wheel-up or wheel-down event whose row falls within the tree rows SHALL move the cursor up or down by one row, with the same bounds and window behaviour as the Up and Down keys. Wheel events on the status bar or on any row above the tree SHALL do nothing.

#### Scenario: Wheel over the tree moves the cursor

- **GIVEN** the cursor is on `Active (2)`
- **WHEN** a wheel-down event arrives inside the tree rows
- **THEN** the cursor is on the next visible row

#### Scenario: Wheel over the tree does not wrap

- **GIVEN** the cursor is on the first row
- **WHEN** a wheel-up event arrives inside the tree rows
- **THEN** the cursor stays on the first row

#### Scenario: Wheel on the status bar does nothing

- **GIVEN** the cursor is on `Active (2)`
- **WHEN** a wheel-down event arrives on a status bar row
- **THEN** the cursor stays on `Active (2)`

<!-- @trace
source: mouse-support
updated: 2026-09-09
code:
  - src/pane.tsx
  - src/tui/App.tsx
  - src/tui/mouse.ts
  - README.md
tests:
  - test/tui/App.test.tsx
  - test/tui/mouse.test.ts
  - test/tui/mouse-lifecycle.test.ts
-->