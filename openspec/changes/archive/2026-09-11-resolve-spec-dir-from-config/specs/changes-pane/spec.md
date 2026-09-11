## MODIFIED Requirements

### Requirement: Indicate loading, empty, and warning states

While a scan is running, the tree area SHALL show `Scanning…`. When the project's resolved spec directory does not exist, the pane SHALL replace the tree with the message `This project is not initialised for Spectra (no spec directory).` and the status bar SHALL still show the quit key. The message SHALL NOT name a fixed directory, because the spec directory is resolved from the project's configuration and differs between projects. When the snapshot's warning list is non-empty, the status bar SHALL show `<N> warning(s)` where N is the number of warnings; that list carries both skipped changes and configuration warnings, so the text SHALL NOT describe the count as skipped changes.

#### Scenario: Loading indicator

- **WHEN** a scan is in progress
- **THEN** the tree area shows `Scanning…`

#### Scenario: Project without Spectra

- **GIVEN** a project root whose resolved spec directory does not exist
- **WHEN** the pane starts
- **THEN** the message `This project is not initialised for Spectra (no spec directory).` is shown instead of the tree

#### Scenario: A project using the configured spec directory is not reported as uninitialised

- **GIVEN** a project root holding a `.spectra.yaml` containing `spec_dir: docs/spectra`, and a `docs/spectra/` directory
- **WHEN** the pane starts
- **THEN** the tree is shown and the uninitialised message is not shown

#### Scenario: Warnings are counted in the status bar

- **GIVEN** a scan whose warning list has two entries
- **WHEN** the pane renders the snapshot
- **THEN** the status bar shows `2 warning(s)`
