## ADDED Requirements

### Requirement: Open a Spectra command menu with the right button

A right press whose row falls on a rendered tree row and whose column falls within the tree column SHALL move the cursor to that row. It SHALL NOT toggle that row's expansion, whatever column it lands on, and it SHALL NOT run a file system scan. A right press outside the rendered tree rows SHALL do nothing.

When the row the cursor moves to has an owning change — a change node, or an artifact node whose change owns it — the pane SHALL open a floating command menu and enter menu mode. When the row is a group node, the pane SHALL open no menu, SHALL stay in tree mode, and the status bar SHALL show `Select a change first`.

The menu SHALL list the same five Spectra commands as the status bar, in the same order, each drawn as its key followed by a space and its command name: `d discuss`, `a apply`, `i ingest`, `r archive`, `c commit`. It SHALL NOT offer `/spectra-propose`. Every item SHALL be padded with spaces to the width of the longest item, so the menu covers every cell inside its border rather than letting the tree show through. The menu SHALL open with its cursor on the first item, and the item under the menu cursor SHALL be drawn inverted.

The menu SHALL be drawn over the tree rather than in place of it, so the rows the menu does not cover stay readable and the tree's expansion state is untouched. Its content SHALL be one column of the five items with a border on all four sides, so its width is the longest item's width plus two and its height is seven.

The menu's position SHALL be expressed as a zero-based left and top measured from the pane's own top-left corner. The anchor SHALL be the cell the right press reported, converted from the report's one-based column and row. The left SHALL be the smaller of the anchor's column and the pane width minus the menu width, and SHALL NOT be less than zero. The top SHALL be the smaller of the anchor's row and the pane height minus the menu height, and SHALL NOT be less than zero. The whole menu therefore stays inside the pane; when the pane is smaller than the menu the menu SHALL sit at the pane's corner and the terminal SHALL clip what does not fit.

While menu mode owns the keyboard: Up and `k` SHALL move the menu cursor to the previous item and stop at the first; Down and `j` SHALL move it to the next item and stop at the last; Enter SHALL send the command of the item under the menu cursor and return to tree mode; Escape SHALL return to tree mode without sending or copying anything. Every other key SHALL do nothing, including `q`, which SHALL NOT exit the process.

While the menu is open, a press or a right press on one of the five item cells SHALL send that item's command and return to tree mode, exactly as Enter does. A press or a right press inside the menu's border but not on an item SHALL do nothing and SHALL leave the menu open. A press or a right press outside the menu SHALL return to tree mode without sending or copying anything. Wheel events SHALL do nothing and SHALL NOT scroll the tree. Releases SHALL be ignored.

Sending from the menu SHALL produce exactly the behaviour the command keys produce for the same change, including the command text, the choice of destination pane, the focus call, the clipboard fallback, and every status bar outcome. Opening the menu, closing it, and sending from it SHALL NOT run a file system scan, and the tree SHALL keep its expansion state.

The status bar SHALL show a modal hint line while menu mode owns the keyboard, listing the menu's own keys, in place of the tree-mode key lines.

#### Scenario: Right-clicking a change opens the menu there

- **GIVEN** change `add-search` is rendered on the second tree row and the cursor is on the first row
- **WHEN** the user presses the right button on the second row, on the label
- **THEN** the cursor is on `add-search`, its expansion is unchanged, and the five items `d discuss`, `a apply`, `i ingest`, `r archive`, `c commit` are on screen with `d discuss` inverted

#### Scenario: Right-clicking the marker cells does not toggle

- **GIVEN** change `add-search` is rendered and expanded
- **WHEN** the user presses the right button on its row within its marker cells
- **THEN** `add-search` is still expanded and the menu is open

#### Scenario: Right-clicking a group node opens no menu

- **GIVEN** the Archived group node is rendered on the fourth tree row
- **WHEN** the user presses the right button on that row
- **THEN** no menu is on screen, the pane is in tree mode, and the status bar shows `Select a change first`

#### Scenario: Choosing an item with the keyboard sends the command

- **GIVEN** the menu is open for change `add-search` and the invocation context has command target pane id `p1`
- **WHEN** the user presses `j` and then Enter
- **THEN** the adapter is asked to send `/spectra-apply add-search` to pane `p1`, the menu closes, and the pane is in tree mode

#### Scenario: Choosing an item with the mouse sends the command

- **GIVEN** the menu is open for change `add-search`
- **WHEN** the user presses the left button on the `c commit` item cell
- **THEN** the command text `/spectra-commit add-search` is sent or copied by the same path a command key uses, and the menu closes

#### Scenario: The artifact's owning change is used

- **GIVEN** the cursor lands on artifact `tasks.md` of change `add-search` after a right press
- **WHEN** the user chooses `i ingest`
- **THEN** the command text is `/spectra-ingest add-search`

#### Scenario: Escape closes the menu and sends nothing

