import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import { resolveGitDir } from "../../src/discovery/git-dir.js";
import { makeTmp, file, dir } from "../helpers/tmp.js";

let root: string;
let cleanup: () => Promise<void>;
beforeEach(async () => ({ root, cleanup } = await makeTmp()));
afterEach(() => cleanup());

describe("resolveGitDir", () => {
  it("returns the .git directory in a standard layout", async () => {
    await dir(root, "project/.git");
    expect(await resolveGitDir(path.join(root, "project"))).toBe(path.join(root, "project", ".git"));
  });

  it("follows gitdir: and commondir in a worktree layout", async () => {
    await dir(root, "repo/.git/worktrees/feature");
    await file(root, "repo/.git/worktrees/feature/commondir", "../..\n");
    await file(root, "wt/.git", `gitdir: ${path.join(root, "repo/.git/worktrees/feature")}\n`);
    expect(await resolveGitDir(path.join(root, "wt"))).toBe(path.join(root, "repo", ".git"));
  });

  it("uses the pointed directory when it has no commondir", async () => {
    await dir(root, "elsewhere/gitdir");
    await file(root, "wt/.git", `gitdir: ${path.join(root, "elsewhere/gitdir")}`);
    expect(await resolveGitDir(path.join(root, "wt"))).toBe(path.join(root, "elsewhere", "gitdir"));
  });

  it("returns null when .git is absent", async () => {
    await dir(root, "plain");
    expect(await resolveGitDir(path.join(root, "plain"))).toBeNull();
  });

  it("returns null when the .git file points to a missing path", async () => {
    await file(root, "wt/.git", `gitdir: ${path.join(root, "nope")}`);
    expect(await resolveGitDir(path.join(root, "wt"))).toBeNull();
  });
});
