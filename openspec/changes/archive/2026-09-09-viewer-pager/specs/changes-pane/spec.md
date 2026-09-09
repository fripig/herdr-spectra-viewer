## MODIFIED Requirements

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
