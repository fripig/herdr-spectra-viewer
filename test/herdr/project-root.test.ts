import { describe, it, expect } from "vitest";
import { resolveProjectRoot } from "../../src/herdr/project-root.js";
import { fakeClient } from "./fake-client.js";

const base = { projectRoot: "/work", projectRootFromContext: false, paneId: "p1", herdrBin: "/x/herdr" };

describe("resolveProjectRoot", () => {
  it("keeps the context JSON root without calling herdr", async () => {
    const c = fakeClient();
    expect(await resolveProjectRoot({ ...base, projectRoot: "/repo", projectRootFromContext: true }, c)).toBe("/repo");
    expect(c.calls).toEqual([]);
  });

  it("uses the invoking pane's cwd when the context JSON has none", async () => {
    const c = fakeClient([{ stdout: '{"result":{"pane":{"cwd":"/repo","pane_id":"p1"}}}' }]);
    expect(await resolveProjectRoot(base, c)).toBe("/repo");
    expect(c.calls).toEqual([["pane", "get", "p1"]]);
  });

  it("falls back to the process cwd when pane get fails", async () => {
    const c = fakeClient([{ exitCode: 1 }]);
    expect(await resolveProjectRoot(base, c)).toBe("/work");
  });

  it("does not call herdr without a pane id or binary", async () => {
    const c = fakeClient();
    expect(await resolveProjectRoot({ ...base, paneId: null }, c)).toBe("/work");
    expect(await resolveProjectRoot({ ...base, herdrBin: null }, c)).toBe("/work");
    expect(c.calls).toEqual([]);
  });
});
