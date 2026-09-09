## MODIFIED Requirements

### Requirement: Provide a Spectra changes pane

The plugin SHALL provide a Herdr pane with entrypoint id `changes` that renders a terminal UI listing Spectra changes. The pane SHALL run one scan of the resolved project root when it starts. The pane SHALL have three input modes: tree, filter, and authors. It SHALL start in tree mode. While in tree mode, pressing `q` or Escape SHALL exit the process with code 0, and those two keys SHALL be the only ways the pane exits on its own: sending a command SHALL NOT end the process. While in filter mode or authors mode, `q` and Escape SHALL NOT exit the process; their meaning is defined by the filter and author requirements. Before rendering its first frame the pane SHALL enable terminal mouse reporting by writing `ESC[?1000h` followed by `ESC[?1006h` to stdout. On every exit path, including `q`, Escape, SIGINT, SIGTERM, and SIGHUP, the pane SHALL disable mouse reporting by writing `ESC[?1006l` followed by `ESC[?1000l` before the process ends.

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

### Requirement: Display changes as a grouped tree

The pane SHALL display the scan snapshot as a tree. The first level SHALL consist of exactly three group nodes labelled Active, Parked, and Archived. The second level SHALL consist of change nodes showing the change name. The third level SHALL consist of artifact nodes showing each Markdown file path relative to its change directory.

A filter is active when the filter text is non-empty, when at least one author candidate is selected, or both. When no filter is active, a group node SHALL show the number of changes in that group as `<label> (<count>)`. When a filter is active, a group node SHALL show both the number of matching changes and the group's total as `<label> (<matching>/<total>)`, so that filtered-out changes cannot be mistaken for missing data.

A group node SHALL be displayed even when it contains no changes, and even when no change in it matches the filter. Active SHALL be expanded when the pane starts; Parked and Archived SHALL be collapsed. A cursor SHALL mark exactly one visible node at all times, starting on the Active group node. Up and Down arrow keys, and `k` and `j`, SHALL move the cursor across visible nodes without wrapping. Right arrow and `l` SHALL expand the node under the cursor; Left arrow and `h` SHALL collapse it, or move the cursor to its parent when it is already collapsed or is a leaf.

Only the rows that fit the terminal height SHALL be rendered, and the rendered window SHALL scroll so the cursor row is always visible.

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

### Requirement: Show task progress on change nodes

A change node SHALL display its completed and total task counts as `(<complete>/<total>)` at the end of the node text when progress information is available. A change node SHALL NOT display counts when no progress information is available. When a proposer is also shown, the counts SHALL follow the proposer, so the counts stay last regardless of the proposer's length.

#### Scenario: Change with tasks

- **GIVEN** a change with an unknown proposer whose `tasks.md` has 3 of 8 items complete
- **WHEN** the pane renders that change node
- **THEN** the node text is the change name followed by `(3/8)`

#### Scenario: Change without tasks

- **GIVEN** a change with no counted task items
- **WHEN** the pane renders that change node
- **THEN** the node text shows the change name without task counts

### Requirement: Rescan on demand

Pressing `R` in tree mode SHALL trigger a new scan and rebuild the tree from the resulting snapshot. Expansion state of group and change nodes that still exist SHALL be preserved across the rebuild, and the cursor SHALL stay on the same node when it still exists, otherwise on the nearest group node above it. The sort mode and the filter text SHALL be preserved and applied to the new snapshot. The author selection SHALL keep every author still present in the new snapshot's candidate list and drop every author no longer present.

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

#### Scenario: Rescan preserves sort mode and filter text

- **GIVEN** the sort mode is Name and the filter text is `search`
- **WHEN** the user presses `R`
- **THEN** the new snapshot is rendered ordered by name with only changes containing `search`

#### Scenario: Rescan keeps present authors and drops absent ones

- **GIVEN** the authors `alice` and `bob` are selected, and the rescan finds no change proposed by `bob`
- **WHEN** the user presses `R`
- **THEN** `alice` remains selected, `bob` is neither offered nor selected, and the tree shows changes by `alice` only

