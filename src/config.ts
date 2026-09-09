import { readFileSync } from "node:fs";
import path from "node:path";

/** The one file this plugin reads out of the directory Herdr hands it. */
export const CONFIG_FILE_NAME = "config.json";

/** Reads a file as text, or throws — the shape of `readFileSync` this module needs. */
export type ReadTextFile = (filePath: string) => string;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The viewer command the plugin's own configuration file asks for, or null when
 * the file has nothing usable to say. An absent directory, an absent file and an
 * absent `viewer` field are the states a fresh install is in, so they pass over
 * silently; a file that exists but cannot be used is a typo worth one line.
 *
 * Read is synchronous and happens once, before the first frame: the value is
 * needed to build the app, and there is no frame yet to keep responsive.
 */
export function readConfiguredViewer(
  env: NodeJS.ProcessEnv,
  read: ReadTextFile = (p) => readFileSync(p, "utf8"),
  warn: (line: string) => void = (l) => process.stderr.write(l + "\n"),
): string | null {
  const dir = env.HERDR_PLUGIN_CONFIG_DIR;
  if (!dir) return null;
  const file = path.join(dir, CONFIG_FILE_NAME);

  let raw: string;
  try {
    raw = read(file);
  } catch {
    // No file yet is the default state, not a mistake.
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    warn(`${file} is not valid JSON; ignoring it`);
    return null;
  }
  if (!isPlainObject(parsed)) {
    warn(`${file} does not hold a JSON object; ignoring it`);
    return null;
  }

  const viewer = parsed.viewer;
  if (viewer === undefined) return null;
  if (typeof viewer !== "string") {
    warn(`${file}: "viewer" is not a string; ignoring it`);
    return null;
  }
  const trimmed = viewer.trim();
  if (!trimmed) {
    warn(`${file}: "viewer" is empty; ignoring it`);
    return null;
  }
  return trimmed;
}
