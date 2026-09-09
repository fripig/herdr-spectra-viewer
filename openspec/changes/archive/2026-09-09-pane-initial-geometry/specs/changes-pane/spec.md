## ADDED Requirements

### Requirement: Show every key hint within the pane width

The status bar SHALL show every key hint it offers, at every pane width. A hint SHALL NOT be dropped or cut off because the list is wider than the pane.

The tree-mode key hints SHALL be packed onto as many lines as the pane width requires, filling each line before starting the next and keeping the hints in their declared order. Two spaces SHALL separate hints on the same line. A hint that is on its own wider than the pane SHALL occupy a line of its own. The line listing the Spectra command keys SHALL be packed the same way. A modal input line, shown while filter mode or authors mode owns the keyboard, SHALL be packed the same way in place of those two lines.

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

##### Example: hints packed by width

| Available width | Hints                                    | Lines produced                     |
| --------------- | ---------------------------------------- | ---------------------------------- |
| 20              | `a one`, `b two`, `c three`              | `a one  b two`, `c three`          |
| 40              | `a one`, `b two`, `c three`              | `a one  b two  c three`            |
| 6               | `a one`, `b two`, `c three`              | `a one`, `b two`, `c three`        |
| 4               | `a one`, `verylonghint`, `b two`         | `a one`, `verylonghint`, `b two`   |

## MODIFIED Requirements

### Requirement: Display changes as a grouped tree

The pane SHALL display the scan snapshot as a tree. The first level SHALL consist of exactly three group nodes labelled Active, Parked, and Archived. The second level SHALL consist of change nodes showing the change name. The third level SHALL consist of artifact nodes showing each Markdown file path relative to its change directory.

A filter is active when the filter text is non-empty, when at least one author candidate is selected, or both. When no filter is active, a group node SHALL show the number of changes in that group as `<label> (<count>)`. When a filter is active, a group node SHALL show both the number of matching changes and the group's total as `<label> (<matching>/<total>)`, so that filtered-out changes cannot be mistaken for missing data.

A group node SHALL be displayed even when it contains no changes, and even when no change in it matches the filter. Active SHALL be expanded when the pane starts; Parked and Archived SHALL be collapsed. A cursor SHALL mark exactly one visible node at all times, starting on the Active group node. Up and Down arrow keys, and `k` and `j`, SHALL move the cursor across visible nodes without wrapping. Right arrow and `l` SHALL expand the node under the cursor; Left arrow and `h` SHALL collapse it, or move the cursor to its parent when it is already collapsed or is a leaf.

The tree SHALL be given the rows that remain once the header line and the status bar have taken theirs, counted from what those rows actually occupy at the current width and in the current input mode rather than from a fixed number. The rendered frame SHALL NOT be taller than the pane at any width, so no row is pushed off the top. Only the rows that fit the tree's height SHALL be rendered, and the rendered window SHALL scroll so the cursor row is always visible.

#### Scenario: Groups render with counts

- **GIVEN** a snapshot with two active changes, one parked change, and no archived changes
- **WHEN** the pane renders the snapshot with no filter active
- **THEN** the tree shows `Active (2)`, `Parked (1)`, and `Archived (0)`

#### Scenario: Groups render matched and total counts while a filter is active

- **GIVEN** a snapshot with three active changes, one parked change, and no archived changes, where one active change and the parked change match the filter text
- **WHEN** the pane renders the snapshot with that filter text
- **THEN** the tree shows `Active (1/3)`, `Parked (1/1)`, and `Archived (0/0)`

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

#### Scenario: Wrapped hints shorten the tree instead of overflowing the pane

- **GIVEN** a pane whose width makes the status bar occupy more lines than it does at full width
- **WHEN** the pane renders the snapshot
- **THEN** the frame is exactly as tall as the pane and the tree shows correspondingly fewer rows
