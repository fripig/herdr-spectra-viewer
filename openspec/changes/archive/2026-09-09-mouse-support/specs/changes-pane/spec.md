## MODIFIED Requirements

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

## ADDED Requirements

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

### Requirement: Select, toggle, and open by clicking the tree

A press whose row falls on a rendered tree row and whose column falls within the tree column SHALL move the cursor to that row. When the press falls within the two marker cells of that row (the cells immediately after the row's indent where the expand arrow is drawn) and the row is a group or change node, the pane SHALL toggle that node's expansion in addition to moving the cursor. When the press falls outside the marker cells and the row is an artifact node, the pane SHALL open that artifact in the editor split exactly as Enter and `e` do, including showing `File not found: <relative path>` when the file is missing. A press on a tree row with no node, on the status bar, or on any row above the tree SHALL do nothing. Releases SHALL be ignored. The row-to-node mapping SHALL account for the tree's top offset and current window start, so it stays correct when rows are rendered above the tree or the window is scrolled.

#### Scenario: Click moves the cursor

- **GIVEN** the tree renders `Active (2)` on its first row and `add-search (3/8)` on its second
- **WHEN** the user presses the left button on the second row, on the label
- **THEN** the cursor is on `add-search` and its expansion is unchanged

#### Scenario: Click on the marker toggles expansion

- **GIVEN** the cursor is on `Active (2)`, which is expanded
- **WHEN** the user presses the left button on the first row within its marker cells
- **THEN** Active collapses and the cursor stays on it

#### Scenario: Click on an artifact opens it in the editor

- **GIVEN** `design.md` of `add-search` is rendered on the third row
- **WHEN** the user presses the left button on the third row, on the label
- **THEN** the cursor is on `design.md`, the editor adapter is asked to open that file, and the status bar shows `Opened in <editor>`

#### Scenario: Click on a missing artifact reports it

- **GIVEN** an artifact node is rendered whose file has been deleted since the last scan
- **WHEN** the user presses the left button on that row, on the label
- **THEN** the status bar shows `File not found: <relative path>`, no editor is opened, and the tree is unchanged

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
