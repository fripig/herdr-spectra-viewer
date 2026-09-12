import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ReadTextFile } from "./config.js";

/**
 * The line that follows every usage error, so a refused invocation always says where to look next.
 * It is a constant rather than part of the error message because the two lines have different
 * subjects — one names what went wrong, one names the cure — and the caller writes both.
 */
export const HELP_HINT = "Run spectra-viewer --help to see the accepted options.";

/**
 * The option that names the viewer, in the two forms it is accepted in. Only the long form exists:
 * `-v` is the usual short name for both a version and a verbose flag, so binding it to either here
 * would spend a name this program may want for the other, and three options are not enough to type
 * for the saving to matter.
 */
export const VIEWER_OPTION = "--viewer";
const VIEWER_OPTION_PREFIX = `${VIEWER_OPTION}=`;

export const HELP_OPTION = "--help";
export const VERSION_OPTION = "--version";

/**
 * What `--help` prints. It states the two things a reader cannot guess — that the project shown is
 * the directory the program is run from, and the order the four viewer sources are consulted in —
 * and it spells out the quoting rule, because a viewer command carrying options of its own is the
 * one invocation that looks right and is not.
 */
export const USAGE = `Usage: spectra-viewer [options]

Browse the Spectra changes of a project in the terminal. Takes no positional
arguments: the project shown is always the directory the program is run from.

Options:
  ${VIEWER_OPTION} <command>  Command that shows an artifact. Quote a command that
                      carries options of its own: ${VIEWER_OPTION} 'bat --style=plain'
  ${HELP_OPTION}              Print this text and exit
  ${VERSION_OPTION}           Print the version and exit

The viewer command is taken from the first of these that names one:
  1. ${VIEWER_OPTION}
  2. the SPECTRA_VIEWER environment variable
  3. the "viewer" field of config.json in $HERDR_PLUGIN_CONFIG_DIR
  4. less

EDITOR and PAGER are deliberately not consulted: they are shared with git and
every other tool, so a pager chosen here would leak into them.`;

/**
 * What the arguments asked for. Parsing decides which of the four this is and carries everything the
 * caller needs to act; it performs none of the acting itself, so every branch can be tested without
 * a terminal, a filesystem or a process to exit.
 *
 * `run` carries the viewer command the arguments named, or null when they named none — including
 * when they tried and failed, because a `--viewer` without a usable value is passed over rather than
 * treated as an error. Its warnings are lines the caller writes to standard error before starting.
 */
export type CliInvocation =
  | { kind: "run"; viewer: string | null; warnings: string[] }
  | { kind: "help" }
  | { kind: "version" }
  | { kind: "usage-error"; message: string };

/**
 * Reads the arguments that follow the program's own path and says what they asked for. Pure: no
 * environment, no filesystem, no output, no exit. The program takes no positional arguments — the
 * project it shows is the directory it is run from — so anything that is not a recognised option is
 * refused rather than ignored, which is what turns a typo into a message instead of a surprise.
 */
export function parseCliArgs(args: readonly string[]): CliInvocation {
  // Asking is answered before anything is refused, so a reader who reaches for help while getting an
  // option wrong is helped rather than corrected. Scanning the whole list first is also what makes
  // "anywhere among the arguments" true of a request that follows an option expecting a value.
  if (args.includes(HELP_OPTION)) return { kind: "help" };
  if (args.includes(VERSION_OPTION)) return { kind: "version" };

  const warnings: string[] = [];
  let viewer: string | null = null;

  /**
   * Both value forms end here, so the rules that make a value usable are written once. A value that
   * yields nothing is passed over rather than refused: the viewer is only needed when the user opens
   * an artifact, and the next source down can still answer, so there is nothing worth refusing to
   * start over. The last `--viewer` decides, including when it is the one that yields nothing.
   */
  const takeViewer = (raw: string | undefined): void => {
    if (raw === undefined) {
      warnings.push(`${VIEWER_OPTION} needs a viewer command; ignoring it`);
      viewer = null;
      return;
    }
    const trimmed = raw.trim();
    if (!trimmed) {
      warnings.push(`${VIEWER_OPTION} was given an empty viewer command; ignoring it`);
      viewer = null;
      return;
    }
    viewer = trimmed;
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === VIEWER_OPTION) {
      // The value is the next argument, which is consumed whether or not it is there to consume.
      takeViewer(i + 1 < args.length ? args[i + 1] : undefined);
      i += 1;
      continue;
    }
    if (arg.startsWith(VIEWER_OPTION_PREFIX)) {
      takeViewer(arg.slice(VIEWER_OPTION_PREFIX.length));
      continue;
    }
    return { kind: "usage-error", message: `Unrecognised argument: ${arg}` };
  }

  return { kind: "run", viewer, warnings };
}

/**
 * Where the package's own manifest sits, relative to this module. One level up from the compiled
 * module is the package root in every layout this program runs in — the repository during
 * development, and the installed package under `node_modules` — because npm always packs
 * `package.json` alongside the build output.
 */
export const PACKAGE_MANIFEST_URL = new URL("../package.json", import.meta.url);

/**
 * The version `--version` prints, read at run time from the package's own manifest rather than held
 * as a second copy in the program: the manifest is what npm publishes under, so a copy here could
 * only ever disagree with it.
 *
 * Throws when the manifest cannot be read or carries no version string. A version that cannot be
 * established is reported rather than replaced with a placeholder, because being asked for a version
 * and handed a wrong answer is worse than being handed an error.
 */
export function packageVersion(
  read: ReadTextFile = (p) => readFileSync(p, "utf8"),
  manifest: URL = PACKAGE_MANIFEST_URL,
): string {
  const parsed: unknown = JSON.parse(read(fileURLToPath(manifest)));
  const version = (parsed as { version?: unknown } | null)?.version;
  if (typeof version !== "string" || !version) {
    throw new Error(`${fileURLToPath(manifest)} carries no version string`);
  }
  return version;
}
