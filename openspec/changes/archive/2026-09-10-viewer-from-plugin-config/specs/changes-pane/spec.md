## MODIFIED Requirements

### Requirement: Open an artifact in the editor

Pressing `e` on an artifact node SHALL open that file in the user's viewer in a new pane split to the right of the pane that invoked the plugin, using the Herdr adapter. The viewer command SHALL be resolved from three sources, in order: the `SPECTRA_VIEWER` environment variable with surrounding whitespace removed; the `viewer` field of the plugin's configuration file with surrounding whitespace removed; and `less`. A source SHALL be used when it yields a non-empty string, and SHALL be passed over otherwise. The `EDITOR` environment variable SHALL NOT be consulted. The command run in the new pane SHALL be the viewer command, followed by the shell-quoted absolute path of the artifact, followed by a shell statement separator and the `exit` builtin, so the pane closes once the viewer ends, whether the viewer ended successfully or with an error.

The plugin's configuration file SHALL be `config.json` in the directory named by the `HERDR_PLUGIN_CONFIG_DIR` environment variable, and SHALL be read once when the pane starts. Its content SHALL be a JSON object, of which only the `viewer` field SHALL be read. The configuration source SHALL be passed over when `HERDR_PLUGIN_CONFIG_DIR` is unset or empty, when the file cannot be read, when its content is not valid JSON, when its top level is not an object, when the `viewer` field is absent, when the `viewer` field is not a string, and when the `viewer` field holds only whitespace. A file that exists but cannot be used SHALL report one warning line; an absent directory, an absent file, and an absent `viewer` field SHALL report nothing. No configuration failure SHALL prevent the pane from starting or change the process exit code.

At most one viewer pane SHALL exist at a time. The plugin SHALL remember the pane id of the viewer pane it most recently created. When a viewer pane is remembered, an open SHALL ask Herdr to close that pane before splitting the new one, so the call order is close, then split, then run. The outcome of that close SHALL be ignored, including the not-found error a pane that has already gone reports, and SHALL NOT reach the status bar or prevent the split. When no viewer pane is remembered, an open SHALL NOT issue a close. A successful open SHALL remember the pane it created. An open whose split fails SHALL remember no pane. The remembered pane id SHALL NOT be probed for liveness before it is closed.

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
