import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import { readChangeMetadata, listArtifacts, newestModification, parseProposer } from "../../src/discovery/metadata.js";
import { makeTmp, file, dir, touch } from "../helpers/tmp.js";

let root: string;
let cleanup: () => Promise<void>;
beforeEach(async () => ({ root, cleanup } = await makeTmp()));
afterEach(() => cleanup());

describe("readChangeMetadata: creation date", () => {
  it.each([
    ["created: 2026-08-10", "2026-08-10"],
    ["schema: spec-driven", null],
    ["created: last Tuesday", null],
    ["created:", null],
  ])("yaml %j → %j", async (yaml, expected) => {
    await file(root, "c/.openspec.yaml", yaml + "\n");
    expect((await readChangeMetadata(path.join(root, "c"))).createdAt).toBe(expected);
  });

  it("is unknown when the file is absent", async () => {
    await dir(root, "c");
    expect(await readChangeMetadata(path.join(root, "c"))).toEqual({ createdAt: null, proposer: null });
  });
});

describe("readChangeMetadata: proposer", () => {
  it.each([
    ["created_by: fripig <fripig@example.com>", "fripig"],
    ["created_by: Alice Chen <a@example.com>", "Alice Chen"],
    ["created_by: fripig", "fripig"],
    ["created_by: <fripig@example.com>", null],
    ["created_by:", null],
    ["schema: spec-driven", null],
  ])("yaml %j → %j", async (yaml, expected) => {
    await file(root, "c/.openspec.yaml", yaml + "\n");
    expect((await readChangeMetadata(path.join(root, "c"))).proposer).toBe(expected);
  });

  it("does not use created_with, archived_by or archived_at", async () => {
    await file(root, "c/.openspec.yaml", "created_with: claude\narchived_by: bob <b@x>\narchived_at: 2026-01-01\n");
    expect((await readChangeMetadata(path.join(root, "c"))).proposer).toBeNull();
  });

  it("reports both fields from one file, independently", async () => {
    await file(root, "c/.openspec.yaml", "created: last Tuesday\ncreated_by: fripig <fripig@example.com>\n");
    expect(await readChangeMetadata(path.join(root, "c"))).toEqual({ createdAt: null, proposer: "fripig" });
  });

  it("parseProposer strips the email", () => {
    expect(parseProposer("fripig <fripig@example.com>")).toBe("fripig");
  });
});

describe("listArtifacts", () => {
  it("lists .md files relative to the change directory, string-sorted", async () => {
    await file(root, "c/proposal.md");
    await file(root, "c/tasks.md");
    await file(root, "c/specs/theme-engine/spec.md");
    await file(root, "c/.openspec.yaml");
    expect(await listArtifacts(path.join(root, "c"))).toEqual(["proposal.md", "specs/theme-engine/spec.md", "tasks.md"]);
  });
});

describe("newestModification", () => {
  it("picks the newest Markdown file", async () => {
    const p = await file(root, "c/proposal.md", "a");
    const t = await file(root, "c/tasks.md", "b");
    await touch(p, "2026-08-11T17:00:00Z");
    await touch(t, "2026-08-12T09:00:00Z");
    expect(await newestModification(path.join(root, "c"), ["proposal.md", "tasks.md"])).toBe(Date.parse("2026-08-12T09:00:00Z"));
  });

  it("is null with no Markdown files", async () => {
    await dir(root, "c");
    expect(await newestModification(path.join(root, "c"), [])).toBeNull();
  });
});
