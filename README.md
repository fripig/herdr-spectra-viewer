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
The pane is opened by the plugin's `open` action, which arrives bound to no key —
[Opening the pane](#opening-the-pane) is how you call it and how you give it one. Running
`node dist/pane.js` inside a Herdr pane works too.

To work on the plugin itself, link a clone instead of installing it:

```sh
git clone https://github.com/fripig/herdr-spectra-viewer
herdr plugin link herdr-spectra-viewer
```

The action opens the pane as a split to the right of the pane you were working in, so the tree sits
beside your work rather than over it. The placement is asked for by the action itself, not by the
manifest — the manifest's `placement` only applies to an invocation that names none, such as a bare
`herdr plugin pane open`.

## Running it without Herdr

The viewer also runs on its own, in any terminal, with nothing installed:

```sh
npx spectra-viewer
```

The project it shows is the directory you run it from — there is no Herdr to ask, so the current
working directory is the project root. Installed rather than run through `npx`, the same program is
available as `spectra-viewer` and as the short name `sv`.

Two things work differently without Herdr, because both need a second pane that nobody can open:

- Sending a `/spectra-*` command has nowhere to send it, so the command is copied to the clipboard
  instead and the status bar says so. Paste it into whichever agent you are running.
- Opening an artifact with `e` hands this terminal to the viewer instead of splitting a pane. The
  frame disappears while the viewer has the terminal and is drawn again when you leave it, so
  quitting `less` with `q` puts you back on the tree where you left off. The viewer command is
  resolved exactly as it is under Herdr — see [Viewing an artifact](#viewing-an-artifact).

### Options

```sh
spectra-viewer --viewer 'mdcat -p'   # show artifacts with this command, for this run
spectra-viewer --help                # print the options and exit
spectra-viewer --version             # print the version and exit
```

`--help` and `--version` print and exit without drawing anything, so both work where there is no
terminal to draw on — down a pipe, or in a script reading the version back. `--help` wins whenever
more than one of the three is given, so `--help --version` prints the usage text, and so does a
`--help` alongside an option this program does not know. `--viewer` is the highest-priority viewer
source; its value may also be written as `--viewer=<command>`, and giving the option twice keeps the
last one.

There are no positional arguments — the project shown is always the directory you run the program
from — and there are no short aliases, because `-v` is the usual short name for both a version and a
verbose flag and binding it to either would spend the name the other may want. Anything else on the
command line is refused: a misspelled option, a stray path, or the `--style=plain` left over from an
unquoted viewer command each produce two lines on stderr — one naming the argument, one pointing at
`--help` — and exit status 2, with no pane started.

A `--viewer` that reaches no value is the one thing that is reported without being refused: no value
after it, an empty value, or a value of only whitespace each print one line to stderr, and the pane
starts with the next viewer source down.

## Opening the pane

Run the action from any Herdr pane:

```sh
herdr plugin action invoke spectra-viewer.open
```

That is the path that needs nothing configured: the plugin is installed, so the action is there to be
called by its qualified id — the plugin id and the action id joined.

Nothing here ships bound to a key, and nothing is missing when you find none: a Herdr 0.9.0 plugin
manifest has no field for a keybinding, so no plugin can carry one. The shortcut is yours to pick.
Put the binding in your own Herdr configuration file, `~/.config/herdr/config.toml`:

```toml
[[keys.command]]
key = "prefix+shift+s"
type = "plugin_action"
command = "spectra-viewer.open"
description = "Open Spectra changes"
```

The key is an example, not a reservation — bind whatever Herdr accepts and whatever is free on your
keyboard. `type` and `command` are the two lines that have to stay as written: `plugin_action` is the
command type that reaches a plugin at all, and `spectra-viewer.open` is the same qualified id the
command line takes. A server that is already running picks the edited file up on:

```sh
herdr server reload-config
```

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
| Right-click a row    | Move the cursor there and open a menu of the five commands above |
| Mouse wheel          | Move the cursor up or down                                |

The right-click menu is the same five commands with their keys spelled out, drawn over the tree at the
point you clicked. Move through it with `↑` `↓` or `j` `k` and choose with Enter, or click an item
outright; Escape or a click anywhere outside closes it without sending. Right-clicking a group row
opens nothing and says `Select a change first`. Choosing an item does exactly what its key does, so
everything below about where the command goes applies to both.

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

Opening an artifact splits a pane to the right and shows the file there, or hands the current
terminal to the viewer when there is no Herdr to split with. The command comes from the first of
four sources that names one: the `--viewer` option, which settles a single run; the `SPECTRA_VIEWER`
environment variable, which settles a shell; the `viewer` field of this plugin's own configuration
file, which is the standing preference; and `less`. Any of the first three is used as a command line,
so flags work:

```sh
spectra-viewer --viewer 'bat --style=plain'
export SPECTRA_VIEWER='bat --style=plain'
```

A viewer command that carries flags of its own has to reach the program as a single argument, so
quote it. Written without the quotes, `--viewer bat --style=plain` gives the option `bat` alone and
leaves `--style=plain` as an argument nothing recognises — which is refused with a message, rather
than quietly running a viewer you did not ask for.

The split pane closes itself as soon as the viewer ends — leaving `less` with `q` makes the pane
disappear, with nothing to close by hand. That also means a viewer that fails on startup takes its
own error message with it; if a viewer misbehaves, point the viewer setting at a command that pauses
so the output stays on screen.

### Setting the viewer for good

Which lever makes a viewer stick depends on how the pane is started.

Run on its own, an `export` in a shell profile is enough, because the program is started by your own
interactive shell and inherits what that shell exports:

```sh
export SPECTRA_VIEWER='bat --style=plain'
```

`--viewer` is then how a single run gets a different reader without touching the profile.

Under Herdr the pane is spawned by the Herdr server rather than by an interactive shell, so an
`export` in a shell profile does not reliably reach it. The setting that sticks lives in the
configuration directory Herdr keeps for this plugin — run `herdr plugin config-dir spectra-viewer`
to print it, normally `~/.config/herdr/plugins/config/spectra-viewer`. Create `config.json` there:

```json
{ "viewer": "frogmouth" }
```

The value has the same shape as the other two: a command line, flags included. The file is read
once when the changes pane starts, so a pane that is already open keeps the viewer it started with.
`SPECTRA_VIEWER` still wins over the file when it is set, and `--viewer` wins over both.

Nothing here has to exist. No directory, no file, and no `viewer` field all mean the same thing as
before — `less`. A file that is there but cannot be used (not valid JSON, or a `viewer` that is not a
non-empty string) prints one line to stderr and falls back the same way; it never stops the pane from
opening.

Naming a command that is not installed is the one mistake that is quiet: the viewer pane opens, the
shell reports the missing command, and the pane closes on top of the message before it can be read,
so opening an artifact looks like it does nothing at all. Run the command once in a terminal against
any markdown file before putting it in `config.json`.

### Choosing a markdown reader

The pane runs the viewer as `<viewer command> <path>; exit` in a shell, so a command qualifies when
it takes the file as its last argument and stays on screen until the reader quits. A renderer that
prints and returns makes the pane vanish before anything can be read; most of them have a paging
flag for exactly this. The path is appended rather than substituted, so a pipeline needs a wrapper
script on `PATH` rather than a viewer setting of its own.

Readers that fit the contract above, each one opened on a spec through this plugin in a 74-column
split. The plugin depends on none of them, and installs none of them:

| Command | Leave it with | What you get |
| --- | --- | --- |
| `less` | `q` | The default. Raw markdown, nothing to install. |
| `bat --style=plain` | `q` | Raw markdown with syntax highlighting. |
| `mdcat -p` | `q` | Rendered markdown, wrapped to the width the pane actually has. |
| `glow -p` | `q` | Rendered markdown from one static binary, but see the width note below. |
| `mdless` | `q` | Renders headings; leaves `**` markers, and does not reflow paragraphs. |
| `frogmouth` | **`Ctrl+Q`** | A markdown browser with navigation of its own, in the pane. |

The pane closes when the reader exits, so the reader's own quit key is the key that closes the split.
That is `q` for everything above except `frogmouth`, which is a Textual application: `q` and `Escape`
both leave it running, and only `Ctrl+Q` ends it. Not knowing the key costs less than it sounds,
because the plugin closes the pane itself either way — opening the next artifact replaces it, and
leaving the changes pane takes it along — so the only thing a wrong key costs is a split that stays
on screen until one of those happens.

A renderer also picks its own wrapping width, which need not be the width of the split. `mdcat` and
`frogmouth` take the pane's width; glow 3.0.0 wraps at 80 whatever the pane is, so in a narrower
split the terminal breaks the surplus onto a line of its own. Overflow costs legibility and nothing
else — the pane still holds, and still closes itself on the way out — and the reader's own width flag
adjusts it: `glow -p -w 74`, or `glow -p -w $(tput cols)`, since the viewer runs through a shell.

Rendering earns its keep on these files: `less` hard-wraps a long `SHALL` paragraph mid-word, so
`disable` arrives as `disab` / `le`, while a renderer breaks it on spaces and indents it under its
heading. The delta headings and the `**WHEN**` / `**THEN**` scenario lines stay legible either way.

Closing the changes pane takes the viewer pane with it: quitting with `q`, or letting the pane close
itself after it hands a command over, closes the viewer that is still open. When Herdr closes the
pane from the outside the plugin has only a moment to react, so that case is best-effort — a viewer
pane left behind there can be closed by quitting its viewer as usual.

Only one viewer pane is ever on screen. Opening a second artifact without quitting the first viewer
replaces that pane instead of stacking a new one beside it, so browsing a handful of artifacts in a
row leaves nothing to tidy up.

`EDITOR` is **not** consulted, and neither is `PAGER`. Both are shared with git and every other tool,
so a reader chosen here would leak into them. If you relied on `EDITOR` before, pass it to
`--viewer`, or set `SPECTRA_VIEWER`, or the configuration file's `viewer`, to the same value.
