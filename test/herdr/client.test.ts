import { describe, it, expect } from "vitest";
import { sendTextToPane, focusPane, openInEditorSplit, createHerdrClient, paneGeometry, shellQuote } from "../../src/herdr/client.js";
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

describe("focusPane", () => {
  it("focuses the pane left of the plugin's own pane", async () => {
    const c = fakeClient();
    expect(await focusPane(c, { paneId: "p7" })).toEqual({ ok: true });
    expect(c.calls).toEqual([["pane", "focus", "--pane", "p7", "--direction", "left"]]);
  });

  it("reports failure naming the exit code", async () => {
    const c = fakeClient([{ exitCode: 2 }]);
    expect(await focusPane(c, { paneId: "p7" })).toEqual({ ok: false, reason: "pane focus exited 2" });
  });

  it("reports failure without spawning when there is no binary", async () => {
    const client = createHerdrClient(null);
    expect((await focusPane(client, { paneId: "p7" })).ok).toBe(false);
  });
});

describe("openInEditorSplit", () => {
  const opts = { projectRoot: "/repo", paneId: "p1", viewer: "less", filePath: "/repo/openspec/changes/add-search/design.md", previousViewerPane: null };

  it("splits then runs the viewer in the new pane, ending with exit so the pane closes", async () => {
    const c = fakeClient([{ stdout: '{"result":{"pane":{"pane_id":"p9"}}}' }, {}]);
    expect(await openInEditorSplit(c, opts)).toEqual({ ok: true, paneId: "p9" });
    expect(c.calls).toEqual([
      ["pane", "split", "--pane", "p1", "--direction", "right", "--cwd", "/repo"],
      ["pane", "run", "p9", "less '/repo/openspec/changes/add-search/design.md'; exit"],
    ]);
  });

  it("keeps a viewer's own flags in front of the path", async () => {
    const c = fakeClient([{ stdout: '{"result":{"pane":{"pane_id":"p9"}}}' }, {}]);
    await openInEditorSplit(c, { ...opts, viewer: "bat --style=plain" });
    expect(c.calls[1]).toEqual(["pane", "run", "p9", "bat --style=plain '/repo/openspec/changes/add-search/design.md'; exit"]);
  });

  it("quotes a path containing a single quote and still appends exit", async () => {
    const c = fakeClient([{ stdout: '{"result":{"pane":{"pane_id":"p9"}}}' }, {}]);
    await openInEditorSplit(c, { ...opts, filePath: "/repo/it's.md" });
    expect(c.calls[1]).toEqual(["pane", "run", "p9", `less '/repo/it'\\''s.md'; exit`]);
  });

  it("closes the remembered viewer pane before splitting the new one", async () => {
    const c = fakeClient([{}, { stdout: '{"result":{"pane":{"pane_id":"p10"}}}' }, {}]);
    expect(await openInEditorSplit(c, { ...opts, previousViewerPane: "p9" })).toEqual({ ok: true, paneId: "p10" });
    expect(c.calls.map((a) => a.slice(0, 3))).toEqual([
      ["pane", "close", "p9"],
      ["pane", "split", "--pane"],
      ["pane", "run", "p10"],
    ]);
  });

  it("issues no close when no viewer pane is remembered", async () => {
    const c = fakeClient([{ stdout: '{"result":{"pane":{"pane_id":"p9"}}}' }, {}]);
    await openInEditorSplit(c, opts);
    expect(c.calls.some((a) => a[1] === "close")).toBe(false);
  });

  it("opens anyway when closing the remembered pane reports it is already gone", async () => {
    // Herdr exits zero for a stale pane id and reports the error in its output.
    const c = fakeClient([
      { stdout: '{"error":{"code":"pane_not_found","message":"pane p9 not found"}}' },
      { stdout: '{"result":{"pane":{"pane_id":"p10"}}}' }, {},
    ]);
    expect(await openInEditorSplit(c, { ...opts, previousViewerPane: "p9" })).toEqual({ ok: true, paneId: "p10" });
  });

  it("splits again for a second open instead of reusing the first viewer pane", async () => {
    const c = fakeClient([
      { stdout: '{"result":{"pane":{"pane_id":"p9"}}}' }, {},
      { stdout: '{"result":{"pane":{"pane_id":"p10"}}}' }, {},
    ]);
    await openInEditorSplit(c, opts);
    await openInEditorSplit(c, opts);
    expect(c.calls.filter((a) => a[1] === "split")).toHaveLength(2);
    expect(c.calls.filter((a) => a[1] === "run").map((a) => a[2])).toEqual(["p9", "p10"]);
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

  it("keeps the reason shape when the split exits non-zero", async () => {
    const c = fakeClient([{ exitCode: 1 }]);
    expect(await openInEditorSplit(c, opts)).toEqual({ ok: false, reason: "pane split exited 1" });
  });

  it("fails when split exits non-zero", async () => {
    const c = fakeClient([{ exitCode: 1 }]);
    expect((await openInEditorSplit(c, opts)).ok).toBe(false);
    expect(c.calls).toHaveLength(1);
  });

  it("reports the pane a failed run left on screen so it can be closed next time", async () => {
    const c = fakeClient([{ stdout: '{"result":{"pane":{"pane_id":"p9"}}}' }, { exitCode: 1 }]);
    expect(await openInEditorSplit(c, opts)).toEqual({ ok: false, reason: "pane run exited 1", paneId: "p9" });
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

describe("paneGeometry", () => {
  const layout = (panes: Array<{ id: string; width: number; height: number }>) =>
    JSON.stringify({ result: { layout: { panes: panes.map((p) => ({ pane_id: p.id, rect: { x: 0, y: 0, width: p.width, height: p.height } })) } } });
  const info = (rows: unknown) => JSON.stringify({ result: { pane: { pane_id: "p7", scroll: { viewport_rows: rows } } } });
  const both = (rect: { width: number; height: number }, rows: unknown) =>
    fakeClient([{ stdout: layout([{ id: "p1", width: 78, height: 48 }, { id: "p7", ...rect }]) }, { stdout: info(rows) }]);

  it("takes the width from the layout and asks Herdr about the right pane", async () => {
    const c = both({ width: 39, height: 48 }, 46);
    expect(await paneGeometry(c, "p7")).toEqual({ columns: 39, rows: 46 });
    expect(c.calls).toEqual([["pane", "layout", "--pane", "p7"], ["pane", "get", "p7"]]);
  });

  it("ignores a stale viewport row count in favour of the rect, less the pane chrome", async () => {
    // A pane Herdr has just created: the rect is already 24, the pty still says 48.
    expect(await paneGeometry(both({ width: 77, height: 24 }, 48), "p7")).toEqual({ columns: 77, rows: 22 });
  });

  it("resolves the same height either way once the pane has settled", async () => {
    expect(await paneGeometry(both({ width: 77, height: 24 }, 22), "p7")).toEqual({ columns: 77, rows: 22 });
  });

  it("prefers the viewport rows when they are smaller than the rect allows", async () => {
    expect(await paneGeometry(both({ width: 77, height: 48 }, 20), "p7")).toEqual({ columns: 77, rows: 20 });
  });

  it("returns null when the pane id is absent from the layout", async () => {
    const c = fakeClient([{ stdout: layout([{ id: "p1", width: 78, height: 48 }]) }, { stdout: info(46) }]);
    expect(await paneGeometry(c, "p7")).toBeNull();
  });

  it("returns null when the layout call exits non-zero", async () => {
    const c = fakeClient([{ exitCode: 2 }, { stdout: info(46) }]);
    expect(await paneGeometry(c, "p7")).toBeNull();
  });

  it("returns null when the pane get call exits non-zero", async () => {
    const c = fakeClient([{ stdout: layout([{ id: "p7", width: 39, height: 48 }]) }, { exitCode: 2 }]);
    expect(await paneGeometry(c, "p7")).toBeNull();
  });

  it("returns null when either response is not JSON", async () => {
    const c = fakeClient([{ stdout: "not json" }, { stdout: info(46) }]);
    expect(await paneGeometry(c, "p7")).toBeNull();
    const d = fakeClient([{ stdout: layout([{ id: "p7", width: 39, height: 48 }]) }, { stdout: "not json" }]);
    expect(await paneGeometry(d, "p7")).toBeNull();
  });

  it("returns null when a rect field is missing or not a positive integer", async () => {
    for (const rect of [{ width: 39 }, { height: 48 }, { width: 0, height: 48 }, { width: 39, height: -1 }, { width: "39", height: 48 }]) {
      const stdout = JSON.stringify({ result: { layout: { panes: [{ pane_id: "p7", rect }] } } });
      const c = fakeClient([{ stdout }, { stdout: info(46) }]);
      expect(await paneGeometry(c, "p7")).toBeNull();
    }
  });

  it("returns null when viewport_rows is missing or not a positive integer", async () => {
    for (const rows of [undefined, 0, -1, 46.5, "46"]) {
      expect(await paneGeometry(both({ width: 39, height: 48 }, rows), "p7")).toBeNull();
    }
  });

  it("reports no geometry without spawning when there is no binary", async () => {
    expect(await paneGeometry(createHerdrClient(null), "p7")).toBeNull();
  });
});
