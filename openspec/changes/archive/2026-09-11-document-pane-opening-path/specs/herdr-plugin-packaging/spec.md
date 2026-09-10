## ADDED Requirements

### Requirement: README documents how the open action is invoked

Herdr 0.9.0 plugin manifests cannot declare a keybinding, and Herdr offers no palette that lists plugin actions, so the `open` action has no way to be triggered until the user provides one. README.md SHALL therefore document the invocation path, and SHALL state that the absence of a default shortcut follows from the manifest format rather than from a failed install.

README.md SHALL name the command-line invocation that runs the action from a Herdr pane:

```sh
herdr plugin action invoke spectra-viewer.open
```

README.md SHALL also carry a copyable keybinding block for the user's own Herdr configuration file, using the `plugin_action` command type and the qualified action id, together with the reload step that makes an edited configuration take effect:

```toml
[[keys.command]]
key = "prefix+shift+s"
type = "plugin_action"
command = "spectra-viewer.open"
description = "Open Spectra changes"
```

The documented key SHALL be presented as an example the reader replaces, not as a shortcut the plugin installs. Any sentence in README.md that tells the reader to open the pane through the action SHALL point at this documentation rather than leaving the action untriggerable.

#### Scenario: A reader who just installed the plugin finds a way to open the pane

- **GIVEN** a reader who has run the install steps in README.md and has added nothing to their own Herdr configuration
- **WHEN** the reader looks for how to open the Spectra changes pane
- **THEN** README.md names the command `herdr plugin action invoke spectra-viewer.open` as a path that works with no configuration change

#### Scenario: A reader who wants a shortcut is given the whole binding

- **WHEN** the reader follows README.md to bind a key to the action
- **THEN** README.md shows a `[[keys.command]]` block whose `type` is `plugin_action` and whose `command` is the qualified action id `spectra-viewer.open`, names the Herdr configuration file the block belongs in, and names the command that reloads that file into a running server

#### Scenario: A reader is told why no shortcut shipped

- **WHEN** the reader reads the section that documents opening the pane
- **THEN** README.md states that a Herdr 0.9.0 plugin manifest cannot declare a keybinding, so the shortcut is chosen and bound by the user
