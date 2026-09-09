import { describe, it, expect } from "vitest";
import {
  sendTextToPane,
  focusPane,
  openInEditorSplit,
  createHerdrClient,
  extractSplitRatio,
  paneGeometry,
  shellQuote,
} from "../../src/herdr/client.js";
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
  // The layout an open with a remembered viewer pane asks for first: the plugin
  // pane `p1` and the viewer pane `p9`, side by side at 27 and 50 columns.
  const sideBySide = JSON.stringify({
    result: {
      layout: {
        panes: [
          { pane_id: "p1", rect: { x: 78, y: 0, width: 27, height: 48 } },
          { pane_id: "p9", rect: { x: 105, y: 0, width: 50, height: 48 } },
        ],
      },
    },
  });

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

  it("measures the layout, then closes the remembered viewer pane, then splits", async () => {
    const c = fakeClient([{ stdout: sideBySide }, {}, { stdout: '{"result":{"pane":{"pane_id":"p10"}}}' }, {}]);
    expect(await openInEditorSplit(c, { ...opts, previousViewerPane: "p9" })).toEqual({ ok: true, paneId: "p10" });
    expect(c.calls.map((a) => a.slice(0, 3))).toEqual([
      ["pane", "layout", "--pane"],
      ["pane", "close", "p9"],
      ["pane", "split", "--pane"],
      ["pane", "run", "p10"],
    ]);
  });

  it("asks for the layout of its own pane and gives the split the width the user set", async () => {
    const c = fakeClient([{ stdout: sideBySide }, {}, { stdout: '{"result":{"pane":{"pane_id":"p10"}}}' }, {}]);
    await openInEditorSplit(c, { ...opts, previousViewerPane: "p9" });
    expect(c.calls[0]).toEqual(["pane", "layout", "--pane", "p1"]);
    expect(c.calls[2]).toEqual(["pane", "split", "--pane", "p1", "--direction", "right", "--cwd", "/repo", "--ratio", "0.3506"]);
  });

  it("issues no close when no viewer pane is remembered", async () => {
    const c = fakeClient([{ stdout: '{"result":{"pane":{"pane_id":"p9"}}}' }, {}]);
    await openInEditorSplit(c, opts);
    expect(c.calls.some((a) => a[1] === "close")).toBe(false);
  });

  it("asks for no layout when there is nothing to measure against", async () => {
    // Nothing to measure: a first open has no viewer pane beside it, and an open
    // that does not know its own pane id cannot name one to the layout call.
    const split = { stdout: '{"result":{"pane":{"pane_id":"p10"}}}' };
    const cases = [
      { o: opts, responses: [split, {}] },
      { o: { ...opts, paneId: null, previousViewerPane: "p9" }, responses: [{}, split, {}] },
    ];
    for (const { o, responses } of cases) {
      const c = fakeClient(responses);
      expect((await openInEditorSplit(c, o)).ok).toBe(true);
      expect(c.calls.some((a) => a[1] === "layout")).toBe(false);
      expect(c.calls.find((a) => a[1] === "split")).not.toContain("--ratio");
    }
  });

  // Each row is a layout the ratio cannot be worked out from; the open has to
  // carry on with the split it would have issued before this was ever measured.
  it.each([
    ["the layout call exits non-zero", { exitCode: 2 }],
    ["the layout output is not valid JSON", { stdout: "not json" }],
    ["a pane is absent from the layout", { stdout: sideBySide.replace('"pane_id":"p9"', '"pane_id":"p404"') }],
    ["a width is not a positive integer", { stdout: sideBySide.replace('"width":50', '"width":0') }],
    ["the panes are not side by side", { stdout: sideBySide.replace('"x":105', '"x":0') }],
  ])("leaves the width to Herdr when %s", async (_case, layout) => {
    const c = fakeClient([layout, {}, { stdout: '{"result":{"pane":{"pane_id":"p10"}}}' }, {}]);
    expect(await openInEditorSplit(c, { ...opts, previousViewerPane: "p9" })).toEqual({ ok: true, paneId: "p10" });
    expect(c.calls[2]).toEqual(["pane", "split", "--pane", "p1", "--direction", "right", "--cwd", "/repo"]);
  });

  it("opens anyway when closing the remembered pane reports it is already gone", async () => {
    // Herdr exits zero for a stale pane id and reports the error in its output.
    const c = fakeClient([
      { stdout: sideBySide },
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

describe("extractSplitRatio", () => {
  // The shape Herdr reports, with the numbers a 155-column window produced: the
  // plugin pane starts at column 78, and the viewer pane starts where it ends.
  const layout = (own: object, viewer: object) =>
    JSON.stringify({
      result: {
        layout: {
          panes: [
            { pane_id: "p1", rect: { x: 78, y: 0, width: 27, height: 48, ...own } },
            { pane_id: "p9", rect: { x: 105, y: 0, width: 50, height: 48, ...viewer } },
          ],
        },
      },
    });
  const ratio = (stdout: string) => extractSplitRatio(stdout, "p1", "p9");

  it("gives the plugin pane's share of the two widths, to four places", () => {
    expect(ratio(layout({}, {}))).toBe("0.3506");
  });

  it("gives the share of an even split the same way", () => {
    expect(ratio(layout({ x: 78, width: 39 }, { x: 117, width: 38 }))).toBe("0.5065");
  });

  it("returns null when either pane is absent from the layout", () => {
    const stdout = layout({}, {});
    expect(extractSplitRatio(stdout, "p1", "p404")).toBeNull();
    expect(extractSplitRatio(stdout, "p404", "p9")).toBeNull();
  });

  it("returns null when a width is not a positive integer", () => {
    for (const width of [0, -1, 27.5, "27", undefined]) {
      expect(ratio(layout({ width }, { x: 105 }))).toBeNull();
      expect(ratio(layout({}, { width }))).toBeNull();
    }
  });

  it("returns null when the viewer pane does not begin where the plugin pane ends", () => {
    expect(ratio(layout({}, { x: 106 }))).toBeNull();
    expect(ratio(layout({}, { x: 0 }))).toBeNull();
  });

  it("returns null when the two panes do not share a top or a height", () => {
    expect(ratio(layout({}, { y: 1 }))).toBeNull();
    expect(ratio(layout({}, { height: 24 }))).toBeNull();
  });

  it("returns null when a position is missing or not a whole column", () => {
    for (const x of [undefined, -1, 78.5, "78"]) expect(ratio(layout({ x }, {}))).toBeNull();
    expect(ratio(layout({ y: undefined }, { y: undefined }))).toBeNull();
  });

  it("returns null when the layout is not readable", () => {
    for (const stdout of ["", "not json", "{}", '{"result":{"layout":{"panes":{}}}}']) {
      expect(ratio(stdout)).toBeNull();
    }
  });
});
