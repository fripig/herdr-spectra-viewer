import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import { chmod } from "node:fs/promises";
import { scanChanges } from "../../src/discovery/scan.js";
import { makeTmp, file, dir } from "../helpers/tmp.js";

let root: string;
let cleanup: () => Promise<void>;
beforeEach(async () => ({ root, cleanup } = await makeTmp()));
afterEach(() => cleanup());

const names = (list: { name: string }[]) => list.map((c) => c.name).sort();

describe("scanChanges", () => {
  it("returns a promise immediately", async () => {
    await dir(root, "openspec/changes");
    const p = scanChanges(root);
    expect(p).toBeInstanceOf(Promise);
    await p;
  });

  it("places changes from the three sources into their groups", async () => {
    await file(root, "openspec/changes/add-search/proposal.md");
    await file(root, "openspec/changes/archive/old-login/proposal.md");
    await file(root, ".git/spectra-app/changes/dark-mode/proposal.md");
    const snap = await scanChanges(root);
    expect(names(snap.active)).toEqual(["add-search"]);
    expect(names(snap.archived)).toEqual(["old-login"]);
    expect(names(snap.parked)).toEqual(["dark-mode"]);
    expect(snap.warnings).toEqual([]);
  });

  it("never treats the archive directory as an active change", async () => {
    await dir(root, "openspec/changes/archive");
    const snap = await scanChanges(root);
    expect(snap.active).toEqual([]);
  });

  it("leaves a group empty when its source directory is absent", async () => {
    await file(root, "openspec/changes/only-active/proposal.md");
    const snap = await scanChanges(root);
    expect(names(snap.active)).toEqual(["only-active"]);
    expect(snap.archived).toEqual([]);
    expect(snap.parked).toEqual([]);
  });

  it("reports every discovered change regardless of order", async () => {
    for (const n of ["zebra-fix", "add-search", "mid-tier"]) await dir(root, `openspec/changes/${n}`);
    expect(names((await scanChanges(root)).active)).toEqual(["add-search", "mid-tier", "zebra-fix"]);
  });

  it("reports metadata, progress and status per change", async () => {
    await file(root, "openspec/changes/c/.openspec.yaml", "created: 2026-08-10\ncreated_by: fripig <f@x>\n");
    await file(root, "openspec/changes/c/tasks.md", "- [x] a\n- [ ] b\n- [ ] c\n");
    await file(root, "openspec/changes/c/specs/x/spec.md");
    const [c] = (await scanChanges(root)).active;
    expect(c.directory).toBe(path.join(root, "openspec/changes/c"));
    expect(c.artifacts).toEqual(["specs/x/spec.md", "tasks.md"]);
    expect(c.progress).toEqual({ complete: 1, total: 3 });
    expect(c.status).toBe("in-progress");
    expect(c.createdAt).toBe("2026-08-10");
    expect(c.proposer).toBe("fripig");
    expect(typeof c.modifiedAt).toBe("number");
  });

  it("reports a change without .openspec.yaml and adds no warning", async () => {
    await file(root, "openspec/changes/c/proposal.md");
    const snap = await scanChanges(root);
    expect(snap.active[0]).toMatchObject({ name: "c", createdAt: null, proposer: null, progress: null, status: "draft" });
    expect(snap.warnings).toEqual([]);
  });

  it.skipIf(process.getuid?.() === 0)("omits an unreadable change and records one warning", async () => {
    await file(root, "openspec/changes/ok-1/proposal.md");
    await file(root, "openspec/changes/ok-2/proposal.md");
    const bad = await dir(root, "openspec/changes/broken");
    await chmod(bad, 0o000);
    try {
      const snap = await scanChanges(root);
      expect(names(snap.active)).toEqual(["ok-1", "ok-2"]);
      expect(snap.warnings).toHaveLength(1);
      expect(snap.warnings[0]).toContain(bad);
    } finally {
      await chmod(bad, 0o755);
    }
  });
});
