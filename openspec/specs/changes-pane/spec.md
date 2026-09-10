# changes-pane Specification

## Purpose

TBD - created by archiving change 'herdr-spectra-pane-core'. Update Purpose after archive.

## Requirements

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

---
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


<!-- @trace
source: pane-initial-geometry
updated: 2026-09-09
code:
  - src/tui/StatusBar.tsx
  - src/tui/keymap.ts
  - src/tui/hint-layout.ts
  - src/pane.tsx
  - src/herdr/client.ts
  - src/tui/App.tsx
tests:
  - test/tui/frame-height.test.ts
  - test/tui/App.test.tsx
  - test/herdr/client.test.ts
  - test/tui/hint-layout.test.ts
-->

---
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


<!-- @trace
source: herdr-spectra-pane-actions
updated: 2026-09-09
code:
  - src/tui/FilterLine.tsx
  - src/tui/change-order.ts
  - src/tui/StatusBar.tsx
  - src/tui/App.tsx
  - src/tui/change-filter.ts
  - src/tui/tree-model.ts
  - src/tui/ChangeTree.tsx
  - src/tui/AuthorPicker.tsx
  - src/tui/keymap.ts
tests:
  - test/tui/App.test.tsx
  - test/tui/change-order.test.ts
  - test/tui/change-filter.test.ts
-->

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

Pressing `e` on an artifact node SHALL open that file in the user's viewer in a new pane split to the right of the pane that invoked the plugin, using the Herdr adapter. The viewer command SHALL be resolved from three sources, in order: the `SPECTRA_VIEWER` environment variable with surrounding whitespace removed; the `viewer` field of the plugin's configuration file with surrounding whitespace removed; and `less`. A source SHALL be used when it yields a non-empty string, and SHALL be passed over otherwise. The `EDITOR` environment variable SHALL NOT be consulted. The command run in the new pane SHALL be the viewer command, followed by the shell-quoted absolute path of the artifact, followed by a shell statement separator and the `exit` builtin, so the pane closes once the viewer ends, whether the viewer ended successfully or with an error.

The plugin's configuration file SHALL be `config.json` in the directory named by the `HERDR_PLUGIN_CONFIG_DIR` environment variable, and SHALL be read once when the pane starts. Its content SHALL be a JSON object, of which only the `viewer` field SHALL be read. The configuration source SHALL be passed over when `HERDR_PLUGIN_CONFIG_DIR` is unset or empty, when the file cannot be read, when its content is not valid JSON, when its top level is not an object, when the `viewer` field is absent, when the `viewer` field is not a string, and when the `viewer` field holds only whitespace. A file that exists but cannot be used SHALL report one warning line; an absent directory, an absent file, and an absent `viewer` field SHALL report nothing. No configuration failure SHALL prevent the pane from starting or change the process exit code.

At most one viewer pane SHALL exist at a time. The plugin SHALL remember the pane id of the viewer pane it most recently created. When a viewer pane is remembered, an open SHALL ask Herdr to close that pane before splitting the new one, so the call order is close, then split, then run. The outcome of that close SHALL be ignored, including the not-found error a pane that has already gone reports, and SHALL NOT reach the status bar or prevent the split. When no viewer pane is remembered, an open SHALL NOT issue a close. A successful open SHALL remember the pane it created. An open whose split fails SHALL remember no pane. The remembered pane id SHALL NOT be probed for liveness before it is closed.

An open that closes a remembered viewer pane SHALL ask Herdr for the layout holding the plugin's own pane, and SHALL ask before issuing the close, so the call order is layout, close, split, run. That split SHALL then be given a ratio: the width the plugin's own pane had, divided by the combined width of the plugin's own pane and the remembered viewer pane, expressed to four decimal places. The two panes therefore keep the widths the user last gave them. The ratio SHALL be derived from the two panes' own rectangles, not from any ratio the layout reports for a split of its own.

