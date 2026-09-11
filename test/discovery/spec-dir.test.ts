import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import { resolveSpecDir, specDirExists, SPECTRA_CONFIG_FILE } from "../../src/discovery/spec-dir.js";
import { makeTmp, file, dir } from "../helpers/tmp.js";

let root: string;
let cleanup: () => Promise<void>;
beforeEach(async () => ({ root, cleanup } = await makeTmp()));
afterEach(() => cleanup());

const under = (rel: string) => path.join(path.resolve(root), rel);
const legacy = () => under("openspec");

describe("resolveSpecDir", () => {
  it("uses the configured directory", async () => {
    await file(root, SPECTRA_CONFIG_FILE, "spec_dir: docs/spectra\n");
    const r = await resolveSpecDir(root);
    expect(r.directory).toBe(under("docs/spectra"));
    expect(r.warning).toBeNull();
  });

  it("falls back when the configuration file has no spec_dir field", async () => {
    await file(root, SPECTRA_CONFIG_FILE, "# spec_dir: docs/specs\nlocale: tw\n");
    const r = await resolveSpecDir(root);
    expect(r.directory).toBe(legacy());
    expect(r.warning).toBeNull();
  });

  it("falls back when there is no configuration file", async () => {
    const r = await resolveSpecDir(root);
    expect(r.directory).toBe(legacy());
    expect(r.warning).toBeNull();
  });

  it("ignores what is on disk when the configuration names no directory", async () => {
    await file(root, SPECTRA_CONFIG_FILE, "locale: tw\n");
    await dir(root, "docs/spectra/changes");
    const r = await resolveSpecDir(root);
    expect(r.directory).toBe(legacy());
    expect(r.warning).toBeNull();
  });

  // One case per row of the resolution table in design.md.
  const silent: [string, string, string][] = [
    ["an explicit legacy directory", "spec_dir: openspec\n", "openspec"],
    ["a document that is not a mapping", "just a string\n", "openspec"],
    ["a document that is a list", "- a\n- b\n", "openspec"],
    ["an empty document", "", "openspec"],
  ];
  for (const [name, content, expected] of silent) {
    it(`resolves ${name} without a warning`, async () => {
      await file(root, SPECTRA_CONFIG_FILE, content);
      const r = await resolveSpecDir(root);
      expect(r.directory).toBe(under(expected));
      expect(r.warning).toBeNull();
    });
  }

  const refused: [string, string][] = [
    ["content that is not valid YAML", "spec_dir: [unclosed\n"],
    ["a spec_dir that is not a string", "spec_dir: 42\n"],
    ["a spec_dir that is only whitespace", 'spec_dir: "   "\n'],
    ["an absolute spec_dir", "spec_dir: /etc\n"],
    ["a spec_dir escaping the project root", "spec_dir: ../outside\n"],
  ];
  for (const [name, content] of refused) {
    it(`falls back and warns about ${name}`, async () => {
      await file(root, SPECTRA_CONFIG_FILE, content);
      const r = await resolveSpecDir(root);
      expect(r.directory).toBe(legacy());
      expect(r.warning).toContain(SPECTRA_CONFIG_FILE);
      expect(r.warning).toContain("openspec");
    });
  }
});

describe("specDirExists", () => {
  it("accepts a project holding the directory its configuration names", async () => {
    await file(root, SPECTRA_CONFIG_FILE, "spec_dir: docs/spectra\n");
    await dir(root, "docs/spectra");
    expect(await specDirExists(root)).toBe(true);
  });

  it("accepts a legacy project holding openspec", async () => {
    await dir(root, "openspec");
    expect(await specDirExists(root)).toBe(true);
  });

  it("rejects a project whose configured directory is absent", async () => {
    await file(root, SPECTRA_CONFIG_FILE, "spec_dir: docs/spectra\n");
    await dir(root, "openspec");
    expect(await specDirExists(root)).toBe(false);
  });

  it("rejects a project with neither layout", async () => {
    expect(await specDirExists(root)).toBe(false);
  });
});
