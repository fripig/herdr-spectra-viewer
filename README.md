# herdr-spectra-viewer

A [Herdr](https://herdr.dev) plugin that shows the Spectra changes of the current project in a
terminal pane: active, parked, and archived changes with their task progress and artifacts, plus
one-key sending of `/spectra-*` commands to the pane that opened it.

## Install

Requires Node.js 20 or newer and Herdr 0.9.0 or newer.

```sh
herdr plugin install fripig/herdr-spectra-viewer
```

Herdr clones the repository and runs `npm ci` and `npm run build` from the manifest's build steps.
Open the pane with the `spectra-viewer: open` action, or run `node dist/pane.js` inside a Herdr
pane.

To work on the plugin itself, link a clone instead of installing it:

```sh
git clone https://github.com/fripig/herdr-spectra-viewer
herdr plugin link herdr-spectra-viewer
```

The action opens the pane as a split to the right of the pane you were working in, so the tree sits
beside your work rather than over it. The placement is asked for by the action itself, not by the
manifest — the manifest's `placement` only applies to an invocation that names none, such as a bare
`herdr plugin pane open`.

## Keys and mouse

| Input                | Effect                                                    |
| -------------------- | --------------------------------------------------------- |
| `↑` `↓` / `j` `k`    | Move the cursor                                           |
| `←` `→` / `h` `l`    | Collapse / expand the node under the cursor               |
| Enter or `e`         | Open the artifact under the cursor in a viewer split       |
| `d` `a` `i` `r` `c`  | Send `/spectra-discuss`, `apply`, `ingest`, `archive`, `commit` with the selected change to the pane that opened this one |
| `R`                  | Rescan                                                    |
| `q` / Escape         | Quit                                                      |
| Click a row          | Move the cursor there; on an artifact, open it in the viewer |
| Click the `▸`/`▾` marker | Expand or collapse that node                          |
| Mouse wheel          | Move the cursor up or down                                |

A command goes to the pane that invoked the plugin — the one that was focused when the pane
opened — not to the pane the plugin itself runs in. The command is typed in, never submitted, so you
can edit it first.

The tree stays open after a command is sent, and keyboard focus moves back to the pane on the left,
so Enter submits what was just typed there while this pane keeps its place. The status bar shows
`Sent: <command>`, or `Sent, but could not focus pane` when Herdr would not move the focus — the
command is waiting in the other pane either way, you just have to switch to it yourself. `q` and
Escape remain the only ways to close the pane.

When no invoking pane is known, or when Herdr refuses the write, the command goes to the system
clipboard instead and no focus is moved: the status bar shows `Copied: <command>` for the first
case and `Herdr send failed, copied instead` for the second, or `Copy failed: <command>` when the
clipboard write fails too.

The pane turns on terminal mouse reporting while it runs. Selecting text inside the pane with the
mouse therefore needs **Shift** held while dragging (the terminal's usual override); reporting is
switched off again when the pane exits. If a crash ever leaves the shell printing `[<` noise when
the mouse moves, run `printf '\e[?1000l'` to switch it off by hand.

## Viewing an artifact

Opening an artifact splits a pane to the right and shows the file there. The command is taken from
`SPECTRA_VIEWER`, and defaults to `less` when that variable is unset or blank. The value is used as
a command line, so flags work:

```sh
export SPECTRA_VIEWER='bat --style=plain'
```

The split pane closes itself as soon as the viewer ends — leaving `less` with `q` makes the pane
disappear, with nothing to close by hand. That also means a viewer that fails on startup takes its
own error message with it; if a viewer misbehaves, point `SPECTRA_VIEWER` at a command that pauses
so the output stays on screen.

Closing the changes pane takes the viewer pane with it: quitting with `q`, or letting the pane close
itself after it hands a command over, closes the viewer that is still open. When Herdr closes the
pane from the outside the plugin has only a moment to react, so that case is best-effort — a viewer
pane left behind there can be closed by quitting its viewer as usual.

Only one viewer pane is ever on screen. Opening a second artifact without quitting the first viewer
replaces that pane instead of stacking a new one beside it, so browsing a handful of artifacts in a
row leaves nothing to tidy up.

`EDITOR` is **not** consulted. If you relied on it before, set `SPECTRA_VIEWER` to the same value.