No layout SHALL be asked for, and no ratio SHALL be given, when no viewer pane is remembered or when the plugin does not know its own pane id. A ratio SHALL also be withheld when the layout cannot be read, when either pane is absent from it, when either pane's width is not a positive integer, or when the two panes are not side by side, meaning their tops or their heights differ or the remembered viewer pane does not begin exactly where the plugin's own pane ends. A withheld ratio SHALL leave the split's width to Herdr, and SHALL NOT prevent the open, reach the status bar, or be reported anywhere.

The status bar SHALL show `Opened in <viewer command>` on success. The plugin pane SHALL stay open afterwards. When the file does not exist, the status bar SHALL show `File not found: <relative path>`, no split SHALL be created, and no pane SHALL be closed. When the adapter reports a failure, the status bar SHALL show `Could not open viewer` and nothing else SHALL change. Pressing `e` on a group or change node SHALL do nothing.

#### Scenario: Open an artifact in the viewer split

- **GIVEN** `SPECTRA_VIEWER` is unset, no configuration file is present, and the cursor is on artifact `proposal.md` of change `add-search`
- **WHEN** the user presses `e`
- **THEN** the adapter is asked to split a pane and to run a command that starts with `less`, carries the artifact's shell-quoted absolute path, and ends with the `exit` builtin, and the status bar shows `Opened in less`

#### Scenario: The viewer command comes from SPECTRA_VIEWER

- **GIVEN** `SPECTRA_VIEWER` is `nvim`
- **WHEN** the user presses `e` on an artifact node
- **THEN** the adapter runs a command that starts with `nvim`, carries the artifact's shell-quoted absolute path, and ends with the `exit` builtin, and the status bar shows `Opened in nvim`

#### Scenario: The viewer command comes from the configuration file

- **GIVEN** `SPECTRA_VIEWER` is unset and the configuration file holds `{ "viewer": "frogmouth" }`
- **WHEN** the user presses `e` on an artifact node
- **THEN** the adapter runs a command that starts with `frogmouth`, and the status bar shows `Opened in frogmouth`

#### Scenario: The environment variable wins over the configuration file

- **GIVEN** `SPECTRA_VIEWER` is `nvim` and the configuration file holds `{ "viewer": "frogmouth" }`
- **WHEN** the user presses `e` on an artifact node
- **THEN** the adapter runs `nvim`, not `frogmouth`

#### Scenario: An unusable configuration file falls back and reports

- **GIVEN** `SPECTRA_VIEWER` is unset and the configuration file does not hold valid JSON
- **WHEN** the pane starts and the user presses `e` on an artifact node
- **THEN** one warning line is reported, the adapter runs `less`, and the pane starts and stays open as usual

#### Scenario: An absent configuration file reports nothing

- **GIVEN** `HERDR_PLUGIN_CONFIG_DIR` names a directory that holds no `config.json`
- **WHEN** the pane starts
- **THEN** no warning is reported and the viewer resolves to `less`

#### Scenario: EDITOR no longer selects the viewer

- **GIVEN** `EDITOR` is `nvim`, `SPECTRA_VIEWER` is unset, and no configuration file is present
- **WHEN** the user presses `e` on an artifact node
- **THEN** the adapter runs `less`, not `nvim`

##### Example: resolved viewer command

| SPECTRA_VIEWER | config `viewer` | EDITOR | resolved viewer |
| -------------- | --------------- | ------ | --------------- |
| unset          | absent          | unset  | `less`          |
| unset          | absent          | `nvim` | `less`          |
| `nvim`         | absent          | unset  | `nvim`          |
| `nvim`         | `vi`            | `vi`   | `nvim`          |
| `   `          | absent          | `nvim` | `less`          |
| `  bat  `      | absent          | unset  | `bat`           |
| unset          | `frogmouth`     | unset  | `frogmouth`     |
| unset          | `  frogmouth  ` | unset  | `frogmouth`     |
| `   `          | `frogmouth`     | unset  | `frogmouth`     |
| unset          | `   `           | unset  | `less`          |

##### Example: configuration file outcomes

