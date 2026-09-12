## Purpose

Distributing and running this viewer as a command-line program of its own, independently of Herdr. Covers the package metadata that makes it installable and runnable by name, the entry-point decision that has to survive being invoked through a symbolic link, and the path that shows an artifact in the terminal the pane already occupies when no Herdr is present.

## ADDED Requirements

### Requirement: Publish the pane as a command-line program

The package SHALL be publishable to the npm registry as `spectra-viewer`, and SHALL declare the pane entry point as an executable command under two names: `spectra-viewer` and `sv`. The package name SHALL match one of the declared command names, because `npx <package>` looks for a command whose name equals the package name; a package whose commands are all named differently cannot be run that way.

The package SHALL NOT be marked private. Its declared file set SHALL be limited to the compiled output directory, so that no source or test file is distributed. A published archive also carries the package manifest, the readme, and the licence, because a package manager includes those three whatever the declared file set says; they are not sources and are expected in a published package.

The pane source file SHALL begin with an interpreter directive line, and the compiled pane output SHALL carry that line as its first line, so the command can be executed directly rather than only through `node`.

The build SHALL run before publication rather than after installation: the package SHALL declare a pre-publication script that compiles the TypeScript sources, and SHALL NOT rely on an installation-time script to produce the compiled output. The compiled output is not in version control, so it must be produced before packing; running it at installation time instead would require every consumer to permit an installation script.

#### Scenario: The published command is discoverable by its package name

- **WHEN** the package metadata is read
- **THEN** the package name is `spectra-viewer` and one of the declared command names is also `spectra-viewer`

#### Scenario: The packed archive carries no sources or tests

- **WHEN** the package is packed
- **THEN** every file in the archive is either under the compiled output directory or one of the package manifest, the readme, and the licence, and no source or test file is present

#### Scenario: The compiled pane is directly executable

- **WHEN** the TypeScript sources are compiled
- **THEN** the first line of the compiled pane output is the interpreter directive line

#### Scenario: Installing the package requires no build step

- **GIVEN** a packed archive produced after the pre-publication script ran
- **WHEN** the archive is installed into a project
- **THEN** the command is runnable without any compilation happening during installation

---

### Requirement: Run the entry point when invoked through a symbolic link

Each entry point SHALL decide whether it is the program being run by comparing its own module URL with the **resolved** path of the first process argument, and SHALL treat a path that resolves to the entry point's own file as a match. Package managers install commands as symbolic links, so the first process argument is the link while the module URL is the file the link points at; comparing them without resolving the link never matches, and the entry point then performs no work, produces no output, and exits with code 0.

The comparison SHALL convert the resolved path to a file URL using a path-to-URL conversion, and SHALL NOT build the URL by string concatenation, because a concatenated URL does not percent-encode a path containing a space, `#`, or `?` and therefore fails to match a path that is otherwise correct.

When the first process argument is absent, or when its real path cannot be resolved, the entry point SHALL decide that it is not the program being run, and SHALL NOT allow the resolution failure to propagate as an error.

Both the pane entry point and the open action entry point SHALL use one shared implementation of this decision, so the rule cannot differ between them.

#### Scenario: Invocation through an installed command link

- **GIVEN** a symbolic link whose target is the compiled pane output
- **WHEN** the pane is invoked through that link's path
- **THEN** the pane starts and renders its first frame

#### Scenario: Invocation by direct path

- **WHEN** the pane is invoked by the path of the compiled pane output itself
- **THEN** the pane starts and renders its first frame

#### Scenario: A path containing a space

- **GIVEN** an entry point whose file path contains a space
- **WHEN** it is invoked by that path
- **THEN** it decides that it is the program being run

#### Scenario: Imported rather than invoked

- **GIVEN** an entry point module that is imported by another module
- **WHEN** the first process argument names a different file
- **THEN** the entry point performs no work

#### Scenario: An unresolvable first argument

- **GIVEN** a first process argument naming a path that does not exist
- **WHEN** the decision is made
- **THEN** it decides that it is not the program being run, and no error propagates

##### Example: entry point decision cases

| First process argument | Relation to the module | Decision |
| --- | --- | --- |
| the module's own path | same file | run |
| a symbolic link to the module | same file after resolution | run |
| the module's own path containing a space | same file | run |
| another existing file's path | different file | do not run |
| a path that does not exist | unresolvable | do not run |
| absent | none | do not run |

