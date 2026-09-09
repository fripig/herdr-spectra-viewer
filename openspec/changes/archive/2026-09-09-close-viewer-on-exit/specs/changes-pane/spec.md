## MODIFIED Requirements

### Requirement: Provide a Spectra changes pane

The plugin SHALL provide a Herdr pane with entrypoint id `changes` that renders a terminal UI listing Spectra changes. The pane SHALL run one scan of the resolved project root when it starts, and SHALL exit with code 0 when the user presses `q` or Escape. Before rendering its first frame the pane SHALL enable terminal mouse reporting by writing `ESC[?1000h` followed by `ESC[?1006h` to stdout. On every exit path, including `q`, Escape, exit after sending a command, SIGINT, SIGTERM, and SIGHUP, the pane SHALL disable mouse reporting by writing `ESC[?1006l` followed by `ESC[?1000l` before the process ends.

On every one of those exit paths the pane SHALL also close the viewer pane it remembers, so no viewer pane outlives the pane that opened it. The close SHALL run synchronously, because a pane closed by Herdr leaves the process only a signal handler's worth of time. The remembered pane id SHALL be cleared by the close, so an exit path that runs after another one issues no second close. When no viewer pane is remembered, the exit path SHALL issue no close. The outcome of the close SHALL be ignored: a non-zero exit, a not-found error for a viewer that has already gone, and a failure to run Herdr at all SHALL NOT change the process exit code, SHALL NOT be written to stderr, and SHALL NOT prevent the process from ending.

#### Scenario: Pane opens and scans

- **WHEN** Herdr launches the `changes` pane in a workspace whose project root contains an `openspec` directory
- **THEN** a scan runs and the tree is populated from its result

#### Scenario: Pane exits on request

- **WHEN** the user presses `q` or Escape
- **THEN** the pane process exits with code 0 and the overlay closes

#### Scenario: Quitting closes the viewer pane

- **GIVEN** an earlier open created viewer pane `p9` and it is the remembered viewer pane
- **WHEN** the user presses `q`
- **THEN** Herdr is asked to close pane `p9` before the process ends, and the process exits with code 0

#### Scenario: Exiting after a command closes the viewer pane

- **GIVEN** an earlier open created viewer pane `p9` and the user presses a command key whose send succeeds
- **WHEN** the pane exits with code 0
- **THEN** Herdr is asked to close pane `p9` before the process ends

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

- **WHEN** the pane exits through `q`, Escape, a successful command send, SIGINT, SIGTERM, or SIGHUP
- **THEN** stdout receives `ESC[?1006l` and `ESC[?1000l` before the process ends

##### Example: exit paths

| Exit path                    | Exit code | Mouse disabled | Remembered viewer pane closed |
| ---------------------------- | --------- | -------------- | ----------------------------- |
| `q` or Escape                | 0         | yes            | yes                           |
| after a command was sent     | 0         | yes            | yes                           |
| SIGINT                       | 130       | yes            | yes                           |
| SIGTERM                      | 143       | yes            | yes                           |
| SIGHUP                       | 129       | yes            | yes                           |
