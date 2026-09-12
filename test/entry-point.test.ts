import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { realpathSync } from "node:fs";
import { symlink } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isEntryPoint } from "../src/entry-point.js";
import { makeTmp, file } from "./helpers/tmp.js";

let root: string;
let cleanup: () => Promise<void>;
beforeEach(async () => ({ root, cleanup } = await makeTmp()));
afterEach(() => cleanup());

/** The URL the module itself would see, which is always its resolved path. */
const moduleUrl = (filePath: string) => pathToFileURL(realpathSync(filePath)).href;

describe("isEntryPoint", () => {
  it("matches the module's own path", async () => {
    const target = await file(root, "dist/pane.js");
    expect(isEntryPoint(moduleUrl(target), target)).toBe(true);
  });

  it("matches a symbolic link to the module, which is how a package manager installs a command", async () => {
    const target = await file(root, "dist/pane.js");
    const link = path.join(root, "node_modules/.bin/spectra-viewer");
    await file(root, "node_modules/.bin/.keep");
    await symlink(target, link);
    expect(isEntryPoint(moduleUrl(target), link)).toBe(true);
  });

  it("matches a path containing a space, which string concatenation would fail to encode", async () => {
    const target = await file(root, "my tools/dist/pane.js");
    expect(isEntryPoint(moduleUrl(target), target)).toBe(true);
  });

  it("does not match another existing file", async () => {
    const target = await file(root, "dist/pane.js");
    const other = await file(root, "dist/open.js");
    expect(isEntryPoint(moduleUrl(target), other)).toBe(false);
  });

  it("does not match a path that does not exist, and does not throw", async () => {
    const target = await file(root, "dist/pane.js");
    expect(isEntryPoint(moduleUrl(target), path.join(root, "dist/absent.js"))).toBe(false);
  });

  it("does not match when there is no first argument", async () => {
    const target = await file(root, "dist/pane.js");
    expect(isEntryPoint(moduleUrl(target), undefined)).toBe(false);
  });
});
