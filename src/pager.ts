import { spawn } from "node:child_process";
import type { HerdrClient, ViewerResult } from "./herdr/client.js";
import { MOUSE_DISABLE, MOUSE_ENABLE } from "./tui/mouse.js";

/**
 * The options the viewer is always started with. `inherit` is what lets the viewer drive the real
 * terminal — it reads the keys the user presses and draws where the frame used to be — and it is the
 * reason the terminal has to be handed over first. `shell: false` keeps the argument vector intact:
 * an artifact path holding a space or a quote is one argument, not a string a shell re-splits.
 */
export const VIEWER_SPAWN_OPTIONS = { stdio: "inherit", shell: false } as const;

/** The part of a child process this module waits on. */
export interface ViewerProcess {
  on(event: "error", listener: (error: Error) => void): unknown;
  on(event: "exit", listener: (code: number | null) => void): unknown;
}

export type SpawnViewer = (
  command: string,
  args: string[],
  options: typeof VIEWER_SPAWN_OPTIONS,
) => ViewerProcess;

/**
 * Gives the terminal to the viewer and takes it back. Both halves are injected because the actions
 * they perform — clearing Ink's frame, switching raw mode off and on — are only reachable from the
 * render layer, while the order they happen in is what this module is responsible for.
 */
export interface TerminalHandover {
  suspend: () => void;
  resume: () => void;
}

/**
 * The three things handing the terminal over needs, each reachable from only one place. They arrive
 * one at a time — the component's on mount, the render instance's once `render` has returned — so
 * every slot starts null and every use is guarded. A handover that happens before the frame exists
 * has nothing to give away, which is why a missing slot is skipped rather than treated as an error.
 */
export interface TerminalControls {
  /**
   * Ink's own raw-mode switch, the only way to stop the pane reading input: switching it off makes
   * Ink drop its stdin listener, switching it back on restores it. Only reachable inside a component.
   */
  setRawMode: ((enabled: boolean) => void) | null;
  /** Erases the frame Ink currently has on screen. The render instance's own `clear`. */
  clear: (() => void) | null;
  /**
   * Puts the frame back. Ink remembers its last output and skips writing an unchanged frame, so a
   * rerender cannot force a repaint; writing an empty string through Ink's stdout can, because that
   * path clears the screen and then re-writes the frame Ink remembers.
   */
  redraw: (() => void) | null;
}

export function createTerminalControls(): TerminalControls {
  return { setRawMode: null, clear: null, redraw: null };
}

/**
 * The handover pair, in the order the terminal has to change hands. Giving it away goes outside-in —
 * mouse reporting off, frame erased, input reading stopped — and taking it back reverses that, so
 * the pane never has half a terminal: it is not reading keys while the viewer draws, and not drawing
 * before it can read keys again.
 */
export function terminalHandover(controls: TerminalControls, write: (sequence: string) => void): TerminalHandover {
  return {
    suspend: () => {
      write(MOUSE_DISABLE);
      controls.clear?.();
      controls.setRawMode?.(false);
    },
    resume: () => {
      controls.setRawMode?.(true);
      write(MOUSE_ENABLE);
      controls.redraw?.();
    },
  };
}

/** The production spawn: a real child process holding this process's own terminal. */
export const spawnViewerProcess: SpawnViewer = (command, args, options) => spawn(command, args, options);

/**
 * The argument vector the viewer runs as. The resolved viewer may carry flags of its own — a
 * `SPECTRA_VIEWER` of `less -R` is a reasonable thing to set — so it is split on whitespace, and the
 * artifact path is appended as a single element whatever it contains.
 */
export function viewerArgv(viewer: string, filePath: string): string[] {
  return [...viewer.trim().split(/\s+/).filter(Boolean), filePath];
}

/**
 * Waits for the viewer to end. A viewer that could not be started reports `error` and never reports
 * an exit status, so that case resolves with null rather than leaving the pane waiting forever. Both
 * events are guarded against arriving twice, because a process can report an error after it has
 * already exited and the terminal must only be taken back once.
 */
function endOfProcess(child: ViewerProcess): Promise<number | null> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (code: number | null) => {
      if (settled) return;
      settled = true;
      resolve(code);
    };
    child.on("error", () => settle(null));
    child.on("exit", (code) => settle(code));
  });
}

/**
 * Shows an artifact in the terminal the pane already occupies, for the runs where there is no Herdr
 * to open a pane beside it. The signature matches the Herdr adapter's, so the assembly point can
 * choose between them without the component knowing which one it got; the client argument is unused
 * here because nothing on this path talks to Herdr at all.
 *
 * The terminal is handed over before the viewer starts and taken back in a `finally`, so a viewer
 * that fails to start leaves the pane usable rather than blind. An opening reports no pane, because
 * none was created.
 */
export function openInPager(deps: { spawnViewer: SpawnViewer; terminal: TerminalHandover }) {
  return async function openInPagerAdapter(
    _client: HerdrClient,
    opts: { projectRoot: string; paneId: string | null; viewer: string; filePath: string; previousViewerPane: string | null },
  ): Promise<ViewerResult> {
    const [command, ...args] = viewerArgv(opts.viewer, opts.filePath);
    deps.terminal.suspend();
    let code: number | null;
    try {
      code = await endOfProcess(deps.spawnViewer(command, args, VIEWER_SPAWN_OPTIONS));
    } catch {
      // A spawn that throws where it would normally report `error` is the same failure.
      code = null;
    } finally {
      deps.terminal.resume();
    }
    if (code === 0) return { ok: true, paneId: null };
    return { ok: false, reason: code === null ? `could not start ${command}` : `${command} exited ${code}` };
  };
}
