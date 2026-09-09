## MODIFIED Requirements

### Requirement: Open an artifact in the editor

Pressing `e` on an artifact node SHALL open that file in the user's viewer in a new pane split to the right of the pane that invoked the plugin, using the Herdr adapter. The viewer command SHALL be the value of the `SPECTRA_VIEWER` environment variable with surrounding whitespace removed, or `less` when that variable is unset, empty, or whitespace only. The `EDITOR` environment variable SHALL NOT be consulted. The command run in the new pane SHALL be the viewer command, followed by the shell-quoted absolute path of the artifact, followed by a shell statement separator and the `exit` builtin, so the pane closes once the viewer ends, whether the viewer ended successfully or with an error.

At most one viewer pane SHALL exist at a time. The plugin SHALL remember the pane id of the viewer pane it most recently created. When a viewer pane is remembered, an open SHALL ask Herdr to close that pane before splitting the new one, so the call order is close, then split, then run. The outcome of that close SHALL be ignored, including the not-found error a pane that has already gone reports, and SHALL NOT reach the status bar or prevent the split. When no viewer pane is remembered, an open SHALL NOT issue a close. A successful open SHALL remember the pane it created. An open whose split fails SHALL remember no pane. The remembered pane id SHALL NOT be probed for liveness before it is closed.

The status bar SHALL show `Opened in <viewer command>` on success. The plugin pane SHALL stay open afterwards. When the file does not exist, the status bar SHALL show `File not found: <relative path>`, no split SHALL be created, and no pane SHALL be closed. When the adapter reports a failure, the status bar SHALL show `Could not open viewer` and nothing else SHALL change. Pressing `e` on a group or change node SHALL do nothing.

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

#### Scenario: The first open closes nothing

- **GIVEN** no artifact has been opened since the pane started
- **WHEN** the user presses `e` on an artifact node
- **THEN** the adapter issues a split and a run, and no close

#### Scenario: A second open replaces the first viewer pane

- **GIVEN** an earlier open created viewer pane `p9` and its viewer is still running
- **WHEN** the user presses `e` on another artifact node
- **THEN** the adapter closes `p9`, then splits a new pane, then runs the viewer in it, and the status bar shows `Opened in <viewer command>`

##### Example: Herdr calls per open

| open | remembered pane before | calls issued, in order | remembered pane after |
| ---- | ---------------------- | ---------------------- | --------------------- |
| 1st  | none                   | split, run             | `p9`                  |
| 2nd  | `p9`                   | close `p9`, split, run | `p10`                 |
| 3rd  | `p10`                  | close `p10`, split, run | `p11`                |

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
