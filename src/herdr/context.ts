export interface InvocationContext {
  projectRoot: string;
  /** True when projectRoot came from HERDR_PLUGIN_CONTEXT_JSON rather than a fallback. */
  projectRootFromContext: boolean;
  paneId: string | null;
  herdrBin: string | null;
}

function nonEmpty(v: string | undefined): string | null {
  return v && v.length > 0 ? v : null;
}

function cwdFromContextJson(raw: string | undefined, warn: (line: string) => void): string | null {
  if (raw === undefined) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    warn("HERDR_PLUGIN_CONTEXT_JSON is not valid JSON; using the working directory");
    return null;
  }
  const ws = (parsed as { workspace?: { cwd?: unknown } } | null)?.workspace;
  const cwd = ws?.cwd;
  return typeof cwd === "string" && cwd.length > 0 ? cwd : null;
}

export function readInvocationContext(
  env: NodeJS.ProcessEnv,
  cwd: string,
  warn: (line: string) => void = (l) => process.stderr.write(l + "\n"),
): InvocationContext {
  const fromJson = cwdFromContextJson(env.HERDR_PLUGIN_CONTEXT_JSON, warn);
  return {
    projectRoot: fromJson ?? cwd,
    projectRootFromContext: fromJson !== null,
    paneId: nonEmpty(env.HERDR_PANE_ID),
    herdrBin: nonEmpty(env.HERDR_BIN_PATH),
  };
}
