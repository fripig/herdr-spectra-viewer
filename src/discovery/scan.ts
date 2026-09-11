import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { resolveGitDir } from "./git-dir.js";
import { resolveSpecDir } from "./spec-dir.js";
import { listArtifacts, newestModification, readChangeMetadata } from "./metadata.js";
import { deriveStatus, parseTaskProgress } from "./task-progress.js";
import type { ChangeGroup, ScanSnapshot, SpectraChange } from "./types.js";

const ARCHIVE_DIR = "archive";

async function listSubdirectories(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

async function readChange(name: string, group: ChangeGroup, directory: string): Promise<SpectraChange> {
  const [artifacts, metadata] = await Promise.all([listArtifacts(directory), readChangeMetadata(directory)]);
  const [modifiedAt, tasksText] = await Promise.all([
    newestModification(directory, artifacts),
    readFile(path.join(directory, "tasks.md"), "utf8").catch(() => null),
  ]);
  const progress = tasksText === null ? null : parseTaskProgress(tasksText);
  return {
    name,
    group,
    directory,
    artifacts,
    progress,
    status: deriveStatus(progress),
    createdAt: metadata.createdAt,
    modifiedAt,
    proposer: metadata.proposer,
  };
}

async function scanGroup(
  sourceDir: string | null,
  group: ChangeGroup,
  exclude: string[],
  warnings: string[],
): Promise<SpectraChange[]> {
  if (!sourceDir) return [];
  const names = (await listSubdirectories(sourceDir)).filter((n) => !exclude.includes(n));
  const results = await Promise.all(
    names.map(async (name) => {
      const directory = path.join(sourceDir, name);
      try {
        return await readChange(name, group, directory);
      } catch (err) {
        warnings.push(`Skipped unreadable change directory ${directory}: ${(err as Error).message}`);
        return null;
      }
    }),
  );
  return results.filter((c): c is SpectraChange => c !== null);
}

/**
 * Discover Spectra changes under a project root by reading the file system.
 * Never rejects for a readable project root; per-change failures become warnings.
 */
export async function scanChanges(projectRoot: string): Promise<ScanSnapshot> {
  const warnings: string[] = [];
  // Where the changes live is a question the project's configuration answers, not the file system.
  const specDir = await resolveSpecDir(projectRoot);
  if (specDir.warning) warnings.push(specDir.warning);
  const changesDir = path.join(specDir.directory, "changes");
  const gitDir = await resolveGitDir(projectRoot);
  const parkedDir = gitDir ? path.join(gitDir, "spectra-app", "changes") : null;
  const [active, archived, parked] = await Promise.all([
    scanGroup(changesDir, "active", [ARCHIVE_DIR], warnings),
    scanGroup(path.join(changesDir, ARCHIVE_DIR), "archived", [], warnings),
    scanGroup(parkedDir, "parked", [], warnings),
  ]);
  return { active, parked, archived, warnings };
}
