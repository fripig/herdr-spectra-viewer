## ADDED Requirements

### Requirement: Resolve the spec directory from project configuration

The discovery module SHALL determine the spec directory of a project by reading `.spectra.yaml` in the project root, and SHALL NOT infer the layout from which directories exist on disk. The resolution rule SHALL match the rule the Spectra CLI applies, so that the viewer and the CLI never disagree about a project's layout.

When `.spectra.yaml` parses as a YAML mapping and holds a `spec_dir` key whose value is a non-empty string, the spec directory SHALL be that value resolved against the project root. When `.spectra.yaml` is absent, unreadable, or holds no `spec_dir` key, the spec directory SHALL be `openspec` under the project root and no warning SHALL be produced, because that is the normal state of a project created by an older Spectra or by OpenSpec.

When `.spectra.yaml` exists but cannot be used — its content does not parse as YAML, `spec_dir` is present but is not a string, `spec_dir` is a string that is empty after trimming, or `spec_dir` resolves to a path outside the project root — the spec directory SHALL be `openspec` under the project root and the scan SHALL record one warning naming the configuration file and the fallback. A file whose top-level value is not a mapping SHALL resolve to `openspec` without a warning, because it carries no `spec_dir` key.

Resolution SHALL use non-blocking file system APIs only.

#### Scenario: A new-layout project is resolved from its configuration

- **GIVEN** the project root holds a `.spectra.yaml` containing `spec_dir: docs/spectra`
- **WHEN** the spec directory is resolved
- **THEN** the spec directory is `docs/spectra` under the project root and no warning is produced

#### Scenario: A project without the field falls back to the legacy directory

- **GIVEN** the project root holds a `.spectra.yaml` in which the `spec_dir` line is commented out
- **WHEN** the spec directory is resolved
- **THEN** the spec directory is `openspec` under the project root and no warning is produced

#### Scenario: A project without the configuration file falls back to the legacy directory

- **GIVEN** the project root holds no `.spectra.yaml`
- **WHEN** the spec directory is resolved
- **THEN** the spec directory is `openspec` under the project root and no warning is produced

#### Scenario: An unusable configuration file falls back and warns

- **GIVEN** the project root holds a `.spectra.yaml` whose content does not parse as YAML
- **WHEN** a scan runs
- **THEN** the spec directory is `openspec` under the project root and the snapshot's warning list gains one entry naming `.spectra.yaml`

#### Scenario: A spec_dir pointing outside the project root is refused

- **GIVEN** the project root holds a `.spectra.yaml` containing a `spec_dir` value that resolves outside the project root
- **WHEN** a scan runs
- **THEN** the spec directory is `openspec` under the project root and the snapshot's warning list gains one entry

##### Example: resolution outcomes

| `.spectra.yaml` state | Spec directory | Warning |
| --- | --- | --- |
| absent | `<root>/openspec` | no |
| present, no `spec_dir` key | `<root>/openspec` | no |
| `spec_dir: docs/spectra` | `<root>/docs/spectra` | no |
| `spec_dir: openspec` | `<root>/openspec` | no |
| not valid YAML | `<root>/openspec` | yes |
| top-level value is not a mapping | `<root>/openspec` | no |
| `spec_dir: 42` | `<root>/openspec` | yes |
| `spec_dir: "   "` | `<root>/openspec` | yes |
| `spec_dir: /etc` | `<root>/openspec` | yes |
| `spec_dir: ../outside` | `<root>/openspec` | yes |

## MODIFIED Requirements

### Requirement: Scan changes from all three Spectra sources

The discovery module SHALL discover Spectra changes by reading the file system directly, without invoking the `spectra` CLI or reading the Spectra internal database. A scan SHALL take a project root directory as input and produce a snapshot containing three groups of changes: Active, Parked, and Archived.

A scan SHALL first resolve the project's spec directory from its configuration. Active changes SHALL be the immediate subdirectories of `changes/` under the resolved spec directory, excluding the directory named `archive`. Archived changes SHALL be the immediate subdirectories of `changes/archive/` under the resolved spec directory. Parked changes SHALL be the immediate subdirectories of `spectra-app/changes/` under the resolved git directory, independently of the spec directory.

The order of changes within a group is unspecified. Callers SHALL NOT depend on it; ordering is decided by the presentation layer.

#### Scenario: All three sources contain changes

- **WHEN** a scan runs against a project root that has active, parked, and archived change directories
- **THEN** the snapshot contains each change in exactly the group matching its source directory

##### Example: legacy layout

- **GIVEN** the project root has no `spec_dir` configured and contains `openspec/changes/add-search/`, `openspec/changes/archive/old-login/`, and `.git/spectra-app/changes/dark-mode/`
- **WHEN** a scan runs
- **THEN** Active contains `add-search`, Archived contains `old-login`, and Parked contains `dark-mode`

##### Example: configured layout

- **GIVEN** the project root holds a `.spectra.yaml` containing `spec_dir: docs/spectra`, and contains `docs/spectra/changes/add-search/`, `docs/spectra/changes/archive/old-login/`, and `.git/spectra-app/changes/dark-mode/`
- **WHEN** a scan runs
- **THEN** Active contains `add-search`, Archived contains `old-login`, and Parked contains `dark-mode`

#### Scenario: The archive directory is not treated as an active change

- **WHEN** a scan runs against a project root where `changes/archive/` exists under the resolved spec directory
- **THEN** no change named `archive` appears in the Active group

#### Scenario: A source directory is absent

- **WHEN** a scan runs and one of the three source directories does not exist
- **THEN** the corresponding group is empty and the remaining groups are populated normally

#### Scenario: Changes under the legacy directory are ignored when another spec directory is configured

- **GIVEN** the project root holds a `.spectra.yaml` containing `spec_dir: docs/spectra`, and both `docs/spectra/changes/add-search/` and `openspec/changes/stale-one/` exist
- **WHEN** a scan runs
- **THEN** the Active group contains `add-search` and does not contain `stale-one`

#### Scenario: Every discovered change is present regardless of order

- **GIVEN** `changes/` under the resolved spec directory contains directories `zebra-fix`, `add-search`, and `mid-tier`
- **WHEN** a scan runs
- **THEN** the Active group contains exactly those three changes, in any order
