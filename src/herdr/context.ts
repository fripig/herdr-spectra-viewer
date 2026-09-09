export interface InvocationContext {
  projectRoot: string;
  /** True when projectRoot came from HERDR_PLUGIN_CONTEXT_JSON rather than a fallback. */
  projectRootFromContext: boolean;
  /** The pane the plugin itself runs in: what a split or a cwd lookup targets. */
  paneId: string | null;
  /**
   * The pane a Spectra command is written into. When Herdr opens the plugin in
   * a pane of its own, that pane is not the one the user was working in, so the
   * command belongs to the focused pane the invocation reports instead.
   */
  commandPaneId: string | null;
  herdrBin: string | null;
}

/** Only the fields this plugin reads; Herdr sends many more. */
interface PluginContext {
  workspace_cwd?: unknown;
  workspace?: { cwd?: unknown };
  focused_pane_id?: unknown;
}

function nonEmpty(v: string | undefined): string | null {
  return v && v.length > 0 ? v : null;
}

function parseContextJson(raw: string | undefined, warn: (line: string) => void): PluginContext | null {
  if (raw === undefined) return null;
  try {
    return JSON.parse(raw) as PluginContext;
  } catch {
    warn("HERDR_PLUGIN_CONTEXT_JSON is not valid JSON; using the working directory");
    return null;
  }
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Herdr 0.9.0 emits flat keys; the nested shape is kept as a fallback so an
 * invocation that still sends it resolves the same root.
 */
function cwdFrom(ctx: PluginContext | null): string | null {
  return str(ctx?.workspace_cwd) ?? str(ctx?.workspace?.cwd);
}

export function readInvocationContext(
  env: NodeJS.ProcessEnv,
  cwd: string,
  warn: (line: string) => void = (l) => process.stderr.write(l + "\n"),
): InvocationContext {
  const ctx = parseContextJson(env.HERDR_PLUGIN_CONTEXT_JSON, warn);
  const fromJson = cwdFrom(ctx);
  const paneId = nonEmpty(env.HERDR_PANE_ID);
  return {
    projectRoot: fromJson ?? cwd,
    projectRootFromContext: fromJson !== null,
    paneId,
    commandPaneId: str(ctx?.focused_pane_id) ?? paneId,
    herdrBin: nonEmpty(env.HERDR_BIN_PATH),
  };
}