## ADDED Requirements

### Requirement: Sort changes within groups

The pane SHALL order changes within each group by one of exactly three mutually exclusive sort modes: Name, Modified, and Created. The default SHALL be Modified. Pressing `s` in tree mode SHALL cycle the mode in the order Modified, Name, Created, Modified. The header line SHALL show the current mode as `sort: <mode>` in lowercase.

Name SHALL order changes by name ascending using plain string comparison. Modified SHALL order changes by modification date, most recent first. Created SHALL order changes by creation date, most recent first. For both date orders, changes whose date is unknown SHALL be placed last, and changes sharing a date SHALL be ordered by name ascending.

Sorting SHALL apply within each group only; the order of the three groups SHALL NOT change. Changing the sort mode SHALL rebuild the tree from the existing snapshot without rescanning, and SHALL keep the expansion state and cursor.

#### Scenario: Each mode produces its own order

- **WHEN** the user cycles to a sort mode
- **THEN** every group is reordered according to that mode's rules

##### Example: three changes under each sort mode

- **GIVEN** the Active group contains `add-search` (created 2026-08-10, modified 2026-08-12 09:00), `mid-tier` (created 2026-08-12, modified 2026-08-11 17:00), and `zebra-fix` (creation date unknown, modified 2026-08-13 08:00)
- **WHEN** the user cycles through each sort mode
- **THEN** Name yields `add-search`, `mid-tier`, `zebra-fix`; Modified yields `zebra-fix`, `add-search`, `mid-tier`; and Created yields `mid-tier`, `add-search`, `zebra-fix`

#### Scenario: Changes with an unknown date sort last

- **GIVEN** a group containing changes both with and without a creation date
- **WHEN** the sort mode is Created
- **THEN** every change with a creation date appears before every change without one

#### Scenario: Sorting does not rescan

- **WHEN** the user presses `s`
- **THEN** the tree is reordered from the existing snapshot, no file system scan runs, and the header shows the new mode

#### Scenario: Default sort mode

- **WHEN** the pane starts
- **THEN** the header shows `sort: modified` and changes are ordered by modification date, most recent first

### Requirement: Filter changes by name

Pressing `/` in tree mode SHALL enter filter mode, in which the header line becomes an input line showing the filter text. In filter mode, printable characters SHALL be appended to the filter text, Backspace SHALL remove its last character, Enter SHALL return to tree mode keeping the text, and Escape SHALL clear the text and return to tree mode. The tree SHALL be re-filtered on every keystroke.

When the filter text is non-empty, a change SHALL be shown only when its name contains the filter text, compared case-insensitively. The filter SHALL apply to all three groups at once. The filter SHALL match change names only: artifact paths SHALL NOT participate, and every artifact of a matching change SHALL remain visible. In tree mode with a non-empty filter, the header SHALL show `filter: <text>`.

Changing the filter SHALL rebuild the tree without rescanning the file system.

#### Scenario: Filtering narrows every group

- **GIVEN** the Active group contains `add-search`, `mid-tier`, and `zebra-fix`, and the Parked group contains `search-cache`
- **WHEN** the user presses `/`, types `search`, and presses Enter
- **THEN** the Active group shows only `add-search`, the Parked group shows only `search-cache`, and the header shows `filter: search`

#### Scenario: Filtering is case-insensitive

- **GIVEN** the Active group contains `add-search`
- **WHEN** the filter text is `SEARCH`
- **THEN** `add-search` is shown

#### Scenario: Artifacts of a matching change stay visible

- **GIVEN** a change named `add-search` containing `proposal.md` and `tasks.md`
- **WHEN** the filter text is `search` and the change node is expanded
- **THEN** `add-search` is shown with both of its artifact nodes

#### Scenario: A filter matching nothing empties the groups

- **WHEN** the filter text matches no change name
- **THEN** all three group nodes are shown with `(0/<total>)` counts and no change nodes beneath them

