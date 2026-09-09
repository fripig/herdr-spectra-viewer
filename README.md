# herdr-spectra-viewer

A [Herdr](https://herdr.dev) plugin that shows the Spectra changes of the current project in a
terminal pane: active, parked, and archived changes with their task progress and artifacts, plus
one-key sending of `/spectra-*` commands to the pane that opened it.

## Install

Requires Node.js 20 or newer and Herdr 0.9.0 or newer.

```sh
git clone <this repository> ~/.herdr/plugins/spectra-viewer
herdr plugin link ~/.herdr/plugins/spectra-viewer
```

Herdr runs `npm ci` and `npm run build` from the manifest's build steps. Open the pane with the
`spectra-viewer: open` action, or run `node dist/pane.js` inside a Herdr pane.

## Keys and mouse

| Input                | Effect                                                    |
| -------------------- | --------------------------------------------------------- |
| `↑` `↓` / `j` `k`    | Move the cursor                                           |
| `←` `→` / `h` `l`    | Collapse / expand the node under the cursor               |
| Enter or `e`         | Open the artifact under the cursor in a viewer split       |
| `d` `a` `i` `r` `c`  | Send `/spectra-discuss`, `apply`, `ingest`, `archive`, `commit` with the selected change to the invoking pane |
| `R`                  | Rescan                                                    |
| `q` / Escape         | Quit                                                      |
| Click a row          | Move the cursor there; on an artifact, open it in the viewer |
| Click the `▸`/`▾` marker | Expand or collapse that node                          |
| Mouse wheel          | Move the cursor up or down                                |

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

`EDITOR` is **not** consulted. If you relied on it before, set `SPECTRA_VIEWER` to the same value.