| configuration file state          | viewer taken from it | warning reported |
| --------------------------------- | -------------------- | ---------------- |
| `HERDR_PLUGIN_CONFIG_DIR` unset   | no                   | no               |
| file cannot be read               | no                   | no               |
| content is not valid JSON         | no                   | yes              |
| top level is an array             | no                   | yes              |
| `viewer` field absent             | no                   | no               |
| `viewer` field is a number        | no                   | yes              |
| `viewer` field is whitespace only | no                   | yes              |
| `viewer` field is `frogmouth`     | yes                  | no               |

#### Scenario: A second open keeps the widths the user set

- **GIVEN** an earlier open created viewer pane `p9`, and the layout reports the plugin's own pane 27 columns wide with `p9` 50 columns wide beginning exactly where it ends
- **WHEN** the user presses `e` on another artifact node
- **THEN** the adapter asks for the layout, closes `p9`, splits with a ratio of `0.3506`, and runs the viewer, so the two panes are 27 and 50 columns wide again

#### Scenario: The first open asks for no layout and sets no ratio

- **GIVEN** no artifact has been opened since the pane started
- **WHEN** the user presses `e` on an artifact node
- **THEN** no layout is asked for, the split carries no ratio, and the split and the run are issued as they are today

#### Scenario: A layout that cannot be read leaves the width to Herdr

- **GIVEN** an earlier open created viewer pane `p9` and Herdr reports no usable layout
- **WHEN** the user presses `e` on another artifact node
- **THEN** the split carries no ratio, nothing is reported, and the open succeeds as usual

#### Scenario: Panes that are not side by side leave the width to Herdr

- **GIVEN** an earlier open created viewer pane `p9`, and the layout reports `p9` beginning somewhere other than where the plugin's own pane ends
- **WHEN** the user presses `e` on another artifact node
- **THEN** the split carries no ratio and the open succeeds as usual

##### Example: ratio sent with the split

| open | remembered pane, as the layout reports it | plugin pane width | viewer pane width | ratio sent |
| ---- | ----------------------------------------- | ----------------- | ----------------- | ---------- |
| 1st  | none                                      | —                 | —                 | none       |
| 2nd  | side by side                              | 27                | 50                | `0.3506`   |
| 2nd  | side by side                              | 39                | 38                | `0.5065`   |
| 2nd  | absent from the layout                    | —                 | —                 | none       |
| 2nd  | not side by side                          | 27                | 50                | none       |
| 2nd  | width reported as zero                    | 27                | 0                 | none       |

#### Scenario: The first open closes nothing

- **GIVEN** no artifact has been opened since the pane started
- **WHEN** the user presses `e` on an artifact node
- **THEN** the adapter issues a split and a run, and no close

#### Scenario: A second open replaces the first viewer pane

- **GIVEN** an earlier open created viewer pane `p9` and its viewer is still running
- **WHEN** the user presses `e` on another artifact node
- **THEN** the adapter asks for the layout, then closes `p9`, then splits a new pane, then runs the viewer in it, and the status bar shows `Opened in <viewer command>`

##### Example: Herdr calls per open

| open | remembered pane before | calls issued, in order         | remembered pane after |
| ---- | ---------------------- | ------------------------------ | --------------------- |
| 1st  | none                   | split, run                     | `p9`                  |
| 2nd  | `p9`                   | layout, close `p9`, split, run  | `p10`                 |
| 3rd  | `p10`                  | layout, close `p10`, split, run | `p11`                 |

#### Scenario: Closing a pane that has already gone is harmless

- **GIVEN** an earlier open created viewer pane `p9` and the user has since quit the viewer, so `p9` no longer exists
- **WHEN** the user presses `e` on another artifact node
- **THEN** the close of `p9` reports that the pane is not found, that result is ignored, and the new pane is split and run as usual

#### Scenario: A failed split leaves no pane remembered

- **GIVEN** an earlier open created viewer pane `p9`, and the next open's split fails
- **WHEN** the user presses `e` on an artifact node once more
- **THEN** that open issues no close, because the previous pane was already closed and nothing replaced it

#### Scenario: A missing file closes nothing

- **GIVEN** an earlier open created viewer pane `p9`, and the cursor is on an artifact whose file has been deleted
- **WHEN** the user presses `e`
- **THEN** the status bar shows `File not found: <relative path>`, no close is issued, and `p9` is still remembered

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