#### Scenario: Escape clears the filter

- **GIVEN** the filter text is `search` and the pane is in filter mode
- **WHEN** the user presses Escape
- **THEN** the filter text is empty, the pane is in tree mode, and every change is shown again

#### Scenario: Backspace edits the filter

- **GIVEN** the filter text is `sea` in filter mode
- **WHEN** the user presses Backspace
- **THEN** the filter text is `se`

### Requirement: Filter changes by author

Pressing `@` in tree mode SHALL open the author picker, which replaces the tree column with a list of candidate authors, each preceded by `[x]` when selected or `[ ]` when not. In authors mode, Up and Down arrow keys and `k` and `j` SHALL move the picker cursor, Space SHALL toggle the candidate under it, and Enter or Escape SHALL return to tree mode keeping the selection. When the candidate list holds fewer than two candidates, `@` SHALL NOT open the picker and the status bar SHALL show `No authors to filter by`.

The candidate list SHALL be derived from the current snapshot: the distinct proposers of every change in the Active, Parked, and Archived groups, ordered alphabetically compared case-insensitively. When at least one change has an unknown proposer, the list SHALL also offer a single `Unknown` candidate ordered after every named author; otherwise it SHALL NOT.

When no candidate is selected, the author filter SHALL NOT restrict which changes are shown. When one or more are selected, a change SHALL be shown only when its proposer is one of the selected authors, or when its proposer is unknown and `Unknown` is selected. The author filter and the filter text SHALL be combined as a conjunction. The author filter SHALL apply to all three groups at once. In tree mode with a non-empty selection, the header SHALL show `authors: <labels>` with labels joined by a comma and a space in candidate order. Changing the selection SHALL rebuild the tree without rescanning. The pane SHALL start with no candidate selected.

#### Scenario: Selecting one author

- **GIVEN** the Active group contains `add-dark-mode` proposed by `alice` and `fix-login` proposed by `bob`
- **WHEN** the user opens the picker, toggles `alice`, and presses Enter
- **THEN** the Active group shows `add-dark-mode` only and the header shows `authors: alice`

#### Scenario: Selecting the unknown-proposer candidate

- **GIVEN** the Active group contains `add-dark-mode` proposed by `alice` and `legacy-change` whose proposer is unknown
- **WHEN** the user selects the `Unknown` candidate
- **THEN** the Active group shows `legacy-change` only

#### Scenario: The author filter and the filter text are combined as a conjunction

- **GIVEN** the Active group contains `add-dark-mode` proposed by `alice`, `add-light-mode` proposed by `bob`, and `fix-login` proposed by `alice`
- **WHEN** the filter text and the author selection are set
- **THEN** only changes satisfying both are shown

##### Example: combinations of filter text and author selection

| Filter text | Selected authors | Shown changes                                  |
| ----------- | ---------------- | ---------------------------------------------- |
| empty       | none             | `add-dark-mode`, `add-light-mode`, `fix-login` |
| empty       | `alice`          | `add-dark-mode`, `fix-login`                   |
| `add`       | none             | `add-dark-mode`, `add-light-mode`              |
| `add`       | `alice`          | `add-dark-mode`                                |
| `add`       | `alice`, `bob`   | `add-dark-mode`, `add-light-mode`              |
| `zzz`       | `alice`          | none                                           |

#### Scenario: Candidates are ordered alphabetically with the unknown candidate last

- **WHEN** the candidate list is built from a snapshot
- **THEN** the candidates are the distinct proposers ordered case-insensitively, followed by `Unknown` only when some change has no proposer

##### Example: candidate lists by snapshot content

| Proposers in the snapshot | Candidate list          |
| ------------------------- | ----------------------- |
| `alice`, `bob`            | `alice`, `bob`          |
| `bob`, `alice`, `bob`     | `alice`, `bob`          |
| `Carol`, `alice`, `Bob`   | `alice`, `Bob`, `Carol` |
| `alice`, unknown          | `alice`, `Unknown`      |
| unknown only              | `Unknown`               |
| no changes at all         | empty                   |

