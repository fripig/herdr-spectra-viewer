## Context

The plugin opens an artifact by splitting a pane and running the viewer in it. The command ends with the shell exit builtin, so the pane disappears when the viewer does. That covers the common path — read an artifact, quit the viewer, the pane is gone — but not the path where the user leaves the viewer running and returns to the tree. Each subsequent open splits another pane, and they stack up.

Two Herdr behaviours were measured before this design was written, and both shape the decisions below.

First, a pane that is busy running a viewer cannot be reused. Issuing a second run call against a pane where `less` is already in the foreground does not start a second viewer: the command text is delivered to `less` as keyboard input and appears on its screen. Reusing one long-lived pane would therefore require ending the running viewer first, and the key that ends a viewer differs per viewer, so no general mechanism exists.

Second, closing a pane that no longer exists is harmless but silent. The Herdr close call for a stale pane id exits zero and reports a `pane_not_found` error in its JSON output. Exit status alone cannot distinguish "closed it" from "it was already gone", and neither outcome needs different handling.

## Goals / Non-Goals

**Goals:**

- Keep at most one viewer pane alive, no matter how many artifacts are opened without quitting the viewer.
- Preserve the existing behaviour where a viewer that ends takes its own pane with it.
- Keep the failure surface unchanged: an open that cannot split still reports through the status bar and changes nothing else.

**Non-Goals:**

- Reusing a single long-lived viewer pane by swapping its content. The measurement above rules it out for viewers in general.
- Tracking whether the remembered pane is still alive before closing it. The close call already tolerates a stale id, so a liveness probe would add a round trip and buy nothing.
- Closing the viewer pane when the plugin pane itself exits. A viewer the user is still reading is theirs to close, and the plugin does not own it after it stops running.
- Restoring a remembered pane id across plugin restarts. The id lives as long as the pane component does.

## Decisions

### Close the previous viewer pane before splitting a new one

An open first issues a close for the remembered viewer pane, when one is remembered, and then splits and runs as it does today. The order matters: closing first means the new split lands in the layout the user had before the previous viewer appeared, so viewer panes do not drift across the tab as they are replaced.

Alternative considered: split first, then close the old pane. Rejected because the tab would briefly hold two viewer panes and the new pane's size would be computed against a layout that is about to change.

### Return the new pane id from the adapter

The adapter's open function reports the pane id it created alongside its success result, so the caller has something to remember. Its failure result is unchanged.

Alternative considered: have the pane component issue its own split call and keep the adapter write-only. Rejected because pane creation would then straddle two modules, and the adapter already parses the pane id out of the split output for its own run call.

### Remember the viewer pane in the pane component

The pane component holds the most recently created viewer pane id and passes it to the next open. A successful open replaces it. An open that fails before a pane exists clears it, because the previous pane was already closed by then and remembering a closed pane would send a pointless close call on the next open.

Alternative considered: keeping the id inside the adapter as module state. Rejected because the adapter is otherwise stateless and shared with the send-text path, and module state would leak between tests.

### Ignore the outcome of the close call

The close result is not inspected and never reaches the status bar. A stale id, a pane the user closed by hand, and a genuine close all look the same to the plugin, and all three leave it free to split a new pane.

Alternative considered: surfacing a failed close in the status bar. Rejected because the measured behaviour gives no reliable failure signal, and a message about a pane the user already closed would be noise.

## Implementation Contract

**Behavior.** Opening an artifact while a viewer pane from a previous open is still on screen replaces that pane rather than adding to it: the old one disappears and the new one takes its place. Opening an artifact with no viewer pane on screen behaves exactly as it does today. Quitting the viewer still closes its pane on its own, and the next open after that simply finds nothing to close.

**Interface.** The adapter's open function takes the previously created viewer pane id, or null when there is none, in addition to its current arguments. On success it returns the id of the pane it created; on failure it returns the existing failure shape carrying a reason. When a previous id is supplied, the adapter issues a Herdr close for that pane before its split call, so the call order for a replacing open is close, split, run.

**Failure modes.** The close call's result is discarded, including the `pane_not_found` error a stale id produces, and it never blocks or alters the split that follows. A split that fails, or split output with no pane id in it, leaves the status bar message unchanged from today and leaves no viewer pane remembered, since the previous one was already closed. A run call that fails reports as it does today, and the pane it targeted is still remembered, because that pane exists.

**Acceptance criteria.**

- The adapter unit suite asserts the full call sequence for a replacing open (close, split, run, in that order, with the remembered pane id in the close call) and for a first open (split, run, with no close call).
- The adapter unit suite asserts the returned pane id on success, and that a stale previous id — one whose close reports not found — still results in a successful open.
- The App suite asserts that two opens in a row issue exactly one close call naming the pane created by the first open, and that the first open issues none.
- The App suite asserts that an open which fails to split leaves no pane remembered, by checking the next open issues no close call.
- Manual check in a live Herdr session: open one artifact, leave the viewer running, open a second artifact, and confirm the tab holds one viewer pane and that a pane lookup for the first pane id reports it is not found.

**Scope boundaries.** In scope: the adapter's open path and its return shape, the remembered pane id in the pane component, the affected spec requirements, and the README description of what opening an artifact does to panes. Out of scope: the viewer command and its resolution, the trailing exit in the run command, the status bar messages, the keys and mouse gestures that trigger an open, and the send-text path.

## Risks / Trade-offs

- A user reading one artifact and opening another loses the first view without being asked → this is the requested behaviour, and the artifact is one keypress away from being reopened.
- The remembered id can name a pane the user has since reused for something else, which the next open would close → the window is small and the id is only ever one Herdr split old, but it is a real trade-off of remembering an id rather than probing liveness.
- Pane close is a new Herdr call the plugin depends on → it is part of the same pane command family already in use for split, run, and get, and its stale-id behaviour was measured rather than assumed.

## Migration Plan

No data or on-disk state changes, and no configuration. A user who prefers several viewer panes at once no longer has that option; the change is reverted by reverting the commit.

## Open Questions

None. Both Herdr behaviours this design depends on were measured against a live Herdr 0.9.0 session.
