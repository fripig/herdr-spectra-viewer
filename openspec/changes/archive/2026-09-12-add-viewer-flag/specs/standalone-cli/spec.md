## ADDED Requirements

### Requirement: Accept options on the command line

The program SHALL settle its command-line arguments before any other startup work, so that no argument handling depends on scanning the project, on reaching Herdr, on terminal mouse reporting, or on a frame having been drawn. The arguments SHALL be those following the program's own path; the program SHALL accept no positional arguments, because the project it shows is the directory it is run from.

Three options SHALL be accepted, in long form only: `--viewer` taking a viewer command line as its value, `--help`, and `--version`. The value of `--viewer` SHALL be accepted both as the following argument and as the remainder after an equals sign in the same argument. No short alias SHALL be accepted for any of the three.

When more than one of these options is present, the outcome SHALL be decided in a fixed order: `--help` anywhere among the arguments SHALL print the usage text; otherwise `--version` anywhere among them SHALL print the version; otherwise an unrecognised option or a positional argument SHALL be a usage error; otherwise the program SHALL start normally. An unrecognised option present alongside `--help` SHALL therefore print the usage text rather than a usage error.

`--help` SHALL write the usage text to standard output and exit with status 0. The usage text SHALL name all three options, SHALL state that the program takes no positional arguments and reads the project from the current working directory, SHALL state the order of the four viewer sources, and SHALL state that a viewer command carrying options of its own has to be quoted so that it reaches the program as one argument.

`--version` SHALL write the package's own version to standard output and exit with status 0. The version SHALL be read from the package's `package.json` at run time rather than held as a second copy in the program. When that file cannot be read, or when its `version` field is not a string, the program SHALL write one line to standard error and exit with status 1, and SHALL NOT print a placeholder version.

An unrecognised option, and any positional argument, SHALL be a usage error: the program SHALL write one line naming the offending argument and one line pointing at `--help` to standard error, SHALL exit with status 2, and SHALL NOT start the pane.

`--viewer` SHALL yield a viewer command when its value holds at least one non-whitespace character, with surrounding whitespace removed. It SHALL yield none when no value follows it, when its value is empty, and when its value holds only whitespace; each of those SHALL write one warning line to standard error, SHALL leave the source passed over so that the next viewer source applies, SHALL NOT prevent the pane from starting, and SHALL NOT change the exit status. When `--viewer` is given more than once, the last occurrence SHALL decide the outcome, including when that last occurrence yields none.

#### Scenario: A viewer command given on the command line

- **WHEN** the program is started with `--viewer` and a value of `mdcat -p`
- **THEN** the pane starts and its viewer command is `mdcat -p`

#### Scenario: Asking for help prints usage and stops

- **WHEN** the program is started with `--help`
- **THEN** the usage text naming all three options is written to standard output, the exit status is 0, and no pane is started

#### Scenario: Asking for help works without a terminal

- **GIVEN** the program's output is a pipe rather than a terminal
- **WHEN** the program is started with `--help`
- **THEN** the usage text is written and the exit status is 0

#### Scenario: Asking for the version prints it and stops

- **WHEN** the program is started with `--version`
- **THEN** the version recorded in the package's `package.json` is written to standard output, the exit status is 0, and no pane is started

#### Scenario: A version that cannot be read is reported rather than guessed

- **GIVEN** the package's `package.json` cannot be read
- **WHEN** the program is started with `--version`
- **THEN** one line is written to standard error, the exit status is 1, and no version string is written to standard output

#### Scenario: An unrecognised option is refused

- **WHEN** the program is started with `--bogus`
- **THEN** one line naming `--bogus` and one line pointing at `--help` are written to standard error, the exit status is 2, and no pane is started

#### Scenario: An unquoted viewer command is refused rather than silently trimmed

- **WHEN** the program is started with `--viewer`, a value of `bat`, and a further argument of `--style=plain`
- **THEN** the usage error names `--style=plain`, the exit status is 2, and no pane is started with a viewer command of `bat`

#### Scenario: A positional argument is refused

- **WHEN** the program is started with a single argument of `openspec`
- **THEN** the usage error names `openspec`, the exit status is 2, and no pane is started

#### Scenario: A viewer option with no usable value warns and falls back

- **GIVEN** `SPECTRA_VIEWER` is `nvim`
- **WHEN** the program is started with `--viewer` as its final argument
- **THEN** one warning line is written to standard error, the pane starts, and its viewer command is `nvim`

#### Scenario: Help wins over an unrecognised option

- **WHEN** the program is started with `--help` and `--bogus`
- **THEN** the usage text is written to standard output and the exit status is 0

##### Example: outcome per argument list

| arguments                      | outcome                                          | exit status |
| ------------------------------ | ------------------------------------------------ | ----------- |
| none                           | the pane starts, no command-line viewer          | pane's own  |
| `--viewer less`                | the pane starts with viewer `less`               | pane's own  |
| `--viewer=less`                | the pane starts with viewer `less`               | pane's own  |
| `--help`                       | usage text on standard output                    | 0           |
| `--version`                    | version on standard output                       | 0           |
| `--help --version`             | usage text on standard output                    | 0           |
| `--version --help`             | usage text on standard output                    | 0           |
| `--help --bogus`               | usage text on standard output                    | 0           |
| `--bogus`                      | usage error naming `--bogus`                     | 2           |
| `--viewer bat --style=plain`   | usage error naming `--style=plain`               | 2           |
| `openspec`                     | usage error naming `openspec`                    | 2           |
| `--viewer`                     | one warning, the pane starts, no command-line viewer | pane's own  |

##### Example: viewer command per argument list

| arguments                      | viewer command from the command line | warning reported |
| ------------------------------ | ------------------------------------ | ---------------- |
| `--viewer mdcat`               | `mdcat`                              | no               |
| `--viewer=mdcat`               | `mdcat`                              | no               |
| `--viewer "mdcat -p"`          | `mdcat -p`                           | no               |
| `--viewer="mdcat -p"`          | `mdcat -p`                           | no               |
| `--viewer "  bat  "`           | `bat`                                | no               |
| `--viewer ""`                  | none                                 | yes              |
| `--viewer=`                    | none                                 | yes              |
| `--viewer "   "`               | none                                 | yes              |
| `--viewer` as final argument   | none                                 | yes              |
| `--viewer a --viewer b`        | `b`                                  | no               |
| `--viewer a --viewer "  "`     | none                                 | yes              |
