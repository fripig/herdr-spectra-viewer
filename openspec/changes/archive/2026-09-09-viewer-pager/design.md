## Context

The changes pane opens an artifact by asking the Herdr adapter to split a pane and then run a command in it. The command it runs today is the editor command followed by the quoted artifact path. Two consequences follow from that shape:

1. The command source is the `EDITOR` environment variable, which is shared with git, crontab, and every other tool on the machine. A user who wants a pager here cannot ask for one without changing how those other tools behave.
2. The pane runs a shell, and the shell outlives the command. When the editor exits the shell returns to a prompt, so the pane remains until it is closed by hand.

Herdr's own behaviour was measured before this design was written. Running a command that ends with a shell exit in a split pane caused Herdr to reclaim the pane: a subsequent pane lookup for that pane id returned a `pane_not_found` error. No Herdr-side close call was needed. That measurement is what makes the decision below cheap.

## Goals / Non-Goals

**Goals:**

- Let the user choose the artifact viewer without touching machine-wide editor configuration.
- Default to a pager, because reading an artifact is the common case.
- Make the viewer pane disappear on its own when the user leaves the viewer.

**Non-Goals:**

- Reusing a single viewer pane across multiple opens. Once panes close themselves, they no longer accumulate, so pane reuse would add state for no observable benefit.
- Rendering artifacts inside the changes pane itself. That is a different capability with its own layout and scrolling concerns.
- Honouring `EDITOR` as a fallback. A two-level fallback makes the effective viewer depend on unrelated machine configuration and is harder to predict than a single variable with a fixed default.
- Passing extra flags to the default pager. A user who wants syntax highlighting or colour handling sets `SPECTRA_VIEWER` to a full command instead.

## Decisions

### Read the viewer command from SPECTRA_VIEWER

The viewer command is the trimmed value of `SPECTRA_VIEWER` when that variable is set and non-empty, and the literal pager `less` otherwise. `EDITOR` is not read at all.

Alternative considered: keep reading `EDITOR` as a middle fallback. Rejected because the resulting viewer would depend on configuration written for other tools, so the same plugin would behave differently on two machines that both left `SPECTRA_VIEWER` unset.

Alternative considered: hard-code the pager and drop the variable. Rejected because editing an artifact from the pane is still a reasonable thing to want, and a variable is a one-line escape hatch.

### Close the viewer pane by appending an exit to the shell command

The adapter appends a shell separator and an exit builtin to the command it runs in the new pane, so the shell terminates as soon as the viewer process does. Herdr then reclaims the pane. The separator is a semicolon rather than a conditional, so the pane closes on both success and failure of the viewer.

Alternative considered: record the new pane id and issue a Herdr close call later. Rejected because nothing in the plugin observes when the viewer exits, so this would require polling and pane lifetime bookkeeping in the pane component.

Alternative considered: use a conditional separator so a failing viewer leaves its pane open for reading the error. Rejected in discussion: an inconsistent pane lifetime is more confusing than a lost error message, and a missing viewer binary is diagnosed faster from the status bar than from a pane that sometimes lingers.

### Keep one split per open instead of reusing a viewer pane

Every open creates a new split, as it does today. No pane id is remembered between opens.

Alternative considered: reuse the last viewer pane when it still exists. Rejected as premature: self-closing panes remove the accumulation problem that pane reuse would solve.

### Use viewer wording in the status bar

The success message names the viewer command and the adapter failure message refers to the viewer rather than the editor, so the vocabulary in the interface matches the vocabulary in the configuration.

## Implementation Contract

**Behavior.** With no environment set, pressing Enter or `e` on an artifact node, or clicking one, splits a pane to the right of the invoking pane and shows the artifact in the pager. Pressing `q` in the pager ends it, the pane disappears without further input, and the changes pane is left as it was. Setting `SPECTRA_VIEWER` to another command shows the artifact in that command instead. Setting it to a command that does not exist still leaves no pane behind.

**Interface.** The environment variable is named `SPECTRA_VIEWER`. Its value is used verbatim as the start of a shell command line, so a value carrying flags works without extra quoting by the caller. The artifact path is shell-quoted by the plugin before it is appended. The resulting command line has three parts in order: the viewer command, the quoted absolute artifact path, and a shell statement separator followed by the exit builtin.

**Failure modes.** A missing artifact file is caught before any pane is split, and the status bar shows the existing not-found message with the artifact path relative to its change directory. An adapter failure — the split or the run call reporting a non-zero exit — surfaces as a status bar message naming the viewer, and the tree is unchanged. A viewer that starts and then fails is not detected by the plugin: its pane closes like any other, and whatever it printed is lost. That silence is intentional and is the accepted cost of the uniform pane lifetime chosen above.

**Acceptance criteria.**

- The adapter unit suite asserts the exact command string handed to the Herdr run call, including the quoted path and the trailing exit, for both a default and an overridden viewer.
- The pane entry point unit suite asserts the resolved viewer for three environments: variable unset, variable set to a command, variable set to an empty or whitespace-only string.
- The App suite asserts the success status message names the resolved viewer, and that adapter failure produces the viewer-worded failure message.
- Manual check in a live Herdr session: open an artifact, press `q`, and confirm with a Herdr pane lookup that the pane id returned by the split no longer exists.

**Scope boundaries.** In scope: the viewer command source, the command string built by the adapter, the two status bar messages, the affected specs, and the README description of both. Out of scope: which keys open an artifact, the tree, the mouse behaviour, the command-sending keys, and the scan.

## Risks / Trade-offs

- A user with `EDITOR` set who upgrades silently gets the pager instead of their editor → the proposal marks this as breaking and the README names `SPECTRA_VIEWER` as the replacement in the same table that documents opening an artifact.
- A viewer that fails immediately leaves no trace, because its pane closes with it → the status bar still reports adapter-level failures, and a user diagnosing a viewer that starts but misbehaves can set `SPECTRA_VIEWER` to a shell command that pauses, since the value is used as a command line.
- The exit builtin assumes the pane runs a POSIX-style shell → Herdr launches the user's login shell for a split, and the exit builtin is common to the shells Herdr supports on the two platforms this plugin declares.

## Migration Plan

No data or on-disk state changes. A user who wants the previous behaviour sets `SPECTRA_VIEWER` to the value they had in `EDITOR`. Rollback is reverting the change; nothing outside the process environment is touched.

## Open Questions

None. The pane-closing mechanism was verified against a live Herdr 0.9.0 session before this design was written.
