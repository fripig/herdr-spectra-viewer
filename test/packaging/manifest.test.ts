import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "smol-toml";

const manifest = parse(readFileSync(new URL("../../herdr-plugin.toml", import.meta.url), "utf8")) as any;

describe("herdr-plugin.toml", () => {
  it("declares the plugin identity", () => {
    expect(manifest.id).toBe("spectra-viewer");
    expect(typeof manifest.name).toBe("string");
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(typeof manifest.min_herdr_version).toBe("string");
  });

  it("builds with npm ci then npm run build", () => {
    expect(manifest.build.map((b: any) => b.command)).toEqual([["npm", "ci"], ["npm", "run", "build"]]);
  });

  it("declares the changes pane as an overlay running node dist/pane.js", () => {
    const pane = manifest.panes.find((p: any) => p.id === "changes");
    expect(pane.placement).toBe("overlay");
    expect(pane.command).toEqual(["node", "dist/pane.js"]);
  });

  it("declares the open action running node dist/open.js", () => {
    const action = manifest.actions.find((a: any) => a.id === "open");
    expect(action.contexts).toEqual(["workspace", "pane"]);
    expect(action.command).toEqual(["node", "dist/open.js"]);
  });
});
