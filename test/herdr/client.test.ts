import { describe, it, expect } from "vitest";
import { sendTextToPane, openInEditorSplit, createHerdrClient, shellQuote } from "../../src/herdr/client.js";
import { fakeClient } from "./fake-client.js";

describe("sendTextToPane", () => {
  it("passes the text as one argv element", async () => {
    const c = fakeClient();
    expect(await sendTextToPane(c, "p1", "/spectra-apply add-search")).toEqual({ ok: true });
    expect(c.calls).toEqual([["pane", "send-text", "p1", "/spectra-apply add-search"]]);
  });

  it("reports failure on non-zero exit", async () => {
    const c = fakeClient([{ exitCode: 2 }]);
    expect((await sendTextToPane(c, "p1", "x")).ok).toBe(false);
  });
});

describe("openInEditorSplit", () => {
  const opts = { projectRoot: "/repo", paneId: "p1", editor: "nvim", filePath: "/repo/openspec/changes/add-search/design.md" };

  it("splits then runs the editor in the new pane", async () => {
    const c = fakeClient([{ stdout: '{"result":{"pane":{"pane_id":"p9"}}}' }, {}]);
    expect(await openInEditorSplit(c, opts)).toEqual({ ok: true });
    expect(c.calls).toEqual([
      ["pane", "split", "--pane", "p1", "--direction", "right", "--cwd", "/repo"],
      ["pane", "run", "p9", "nvim '/repo/openspec/changes/add-search/design.md'"],
    ]);
  });

  it("omits --pane when no pane id is known", async () => {
    const c = fakeClient([{ stdout: '{"result":{"pane":{"pane_id":"p9"}}}' }, {}]);
    await openInEditorSplit(c, { ...opts, paneId: null });
    expect(c.calls[0]).toEqual(["pane", "split", "--direction", "right", "--cwd", "/repo"]);
  });

  it("fails without running when split output lacks a pane id", async () => {
    const c = fakeClient([{ stdout: '{"result":{"type":"ok"}}' }]);
    expect((await openInEditorSplit(c, opts)).ok).toBe(false);
    expect(c.calls).toHaveLength(1);
  });

  it("fails when split exits non-zero", async () => {
    const c = fakeClient([{ exitCode: 1 }]);
    expect((await openInEditorSplit(c, opts)).ok).toBe(false);
    expect(c.calls).toHaveLength(1);
  });

  it("quotes paths with single quotes safely", () => {
    expect(shellQuote("/a/it's.md")).toBe(`'/a/it'\\''s.md'`);
  });
});

describe("createHerdrClient", () => {
  it("reports failure without spawning when the binary path is null", async () => {
    const r = await createHerdrClient(null).run(["pane", "list"]);
    expect(r.exitCode).not.toBe(0);
  });

  it("runs a real executable without a shell", async () => {
    const r = await createHerdrClient("/bin/echo").run(["a b", "$HOME"]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout.trim()).toBe("a b $HOME");
  });
});
