import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";

export interface ChangeMetadata {
  createdAt: string | null;
  proposer: string | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseCreatedAt(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (ISO_DATE.test(trimmed)) return trimmed;
  const m = /^(\d{4}-\d{2}-\d{2})T/.exec(trimmed);
  return m ? m[1] : null;
}

export function parseProposer(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const lt = value.indexOf("<");
  const name = (lt >= 0 ? value.slice(0, lt) : value).trim();
  return name.length > 0 ? name : null;
}

/** Single read of `.openspec.yaml`; every failure yields unknown fields. */
export async function readChangeMetadata(changeDir: string): Promise<ChangeMetadata> {
  const unknown: ChangeMetadata = { createdAt: null, proposer: null };
  let text: string;
  try {
    text = await readFile(path.join(changeDir, ".openspec.yaml"), "utf8");
  } catch {
    return unknown;
  }
  let doc: unknown;
  try {
    doc = parseYaml(text);
  } catch {
    return unknown;
  }
  if (!doc || typeof doc !== "object") return unknown;
  const record = doc as Record<string, unknown>;
  return { createdAt: parseCreatedAt(record.created), proposer: parseProposer(record.created_by) };
}

/** Every `.md` file beneath the change directory, relative, forward slashes, string-sorted. */
export async function listArtifacts(changeDir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string, rel: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(path.join(dir, e.name), childRel);
      else if (e.isFile() && e.name.endsWith(".md")) out.push(childRel);
    }
  }
  await walk(changeDir, "");
  return out.sort();
}

/** Newest mtime (epoch ms) among the given artifact files, or null. */
export async function newestModification(changeDir: string, artifacts: string[]): Promise<number | null> {
  const times = await Promise.all(
    artifacts.map(async (rel) => {
      try {
        return (await stat(path.join(changeDir, rel))).mtimeMs;
      } catch {
        return null;
      }
    }),
  );
  const known = times.filter((t): t is number => t !== null);
  return known.length === 0 ? null : Math.max(...known);
}
