import { mkdtemp, mkdir, writeFile, utimes, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export async function makeTmp(): Promise<{ root: string; cleanup: () => Promise<void> }> {
  const root = await mkdtemp(path.join(tmpdir(), "spectra-viewer-"));
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) };
}

export async function file(root: string, rel: string, content = ""): Promise<string> {
  const full = path.join(root, rel);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, content);
  return full;
}

export async function dir(root: string, rel: string): Promise<string> {
  const full = path.join(root, rel);
  await mkdir(full, { recursive: true });
  return full;
}

export async function touch(full: string, iso: string): Promise<void> {
  const d = new Date(iso);
  await utimes(full, d, d);
}