- **GIVEN** the menu is open for change `add-search`
- **WHEN** the user presses Escape
- **THEN** no menu is on screen, nothing is sent or copied, and the pane is in tree mode

#### Scenario: Clicking outside the menu closes it

- **GIVEN** the menu is open for change `add-search`
- **WHEN** the user presses the left button on a cell outside the menu
- **THEN** no menu is on screen, nothing is sent or copied, and no artifact is opened

#### Scenario: Clicking the menu border keeps it open

- **GIVEN** the menu is open for change `add-search`
- **WHEN** the user presses the left button on the menu's top border
- **THEN** the menu is still on screen and nothing is sent or copied

#### Scenario: q does not exit while the menu is open

- **GIVEN** the menu is open for change `add-search`
- **WHEN** the user presses `q`
- **THEN** the process keeps running and the menu is still on screen

##### Example: menu position by anchor and pane size

| Pane width | Pane height | Right press at (col, row) | Menu left | Menu top | Why                          |
| ---------- | ----------- | ------------------------- | --------- | -------- | ---------------------------- |
| 80         | 24          | (5, 4)                    | 4         | 3        | fits at the anchor           |
| 80         | 24          | (75, 4)                   | 69        | 3        | clamped to the right edge    |
| 80         | 24          | (5, 22)                   | 4         | 17       | clamped to the bottom edge   |
| 80         | 24          | (78, 23)                  | 69        | 17       | clamped on both edges        |
| 8          | 5           | (3, 3)                    | 0         | 0        | pane smaller than the menu   |

##### Example: what a press does while the menu is open

For a menu at left 4, top 3, width 11, height 7, whose item cells are therefore terminal columns 6 through 14 and terminal rows 5 through 9:

| Press at (col, row) | Result                       |
| ------------------- | ---------------------------- |
| (8, 5)              | chooses `d discuss`          |
| (8, 9)              | chooses `c commit`           |
| (5, 5)              | on the border: menu stays    |
| (8, 4)              | on the border: menu stays    |
| (8, 11)             | outside: menu closes         |
| (20, 6)             | outside: menu closes         |

## MODIFIED Requirements

### Requirement: Provide a Spectra changes pane

The plugin SHALL provide a Herdr pane with entrypoint id `changes` that renders a terminal UI listing Spectra changes. The pane SHALL run one scan of the resolved project root when it starts. The pane SHALL have four input modes: tree, filter, authors, and menu. It SHALL start in tree mode. While in tree mode, pressing `q` or Escape SHALL exit the process with code 0, and those two keys SHALL be the only ways the pane exits on its own: sending a command SHALL NOT end the process. While in filter mode, authors mode, or menu mode, `q` and Escape SHALL NOT exit the process; their meaning is defined by the filter, author, and command menu requirements. Before rendering its first frame the pane SHALL enable terminal mouse reporting by writing `ESC[?1000h` followed by `ESC[?1006h` to stdout. On every exit path, including `q`, Escape, SIGINT, SIGTERM, and SIGHUP, the pane SHALL disable mouse reporting by writing `ESC[?1006l` followed by `ESC[?1000l` before the process ends.

On every one of those exit paths the pane SHALL also close the viewer pane it remembers, so no viewer pane outlives the pane that opened it. The close SHALL run synchronously, because a pane closed by Herdr leaves the process only a signal handler's worth of time. The remembered pane id SHALL be cleared by the close, so an exit path that runs after another one issues no second close. When no viewer pane is remembered, the exit path SHALL issue no close. The outcome of the close SHALL be ignored: a non-zero exit, a not-found error for a viewer that has already gone, and a failure to run Herdr at all SHALL NOT change the process exit code, SHALL NOT be written to stderr, and SHALL NOT prevent the process from ending.

#### Scenario: Pane opens and scans

- **WHEN** Herdr launches the `changes` pane in a workspace whose project root contains an `openspec` directory
- **THEN** a scan runs and the tree is populated from its result

#### Scenario: Pane exits on request in tree mode

- **WHEN** the user presses `q` or Escape while in tree mode
- **THEN** the pane process exits with code 0

#### Scenario: q does not exit while typing a filter

- **GIVEN** the pane is in filter mode
- **WHEN** the user presses `q`
- **THEN** the character `q` is appended to the filter text and the process keeps running

#### Scenario: q does not exit while the command menu owns the keyboard

- **GIVEN** the pane is in menu mode
- **WHEN** the user presses `q`
- **THEN** the process keeps running and the menu stays open

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

### Requirement: Parse SGR mouse reports from input

The pane SHALL recognise SGR-encoded mouse reports of the form `ESC[<button;col;rowM` (press or wheel) and `ESC[<button;col;rowm` (release), with 1-based column and row, anywhere in an input chunk, and SHALL turn each into a mouse event: button 0 with `M` is a press, button 2 with `M` is a right press, any button with `m` is a release, button 64 is wheel-up, button 65 is wheel-down. Reports with any other button SHALL be dropped. Input containing only a partial report SHALL produce no event. A mouse report SHALL NOT be interpreted as a keyboard key: in particular it SHALL NOT trigger the Escape exit or any command key.

