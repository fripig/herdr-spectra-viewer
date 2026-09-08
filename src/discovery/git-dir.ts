import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const GITDIR_PREFIX = "gitdir:";

async function isDirectory(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Resolve the git directory for a project root, following `.git` file
 * indirection used by worktrees and the `commondir` pointer inside it.
 * Returns null when nothing usable exists.
 */
export async function resolveGitDir(projectRoot: string): Promise<string | null> {
  const dotGit = path.join(projectRoot, ".git");
  let info;
  try {
    info = await stat(dotGit);
  } catch {
    return null;
  }
  if (info.isDirectory()) return dotGit;
  if (!info.isFile()) return null;

  let content: string;
  try {
    content = await readFile(dotGit, "utf8");
  } catch {
    return null;
  }
  const line = content.split(/\r?\n/).find((l) => l.startsWith(GITDIR_PREFIX));
  if (!line) return null;
  const pointed = path.resolve(projectRoot, line.slice(GITDIR_PREFIX.length).trim());
  if (!(await isDirectory(pointed))) return null;

  try {
    const common = (await readFile(path.join(pointed, "commondir"), "utf8")).trim();
    if (common) {
      const resolved = path.resolve(pointed, common);
      if (await isDirectory(resolved)) return resolved;
    }
  } catch {
    // no commondir: the pointed directory is the git directory
  }
  return pointed;
}
