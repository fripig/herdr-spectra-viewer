import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";

/** The one file in a project root that says where its specs live. */
export const SPECTRA_CONFIG_FILE = ".spectra.yaml";

/** Where specs live when the configuration does not say — the layout Spectra used before `docs/spectra`. */
export const DEFAULT_SPEC_DIR = "openspec";

export interface SpecDirResolution {
  /** Absolute path of the directory holding `changes/` and `specs/`. */
  directory: string;
  /** One line about an unusable configuration, or null when there is nothing to say. */
  warning: string | null;
}

/**
 * The spec directory of a project, decided by its configuration alone.
 *
 * Spectra writes `spec_dir` into `.spectra.yaml` when it initialises a project, and resolves a
 * configuration without that field to `openspec`. This function reproduces that rule and nothing
 * else: it deliberately does not look at which directories exist on disk. A viewer that guessed
 * the layout could list changes for a project the CLI considers uninitialised, and that
 * disagreement has no error message — only counts that fail to match.
 */
export async function resolveSpecDir(projectRoot: string): Promise<SpecDirResolution> {
  const root = path.resolve(projectRoot);
  const configFile = path.join(root, SPECTRA_CONFIG_FILE);
  const legacy = path.join(root, DEFAULT_SPEC_DIR);
  const fallback: SpecDirResolution = { directory: legacy, warning: null };
  // A file that exists but cannot be used is a mistake worth one line; an absent field is not.
  const refuse = (reason: string): SpecDirResolution => ({
    directory: legacy,
    warning: `${configFile}: ${reason}; using ${DEFAULT_SPEC_DIR} instead`,
  });

  let text: string;
  try {
    text = await readFile(configFile, "utf8");
  } catch {
    // No configuration file is the normal state of an older Spectra or OpenSpec project.
    return fallback;
  }

  let doc: unknown;
  try {
    doc = parseYaml(text);
  } catch {
    return refuse("not valid YAML");
  }
  // A document that is not a mapping carries no fields at all, so it says nothing about the layout.
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return fallback;

  const value = (doc as Record<string, unknown>).spec_dir;
  if (value === undefined) return fallback;
  if (typeof value !== "string") return refuse(`"spec_dir" is not a string`);

  const trimmed = value.trim();
  if (!trimmed) return refuse(`"spec_dir" is empty`);

  const resolved = path.resolve(root, trimmed);
  // An absolute path and a `../` escape arrive here the same way: outside the project.
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    return refuse(`"spec_dir" resolves outside the project root`);
  }

  return { directory: resolved, warning: null };
}

/**
 * Whether the project has the spec directory its configuration names.
 *
 * This is the whole of "is this project initialised for Spectra": the resolution decides where to
 * look, and only then does existence matter. A warning raised while resolving is not reported here
 * — a scan carries it, and one unusable configuration must not be announced twice.
 */
export async function specDirExists(projectRoot: string): Promise<boolean> {
  try {
    const { directory } = await resolveSpecDir(projectRoot);
    return (await stat(directory)).isDirectory();
  } catch {
    return false;
  }
}