---

### Requirement: Show an artifact in the terminal when Herdr is absent

When the invocation context carries no Herdr binary path, opening an artifact SHALL display it in the terminal the pane already occupies, by handing that terminal to the viewer command and taking it back when the viewer ends. The viewer command SHALL be resolved by the same three sources the Herdr path uses — the `SPECTRA_VIEWER` environment variable, the plugin configuration file's `viewer` field, then `less` — and SHALL NOT consult `PAGER`, for the same reason `EDITOR` is not consulted: the variable is shared with other tools, so a value set for them would silently select the viewer here.

Handing over the terminal SHALL disable mouse reporting, clear the rendered frame, and stop the pane reading input, in that order. Taking it back SHALL resume reading input, re-enable mouse reporting, and redraw the frame. The terminal SHALL be taken back whether the viewer ended successfully or not.

The viewer SHALL be run with an argument vector and without a shell, with the artifact's absolute path as one argument, and with the process's own input, output, and error streams inherited so that the viewer drives the terminal directly. The pane SHALL wait for the viewer to end before taking the terminal back.

A viewer that cannot be started, or that ends with a non-zero status, SHALL be reported as a failure to the caller rather than raised as an error. Opening this way SHALL report no pane, because none is created.

The status bar SHALL show `Opened in <viewer command>` once the viewer has ended, and `Could not open viewer` when it failed. When the artifact file does not exist, the status bar SHALL show `File not found: <relative path>`, no viewer SHALL be started, and the terminal SHALL NOT be handed over.

#### Scenario: An artifact is shown without Herdr

- **GIVEN** the invocation context carries no Herdr binary path, `SPECTRA_VIEWER` is unset, and no configuration file is present
- **WHEN** the user opens an artifact
- **THEN** the terminal is handed over, `less` is run with the artifact's absolute path as one argument and the process's streams inherited, and the terminal is taken back after `less` ends

#### Scenario: The viewer command is resolved the same way as under Herdr

- **GIVEN** the invocation context carries no Herdr binary path and `SPECTRA_VIEWER` is `nvim`
- **WHEN** the user opens an artifact
- **THEN** `nvim` is run, and the status bar shows `Opened in nvim` once it ends

#### Scenario: PAGER does not select the viewer

- **GIVEN** the invocation context carries no Herdr binary path, `PAGER` is `bat`, and `SPECTRA_VIEWER` is unset
- **WHEN** the user opens an artifact
- **THEN** `less` is run, not `bat`

#### Scenario: The terminal is handed over before the viewer starts

- **WHEN** an artifact is opened without Herdr
- **THEN** mouse reporting is disabled, the frame is cleared, and input reading is stopped, all before the viewer is started

#### Scenario: A viewer that fails still returns the terminal

- **GIVEN** the viewer cannot be started
- **WHEN** an artifact is opened without Herdr
- **THEN** the terminal is taken back, the failure is reported to the caller, and the status bar shows `Could not open viewer`

#### Scenario: A missing file does not hand over the terminal

- **GIVEN** the cursor is on an artifact whose file does not exist
- **WHEN** the user opens it
- **THEN** the status bar shows `File not found: <relative path>`, no viewer is started, and the terminal is not handed over

---

### Requirement: Select the artifact viewer by the invocation environment

The pane SHALL choose which artifact-opening path to use once, when it starts, from whether the invocation context carries a Herdr binary path. A context carrying one SHALL use the Herdr adapter; a context carrying none SHALL use the terminal viewer. The choice SHALL be made where the pane's dependencies are assembled, so that the tree and its key handling are unaware of which path is in use.

An opening that creates no pane SHALL report no pane identifier rather than a placeholder one.

#### Scenario: Herdr present

- **GIVEN** the invocation context carries a Herdr binary path
- **WHEN** the user opens an artifact
- **THEN** the Herdr adapter is used and no terminal hand-over occurs

#### Scenario: Herdr absent

- **GIVEN** the invocation context carries no Herdr binary path
- **WHEN** the user opens an artifact
- **THEN** the terminal viewer is used and no Herdr call is made

#### Scenario: An opening that creates no pane

- **WHEN** the terminal viewer reports success
- **THEN** the reported pane identifier is absent
