## MODIFIED Requirements

### Requirement: Resolve the invocation context from the environment

The Herdr adapter SHALL build an invocation context from the process environment. The project root SHALL be taken from the JSON in `HERDR_PLUGIN_CONTEXT_JSON` when that variable is set and parses as JSON: the `workspace_cwd` field when it holds a non-empty string, otherwise the `workspace.cwd` field when it holds a non-empty string; when neither is present the project root SHALL be the process working directory. When the variable is set but does not parse, a warning SHALL be written to stderr. The pane id SHALL be the value of `HERDR_PANE_ID` when set and non-empty, otherwise null.

The context SHALL also carry a command target pane id, which is the pane a Spectra command is written into. It SHALL be the `focused_pane_id` field of the context JSON when that field holds a non-empty string, otherwise the pane id. The pane id and the command target pane id SHALL be separate fields: the pane id identifies the pane the plugin itself runs in and is the pane used for splitting and for reading a working directory, while the command target pane id identifies the pane that invoked the plugin. The Herdr binary path SHALL be the value of `HERDR_BIN_PATH` when set and non-empty, otherwise null.

#### Scenario: Context from a Herdr invocation

- **GIVEN** `HERDR_PLUGIN_CONTEXT_JSON` is `{"workspace":{"cwd":"/repo"}}`, `HERDR_PANE_ID` is `p1`, and `HERDR_BIN_PATH` is `/usr/local/bin/herdr`
- **WHEN** the context is read
- **THEN** the project root is `/repo`, the pane id is `p1`, the command target pane id is `p1`, and the binary path is `/usr/local/bin/herdr`

#### Scenario: Context from a plugin pane opened by an action

- **GIVEN** `HERDR_PANE_ID` is `w4:p1C` and `HERDR_PLUGIN_CONTEXT_JSON` is `{"workspace_cwd":"/repo","focused_pane_id":"w4:p1"}`
- **WHEN** the context is read
- **THEN** the project root is `/repo`, the pane id is `w4:p1C`, and the command target pane id is `w4:p1`

#### Scenario: Context without Herdr

- **GIVEN** none of the Herdr environment variables are set and the process working directory is `/work`
- **WHEN** the context is read
- **THEN** the project root is `/work`, the pane id is null, the command target pane id is null, and the binary path is null

##### Example: project root resolution cases

| `HERDR_PLUGIN_CONTEXT_JSON`     | cwd     | Project root | stderr warning |
| ------------------------------- | ------- | ------------ | -------------- |
| `{"workspace_cwd":"/repo"}`     | `/work` | `/repo`      | no             |
| `{"workspace":{"cwd":"/repo"}}` | `/work` | `/repo`      | no             |
| `{"workspace_cwd":""}`          | `/work` | `/work`      | no             |
| `{"workspace":{}}`              | `/work` | `/work`      | no             |
| `not json`                      | `/work` | `/work`      | yes            |
| unset                           | `/work` | `/work`      | no             |

##### Example: command target pane resolution cases

| `HERDR_PANE_ID` | `focused_pane_id` in context JSON | Command target pane id |
| --------------- | --------------------------------- | ---------------------- |
| `w4:p1C`        | `w4:p1`                           | `w4:p1`                |
| `w4:p1C`        | absent                            | `w4:p1C`               |
| `w4:p1C`        | `""`                              | `w4:p1C`               |
| unset           | `w4:p1`                           | `w4:p1`                |
| unset           | absent                            | null                   |