#### Scenario: The picker refuses to open with one candidate

- **GIVEN** every change in the snapshot is proposed by `alice`
- **WHEN** the user presses `@`
- **THEN** the tree stays visible, the pane stays in tree mode, and the status bar shows `No authors to filter by`

#### Scenario: Space toggles and Enter closes

- **GIVEN** the picker is open with `alice` unselected under the cursor
- **WHEN** the user presses Space then Enter
- **THEN** `alice` is selected, the pane is in tree mode, and the tree shows changes by `alice` only

### Requirement: Show the proposer on change nodes

A change node SHALL display the proposer of its change between the change name and the task progress counts when a proposer is known, separated from both by a single space. A change node SHALL NOT display any placeholder when the proposer is unknown. The proposer SHALL be rendered de-emphasised, in the same style as the progress counts. This SHALL be identical for the Active, Parked, and Archived groups; an archived change SHALL show its proposer, not whoever archived it. The proposer SHALL NOT affect sort order, SHALL NOT be matched by the filter text, and SHALL NOT be included in the copied change name.

#### Scenario: Change with a known proposer

- **GIVEN** a change named `add-dark-mode` proposed by `fripig` whose `tasks.md` has 3 of 8 items complete
- **WHEN** the pane renders that change node
- **THEN** the node text is `add-dark-mode fripig (3/8)`

#### Scenario: Change with an unknown proposer

- **GIVEN** a change named `legacy-change` with an unknown proposer and no task progress
- **WHEN** the pane renders that change node
- **THEN** the node text is `legacy-change`

##### Example: node text by proposer and progress

| Name            | Proposer | Progress | Node text                    |
| --------------- | -------- | -------- | ---------------------------- |
| `add-dark-mode` | `fripig` | 3/8      | `add-dark-mode fripig (3/8)` |
| `add-dark-mode` | `fripig` | none     | `add-dark-mode fripig`       |
| `add-dark-mode` | unknown  | 3/8      | `add-dark-mode (3/8)`        |
| `add-dark-mode` | unknown  | none     | `add-dark-mode`              |

#### Scenario: The proposer is not matched by the name filter

- **GIVEN** a change named `fix-login` proposed by `alice`
- **WHEN** the filter text is `alice`
- **THEN** `fix-login` is not shown

### Requirement: Copy the change name to the clipboard

Pressing `y` in tree mode on a change node, or on an artifact node, SHALL write the name of that change (or of the artifact's owning change) to the system clipboard as plain text. The copied text SHALL be the change name alone: no group, no proposer, no progress counts, no trailing newline. On success the status bar SHALL show `Copied: <name>`; on clipboard failure it SHALL show `Copy failed: <name>`. Pressing `y` on a group node SHALL NOT write to the clipboard and SHALL show `Select a change first`. Copying SHALL NOT rescan and SHALL keep the expansion state, sort mode, and filters.

#### Scenario: Copy a change name

- **GIVEN** the cursor is on change `sort-and-filter-changes` proposed by `fripig` with progress 3 of 7
- **WHEN** the user presses `y`
- **THEN** the clipboard contains exactly `sort-and-filter-changes` and the status bar shows `Copied: sort-and-filter-changes`

#### Scenario: Copy from an artifact node

- **GIVEN** the cursor is on artifact `design.md` of change `add-search`
- **WHEN** the user presses `y`
- **THEN** the clipboard contains exactly `add-search`

#### Scenario: Copy is unavailable on a group node

- **GIVEN** the cursor is on the Active group node
- **WHEN** the user presses `y`
- **THEN** nothing is written to the clipboard and the status bar shows `Select a change first`

#### Scenario: Copy does not rescan

- **WHEN** the user presses `y` on a change node
- **THEN** no file system scan runs and the tree keeps its expansion state, sort mode, and filters