---
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


<!-- @trace
source: herdr-spectra-pane-actions
updated: 2026-09-09
code:
  - src/tui/FilterLine.tsx
  - src/tui/change-order.ts
  - src/tui/StatusBar.tsx
  - src/tui/App.tsx
  - src/tui/change-filter.ts
  - src/tui/tree-model.ts
  - src/tui/ChangeTree.tsx
  - src/tui/AuthorPicker.tsx
  - src/tui/keymap.ts
tests:
  - test/tui/App.test.tsx
  - test/tui/change-order.test.ts
  - test/tui/change-filter.test.ts
-->

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


<!-- @trace
source: persistent-split-pane
updated: 2026-09-09
code:
  - src/herdr/index.ts
  - src/herdr/client.ts
  - src/open.ts
  - src/pane.tsx
  - src/tui/App.tsx
  - README.md
tests:
  - test/herdr/open.test.ts
  - test/tui/App.test.tsx
  - test/herdr/client.test.ts
-->

---
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

---
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

---
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


<!-- @trace
source: herdr-spectra-pane-actions
updated: 2026-09-09
code:
  - src/tui/FilterLine.tsx
  - src/tui/change-order.ts
  - src/tui/StatusBar.tsx
  - src/tui/App.tsx
  - src/tui/change-filter.ts
  - src/tui/tree-model.ts
  - src/tui/ChangeTree.tsx
  - src/tui/AuthorPicker.tsx
  - src/tui/keymap.ts
tests:
  - test/tui/App.test.tsx
  - test/tui/change-order.test.ts
  - test/tui/change-filter.test.ts
-->

---
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


<!-- @trace
source: herdr-spectra-pane-actions
updated: 2026-09-09
code:
  - src/tui/FilterLine.tsx
  - src/tui/change-order.ts
  - src/tui/StatusBar.tsx
  - src/tui/App.tsx
  - src/tui/change-filter.ts
  - src/tui/tree-model.ts
  - src/tui/ChangeTree.tsx
  - src/tui/AuthorPicker.tsx
  - src/tui/keymap.ts
tests:
  - test/tui/App.test.tsx
  - test/tui/change-order.test.ts
  - test/tui/change-filter.test.ts
-->

---
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


<!-- @trace
source: herdr-spectra-pane-actions
updated: 2026-09-09
code:
  - src/tui/FilterLine.tsx
  - src/tui/change-order.ts
  - src/tui/StatusBar.tsx
  - src/tui/App.tsx
  - src/tui/change-filter.ts
  - src/tui/tree-model.ts
  - src/tui/ChangeTree.tsx
  - src/tui/AuthorPicker.tsx
  - src/tui/keymap.ts
tests:
  - test/tui/App.test.tsx
  - test/tui/change-order.test.ts
  - test/tui/change-filter.test.ts
-->

---
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


<!-- @trace
source: herdr-spectra-pane-actions
updated: 2026-09-09
code:
  - src/tui/FilterLine.tsx
  - src/tui/change-order.ts
  - src/tui/StatusBar.tsx
  - src/tui/App.tsx
  - src/tui/change-filter.ts
  - src/tui/tree-model.ts
  - src/tui/ChangeTree.tsx
  - src/tui/AuthorPicker.tsx
  - src/tui/keymap.ts
tests:
  - test/tui/App.test.tsx
  - test/tui/change-order.test.ts
  - test/tui/change-filter.test.ts
-->

---
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

<!-- @trace
source: herdr-spectra-pane-actions
updated: 2026-09-09
code:
  - src/tui/FilterLine.tsx
  - src/tui/change-order.ts
  - src/tui/StatusBar.tsx
  - src/tui/App.tsx
  - src/tui/change-filter.ts
  - src/tui/tree-model.ts
  - src/tui/ChangeTree.tsx
  - src/tui/AuthorPicker.tsx
  - src/tui/keymap.ts
tests:
  - test/tui/App.test.tsx
  - test/tui/change-order.test.ts
  - test/tui/change-filter.test.ts
-->

---
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

---
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