Modifier keys SHALL NOT be read from the button field, because the terminal does not encode them there: a right press with a modifier held reports the same button 2 as a plain one.

#### Scenario: Probe samples parse to events

- **WHEN** the input chunk contains one SGR report
- **THEN** exactly one event with the corresponding kind, column, and row is produced

##### Example: reports observed in Herdr 0.9.0

| Input           | Kind        | col | row |
| --------------- | ----------- | --- | --- |
| `ESC[<0;17;18M` | press       | 17  | 18  |
| `ESC[<0;17;18m` | release     | 17  | 18  |
| `ESC[<2;17;18M` | right press | 17  | 18  |
| `ESC[<2;17;18m` | release     | 17  | 18  |
| `ESC[<64;10;21M` | wheel-up   | 10  | 21  |
| `ESC[<65;10;21M` | wheel-down | 10  | 21  |
| `ESC[<32;9;5M`  | dropped     | –   | –   |
| `ESC[<0;17`     | no event    | –   | –   |

#### Scenario: A mouse report never quits the pane

- **GIVEN** the pane is running
- **WHEN** stdin delivers `ESC[<0;17;18M`
- **THEN** the process keeps running and no command is sent or copied

### Requirement: Select, toggle, and open by clicking the tree

A left press whose row falls on a rendered tree row and whose column falls within the tree column SHALL move the cursor to that row. When the left press falls within the two marker cells of that row (the cells immediately after the row's indent where the expand arrow is drawn) and the row is a group or change node, the pane SHALL toggle that node's expansion in addition to moving the cursor. When the left press falls outside the marker cells and the row is an artifact node, the pane SHALL open that artifact in the viewer split exactly as Enter and `e` do, including showing `File not found: <relative path>` when the file is missing. A left press on a tree row with no node, on the status bar, or on any row above the tree SHALL do nothing. Releases SHALL be ignored. Right presses SHALL NOT toggle or open anything; their meaning is defined by the command menu requirement. The row-to-node mapping SHALL account for the tree's top offset and current window start, so it stays correct when rows are rendered above the tree or the window is scrolled.

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

#### Scenario: A right press on an artifact does not open it

- **GIVEN** `design.md` of `add-search` is rendered on the third row
- **WHEN** the user presses the right button on the third row, on the label
- **THEN** no viewer is opened and the cursor is on `design.md`

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

### Requirement: Show every key hint within the pane width

The status bar SHALL show every key hint it offers, at every pane width. A hint SHALL NOT be dropped or cut off because the list is wider than the pane.

The tree-mode key hints SHALL be packed onto as many lines as the pane width requires, filling each line before starting the next and keeping the hints in their declared order. Two spaces SHALL separate hints on the same line. A hint that is on its own wider than the pane SHALL occupy a line of its own. The line listing the Spectra command keys SHALL be packed the same way. A modal input line, shown while filter mode, authors mode, or menu mode owns the keyboard, SHALL be packed the same way in place of those two lines, and SHALL be padded out to the same number of lines the two tree-mode lines occupy, so entering and leaving those modes does not resize the tree.

#### Scenario: Every hint is visible in a narrow pane

- **GIVEN** a pane whose width cannot fit the tree-mode key hints on one line
- **WHEN** the pane renders in tree mode
- **THEN** the hints are shown on more than one line and the last hint, `q quit`, is on screen

#### Scenario: A wide pane keeps the hints on one line

- **GIVEN** a pane wide enough for every tree-mode key hint
- **WHEN** the pane renders in tree mode
- **THEN** all the hints are shown on a single line in their declared order

#### Scenario: Command keys wrap the same way

- **GIVEN** a pane whose width cannot fit the five Spectra command keys on one line
- **WHEN** the pane renders in tree mode
- **THEN** the command keys are shown on more than one line and `c commit` is on screen

#### Scenario: The command menu has its own hint line

- **GIVEN** the pane is in menu mode
- **WHEN** the pane renders the status bar
- **THEN** the menu's own key hints are shown in place of the tree-mode key lines, on the same number of lines those two lines occupy

##### Example: hints packed by width

| Available width | Hints                                    | Lines produced                     |
| --------------- | ---------------------------------------- | ---------------------------------- |
| 20              | `a one`, `b two`, `c three`              | `a one  b two`, `c three`          |
| 40              | `a one`, `b two`, `c three`              | `a one  b two  c three`            |
| 6               | `a one`, `b two`, `c three`              | `a one`, `b two`, `c three`        |
| 4               | `a one`, `verylonghint`, `b two`         | `a one`, `verylonghint`, `b two`   |
