import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

/**
 * Whether this module is the program the process was started to run.
 *
 * `import.meta.url` is always the module's resolved path, while `process.argv[1]` is the path the
 * caller gave. A package manager installs a command as a symbolic link, so those two are different
 * strings for the same file: comparing them as they arrive never matches, and an entry point that
 * guards on that comparison does nothing at all — no output, no error, exit code 0. Resolving the
 * argument to its real path first is what makes the two comparable.
 *
 * The conversion goes through `pathToFileURL` rather than string concatenation because a path
 * holding a space, `#` or `?` has to be percent-encoded to produce the URL `import.meta.url` holds.
 */
export function isEntryPoint(importMetaUrl: string, argv1: string | undefined): boolean {
  if (argv1 === undefined) return false;
  let real: string;
  try {
    real = realpathSync(argv1);
  } catch {
    // A path that does not resolve cannot be the module currently executing.
    return false;
  }
  return importMetaUrl === pathToFileURL(real).href;
}
