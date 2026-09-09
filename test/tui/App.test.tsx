import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "ink-testing-library";
import { App, NOT_INITIALISED, NO_AUTHORS, SCANNING, SELECT_CHANGE_FIRST, type AppDeps } from "../../src/tui/App.js";
import type { ScanSnapshot, SpectraChange } from "../../src/discovery/types.js";
import { fakeClient } from "../herdr/fake-client.js";

const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
// Two macrotasks: one for the render, one for React to flush the passive effects
// that re-register the input handler. One is enough only on an idle machine.
const settle = async () => { await tick(); await tick(); };
const ESC = "";
const UP = `${ESC}[A`;
const DOWN = `${ESC}[B`;
const LEFT = `${ESC}[D`;
const RIGHT = `${ESC}[C`;
const ENTER = "\r";
const press = (col: number, row: number) => `${ESC}[<0;${col};${row}M`;
const release = (col: number, row: number) => `${ESC}[<0;${col};${row}m`;
const wheelUp = (col: number, row: number) => `${ESC}[<64;${col};${row}M`;
const wheelDown = (col: number, row: number) => `${ESC}[<65;${col};${row}M`;

function change(name: string, group: SpectraChange["group"], extra: Partial<SpectraChange> = {}): SpectraChange {
  return {
    name, group, directory: `/repo/changes/${name}`, artifacts: ["design.md", "proposal.md", "tasks.md"],
    progress: null, status: "draft", createdAt: null, modifiedAt: null, proposer: null, ...extra,
  };
}

function snapshot(partial: Partial<ScanSnapshot> = {}): ScanSnapshot {
  return { active: [], parked: [], archived: [], warnings: [], ...partial };
}

interface MountOpts {
  snap?: ScanSnapshot;
  paneId?: string | null;
  commandPaneId?: string | null;
  focusOk?: boolean;
  hasOpenspec?: boolean;
  height?: number;
  scan?: AppDeps["scan"];
  sendOk?: boolean;
  copyOk?: boolean;
  viewerOk?: boolean;
  viewer?: string;
}

interface Harness {
  deps: AppDeps;
  frame: () => string;
  press: (s: string) => Promise<void>;
  /** Keys delivered back to back, without waiting for a render in between. */
  pressFast: (...keys: string[]) => Promise<void>;
  files: Map<string, string>;
  client: ReturnType<typeof fakeClient>;
  sendText: ReturnType<typeof vi.fn>;
  focusPane: ReturnType<typeof vi.fn>;
  copy: ReturnType<typeof vi.fn>;
  openEditor: ReturnType<typeof vi.fn>;
  onExit: ReturnType<typeof vi.fn>;
  scan: ReturnType<typeof vi.fn>;
  viewerPane: { current: string | null };
}

async function mount(opts: MountOpts = {}): Promise<Harness> {
  const files = new Map<string, string>();
  const client = fakeClient();
  const scan = vi.fn(opts.scan ?? (async () => opts.snap ?? snapshot()));
  const sendText = vi.fn(async () => (opts.sendOk === false ? { ok: false as const, reason: "x" } : { ok: true as const }));
  const focusPane = vi.fn(async () => (opts.focusOk === false ? { ok: false as const, reason: "x" } : { ok: true as const }));
  const copy = vi.fn(async () => (opts.copyOk === false ? { ok: false as const, reason: "x" } : { ok: true as const }));
  let nextPane = 9;
  const openEditor = vi.fn(async () =>
    opts.viewerOk === false ? { ok: false as const, reason: "x" } : { ok: true as const, paneId: `p${nextPane++}` },
  );
  const onExit = vi.fn();
  const viewerPane: { current: string | null } = { current: null };
  const ownPane = opts.paneId === undefined ? "p1" : opts.paneId;
  const deps: AppDeps = {
    projectRoot: "/repo",
    context: {
      projectRoot: "/repo", projectRootFromContext: true,
      paneId: ownPane,
      commandPaneId: opts.commandPaneId === undefined ? ownPane : opts.commandPaneId,
      herdrBin: "/x/herdr",
    },
    client, viewer: opts.viewer ?? "nvim", scan,
    hasOpenspec: async () => opts.hasOpenspec ?? true,
    readArtifact: async (p) => { const c = files.get(p); if (c === undefined) throw new Error("ENOENT"); return c; },
    sendText, focusPane, openEditor, copy, onExit, viewerPane, height: opts.height ?? 20,
  };
  const r = render(<App {...deps} />);
  await settle();
  return {
    deps, files, client, sendText, focusPane, copy, openEditor, onExit, scan, viewerPane,
    frame: () => r.lastFrame() ?? "",
    press: async (s) => { r.stdin.write(s); await settle(); },
    pressFast: async (...keys: string[]) => { for (const k of keys) r.stdin.write(k); await settle(); },
  };
}

const three = () => snapshot({
  active: [change("add-search", "active", { progress: { complete: 3, total: 8 } }), change("no-tasks", "active")],
  parked: [change("dark-mode", "parked")],
});

describe("states", () => {
  it("shows the not-initialised message without openspec", async () => {
    const h = await mount({ hasOpenspec: false });
    expect(h.frame()).toContain(NOT_INITIALISED);
    expect(h.frame()).not.toContain("Active (");
  });

  it("shows Scanning… while the scan runs", async () => {
    let resolve!: (s: ScanSnapshot) => void;
    const h = await mount({ scan: () => new Promise((r) => { resolve = r; }) });
    expect(h.frame()).toContain(SCANNING);
    resolve(snapshot());
    await tick();
    expect(h.frame()).not.toContain(SCANNING);
  });

  it("counts skipped changes in the status bar", async () => {
    const h = await mount({ snap: snapshot({ warnings: ["a", "b"] }) });
    expect(h.frame()).toContain("2 change(s) skipped");
  });

  it("exits with code 0 on q and on Escape", async () => {
    const h = await mount();
    await h.press("q");
    expect(h.onExit).toHaveBeenCalledWith(0);
    const h2 = await mount();
    await h2.press(ESC);
    expect(h2.onExit).toHaveBeenCalledWith(0);
  });
});

describe("grouped tree", () => {
  it("renders groups with counts, Active expanded, cursor on Active", async () => {
    const h = await mount({ snap: three() });
    const f = h.frame();
    expect(f).toContain("Active (2)");
    expect(f).toContain("Parked (1)");
    expect(f).toContain("Archived (0)");
    expect(f).toContain("add-search (3/8)");
    expect(f).toContain("no-tasks");
    expect(f).not.toContain("dark-mode");
    expect(f).toMatch(/> .*Active \(2\)/);
  });

  it("shows a change without progress as its bare name", async () => {
    const h = await mount({ snap: three() });
    expect(h.frame()).toMatch(/no-tasks\s*$/m);
  });

  it("moves the cursor without wrapping", async () => {
    const h = await mount({ snap: three() });
    await h.press(UP);
    expect(h.frame()).toMatch(/> .*Active \(2\)/);
    for (let i = 0; i < 10; i++) await h.press("j");
    expect(h.frame()).toMatch(/> .*Archived \(0\)/);
    await h.press(DOWN);
    expect(h.frame()).toMatch(/> .*Archived \(0\)/);
  });

  it("expands parked with Right and shows the parked change", async () => {
    const h = await mount({ snap: three() });
    await h.press("j"); await h.press("j"); await h.press("j");
    expect(h.frame()).toMatch(/> .*Parked \(1\)/);
    await h.press(RIGHT);
    expect(h.frame()).toContain("dark-mode");
  });

  it("Left on a collapsed change moves to its group", async () => {
    const h = await mount({ snap: three() });
    await h.press("j");
    expect(h.frame()).toMatch(/> .*add-search/);
    await h.press(LEFT);
    expect(h.frame()).toMatch(/> .*Active \(2\)/);
  });

  it("Left on an expanded node collapses it", async () => {
    const h = await mount({ snap: three() });
    await h.press("h");
    expect(h.frame()).not.toContain("add-search");
  });

  it("keeps the cursor row rendered in a tall tree", async () => {
    const many = snapshot({ active: Array.from({ length: 30 }, (_, i) => change(`chg-${String(i).padStart(2, "0")}`, "active")) });
    const h = await mount({ snap: many, height: 10 });
    expect(h.frame()).not.toContain("chg-29");
    for (let i = 0; i < 30; i++) await h.press("j");
    expect(h.frame()).toMatch(/> .*chg-29/);
    expect(h.frame()).not.toContain("chg-00");
  });
});

describe("Enter", () => {
  it("Enter on an artifact opens it in the viewer", async () => {
    const h = await mount({ snap: three() });
    h.files.set("/repo/changes/add-search/design.md", "# Design\nhello");
    await h.press("j"); await h.press("l"); await h.press("j");
    expect(h.frame()).toMatch(/> .*design\.md/);
    await h.press(ENTER);
    expect(h.openEditor).toHaveBeenCalledWith(h.client, {
      projectRoot: "/repo", paneId: "p1", viewer: "nvim", filePath: "/repo/changes/add-search/design.md",
      previousViewerPane: null,
    });
    expect(h.frame()).toContain("Opened in nvim");
  });

  it("Enter on a change toggles expansion", async () => {
    const h = await mount({ snap: three() });
    await h.press("j"); await h.press(ENTER);
    expect(h.frame()).toContain("design.md");
    expect(h.openEditor).not.toHaveBeenCalled();
  });

  it("reports a deleted artifact without changing the tree", async () => {
    const h = await mount({ snap: three() });
    await h.press("j"); await h.press("l"); await h.press("j");
    await h.press(ENTER);
    expect(h.frame()).toContain("File not found: design.md");
    expect(h.frame()).toMatch(/> .*design\.md/);
    expect(h.openEditor).not.toHaveBeenCalled();
  });
});

describe("open in viewer", () => {
  async function onArtifact(opts: MountOpts = {}) {
    const h = await mount({ snap: three(), ...opts });
    h.files.set("/repo/changes/add-search/proposal.md", "p");
    await h.press("j"); await h.press("l"); await h.press("j"); await h.press("j");
    expect(h.frame()).toMatch(/> .*proposal\.md/);
    return h;
  }

  it("remembers the pane a successful open created", async () => {
    const h = await onArtifact();
    expect(h.viewerPane.current).toBeNull();
    await h.press("e");
    expect(h.viewerPane.current).toBe("p9");
    await h.press("e");
    expect(h.openEditor).toHaveBeenLastCalledWith(h.client, expect.objectContaining({ previousViewerPane: "p9" }));
    expect(h.viewerPane.current).toBe("p10");
  });

  it("asks the adapter to open the file in the viewer", async () => {
    const h = await onArtifact();
    await h.press("e");
    expect(h.openEditor).toHaveBeenCalledWith(h.client, {
      projectRoot: "/repo", paneId: "p1", viewer: "nvim", filePath: "/repo/changes/add-search/proposal.md",
      previousViewerPane: null,
    });
    expect(h.frame()).toContain("Opened in nvim");
  });

  it("uses the configured viewer command", async () => {
    const h = await onArtifact({ viewer: "vi" });
    await h.press("e");
    expect(h.openEditor.mock.calls[0][1]).toMatchObject({ viewer: "vi" });
  });

  it("keeps the plugin pane open after an artifact is opened", async () => {
    const h = await onArtifact();
    await h.press("e");
    expect(h.onExit).not.toHaveBeenCalled();
    expect(h.frame()).toMatch(/> .*proposal\.md/);
  });

  it("passes no previous pane on the first open and the created one on the next", async () => {
    const h = await onArtifact();
    await h.press("e");
    expect(h.openEditor.mock.calls[0][1]).toMatchObject({ previousViewerPane: null });
    await h.press("e");
    expect(h.openEditor.mock.calls[1][1]).toMatchObject({ previousViewerPane: "p9" });
    await h.press("e");
    expect(h.openEditor.mock.calls[2][1]).toMatchObject({ previousViewerPane: "p10" });
  });

  it("a missing file closes nothing and keeps the remembered pane", async () => {
    const h = await onArtifact();
    await h.press("e");
    expect(h.openEditor.mock.calls[0][1]).toMatchObject({ previousViewerPane: null });
    await h.press("k");
    expect(h.frame()).toMatch(/> .*design\.md/);
    await h.press("e");
    expect(h.frame()).toContain("File not found: design.md");
    expect(h.openEditor).toHaveBeenCalledTimes(1);
    await h.press("j");
    await h.press("e");
    expect(h.openEditor.mock.calls[1][1]).toMatchObject({ previousViewerPane: "p9" });
  });

  it("remembers no pane after an open whose split failed", async () => {
    const h = await onArtifact({ viewerOk: false });
    await h.press("e");
    await h.press("e");
    expect(h.openEditor.mock.calls[1][1]).toMatchObject({ previousViewerPane: null });
  });

  it("reports adapter failure", async () => {
    const h = await onArtifact({ viewerOk: false });
    await h.press("e");
    expect(h.frame()).toContain("Could not open viewer");
  });

  it("reports a missing file and does not call the adapter", async () => {
    const h = await mount({ snap: three() });
    await h.press("j"); await h.press("l"); await h.press("j");
    await h.press("e");
    expect(h.frame()).toContain("File not found: design.md");
    expect(h.openEditor).not.toHaveBeenCalled();
  });

  it("does nothing on a change node", async () => {
    const h = await mount({ snap: three() });
    await h.press("j"); await h.press("e");
    expect(h.openEditor).not.toHaveBeenCalled();
  });
});

describe("rescan", () => {
  it("moves a parked change and preserves expansion", async () => {
    const first = three();
    const second = snapshot({ active: [change("no-tasks", "active")], parked: [change("dark-mode", "parked"), change("add-search", "parked")] });
    let n = 0;
    const h = await mount({ scan: async () => (n++ === 0 ? first : second) });
    await h.press("j"); await h.press("j"); await h.press("j"); await h.press("l");
    expect(h.frame()).toContain("dark-mode");
    await h.press("R");
    expect(h.scan).toHaveBeenCalledTimes(2);
    const f = h.frame();
    expect(f).toContain("Active (1)");
    expect(f).toContain("Parked (2)");
    expect(f).toContain("dark-mode");
    expect(f).toContain("add-search");
  });

  it("moves the cursor to the group when its node disappears", async () => {
    let n = 0;
    const h = await mount({ scan: async () => (n++ === 0 ? three() : snapshot({ active: [change("no-tasks", "active")] })) });
    await h.press("j");
    expect(h.frame()).toMatch(/> .*add-search/);
    await h.press("R");
    expect(h.frame()).toMatch(/> .*Active \(1\)/);
  });
});

describe("send a Spectra command", () => {
  it.each([
    ["d", "/spectra-discuss add-search"],
    ["a", "/spectra-apply add-search"],
    ["i", "/spectra-ingest add-search"],
    ["r", "/spectra-archive add-search"],
    ["c", "/spectra-commit add-search"],
  ])("key %s sends %s to the invoking pane and stays open", async (key, text) => {
    const h = await mount({ snap: three() });
    await h.press("j");
    await h.press(key);
    expect(h.sendText).toHaveBeenCalledWith(h.client, "p1", text);
    expect(h.onExit).not.toHaveBeenCalled();
    expect(h.frame()).toContain(`Sent: ${text}`);
    expect(h.scan).toHaveBeenCalledTimes(1);
  });

  it("sends to the pane that invoked the plugin, not to its own pane", async () => {
    const h = await mount({ snap: three(), paneId: "w4:p1C", commandPaneId: "w4:p1" });
    await h.press("j");
    await h.press("a");
    expect(h.sendText).toHaveBeenCalledWith(h.client, "w4:p1", "/spectra-apply add-search");
    expect(h.sendText.mock.calls.some((c) => c[1] === "w4:p1C")).toBe(false);
    expect(h.onExit).not.toHaveBeenCalled();
  });

  it("hands focus back to the pane on its left after a send", async () => {
    const h = await mount({ snap: three(), paneId: "p7", commandPaneId: "p1" });
    await h.press("j");
    await h.press("a");
    expect(h.focusPane).toHaveBeenCalledWith(h.client, { paneId: "p7" });
    expect(h.frame()).toContain("Sent: /spectra-apply add-search");
    expect(h.onExit).not.toHaveBeenCalled();
  });

  it("says so when the focus call fails", async () => {
    const h = await mount({ snap: three(), paneId: "p7", commandPaneId: "p1", focusOk: false });
    await h.press("j");
    await h.press("a");
    expect(h.frame()).toContain("Sent, but could not focus pane");
    expect(h.copy).not.toHaveBeenCalled();
    expect(h.onExit).not.toHaveBeenCalled();
  });

  it("says so when it has no pane of its own to focus from", async () => {
    const h = await mount({ snap: three(), paneId: null, commandPaneId: "p1" });
    await h.press("j");
    await h.press("a");
    expect(h.sendText).toHaveBeenCalledWith(h.client, "p1", "/spectra-apply add-search");
    expect(h.focusPane).not.toHaveBeenCalled();
    expect(h.frame()).toContain("Sent, but could not focus pane");
  });

  it("copies when the plugin has a pane of its own but no invoking pane", async () => {
    const h = await mount({ snap: three(), paneId: "w4:p1C", commandPaneId: null });
    await h.press("j"); await h.press("c");
    expect(h.sendText).not.toHaveBeenCalled();
    expect(h.frame()).toContain("Copied: /spectra-commit add-search");
  });

  it("uses the artifact's owning change", async () => {
    const h = await mount({ snap: three() });
    await h.press("j"); await h.press("l"); await h.press("j"); await h.press("j"); await h.press("j");
    expect(h.frame()).toMatch(/> .*tasks\.md/);
    await h.press("i");
    expect(h.sendText).toHaveBeenCalledWith(h.client, "p1", "/spectra-ingest add-search");
  });

  it("copies when no pane id is known", async () => {
    const h = await mount({ snap: three(), paneId: null });
    await h.press("j"); await h.press("c");
    expect(h.sendText).not.toHaveBeenCalled();
    expect(h.focusPane).not.toHaveBeenCalled();
    expect(h.copy).toHaveBeenCalledWith("/spectra-commit add-search");
    expect(h.onExit).not.toHaveBeenCalled();
    expect(h.frame()).toContain("Copied: /spectra-commit add-search");
  });

  it("copies when sending fails", async () => {
    const h = await mount({ snap: three(), sendOk: false });
    await h.press("j"); await h.press("d");
    expect(h.copy).toHaveBeenCalledWith("/spectra-discuss add-search");
    expect(h.focusPane).not.toHaveBeenCalled();
    expect(h.onExit).not.toHaveBeenCalled();
    expect(h.frame()).toContain("Herdr send failed, copied instead");
  });

  it("reports when the clipboard also fails", async () => {
    const h = await mount({ snap: three(), paneId: null, copyOk: false });
    await h.press("j"); await h.press("a");
    expect(h.frame()).toContain("Copy failed: /spectra-apply add-search");
  });

  it("is inert on a group node", async () => {
    const h = await mount({ snap: three() });
    await h.press("j"); await h.press("j"); await h.press("j"); await h.press("j");
    expect(h.frame()).toMatch(/> .*Archived/);
    await h.press("r");
    expect(h.sendText).not.toHaveBeenCalled();
    expect(h.copy).not.toHaveBeenCalled();
    expect(h.frame()).toContain(SELECT_CHANGE_FIRST);
  });

  it("lists the five commands in workflow order without propose", async () => {
    const h = await mount({ snap: three() });
    const f = h.frame();
    const idx = ["d discuss", "a apply", "i ingest", "r archive", "c commit"].map((s) => f.indexOf(s));
    expect(idx.every((i) => i >= 0)).toBe(true);
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    expect(f).not.toContain("propose");
  });

  it("keeps expansion state and does not rescan on copy", async () => {
    const h = await mount({ snap: three(), paneId: null });
    await h.press("j"); await h.press("l"); await h.press("a");
    expect(h.scan).toHaveBeenCalledTimes(1);
    expect(h.frame()).toContain("design.md");
  });
});

describe("mouse", () => {
  // With the header on row 1: row 2 "Active (2)" (expanded), row 3 "add-search (3/8)", row 4 "no-tasks",
  // row 5 "Parked (1)", row 6 "Archived (0)".
  it("a mouse report never quits the pane, sends, or copies", async () => {
    const h = await mount({ snap: three() });
    await h.press(press(17, 18));
    await h.press(release(17, 18));
    await h.press(`${ESC}[<0;17`);
    expect(h.onExit).not.toHaveBeenCalled();
    expect(h.sendText).not.toHaveBeenCalled();
    expect(h.copy).not.toHaveBeenCalled();
    expect(h.frame()).toMatch(/> .*Active \(2\)/);
  });

  it("click on a label moves the cursor and leaves expansion unchanged", async () => {
    const h = await mount({ snap: three() });
    await h.press(press(10, 3));
    expect(h.frame()).toMatch(/> .*add-search \(3\/8\)/);
    expect(h.frame()).not.toContain("design.md");
  });

  it("click on the marker cells toggles the node and keeps the cursor on it", async () => {
    const h = await mount({ snap: three() });
    await h.press(press(3, 2));
    expect(h.frame()).toMatch(/> .*Active \(2\)/);
    expect(h.frame()).not.toContain("add-search");
    await h.press(press(4, 2));
    expect(h.frame()).toContain("add-search");
  });

  it("click on an artifact opens it in the viewer", async () => {
    const h = await mount({ snap: three() });
    h.files.set("/repo/changes/add-search/design.md", "# Design");
    await h.press("j"); await h.press("l");
    expect(h.frame().split("\n")[3]).toContain("design.md");
    await h.press(press(12, 4));
    expect(h.frame()).toMatch(/> .*design\.md/);
    expect(h.openEditor).toHaveBeenCalledWith(h.client, {
      projectRoot: "/repo", paneId: "p1", viewer: "nvim", filePath: "/repo/changes/add-search/design.md",
      previousViewerPane: null,
    });
    expect(h.frame()).toContain("Opened in nvim");
  });

  it("click on a missing artifact reports it and opens nothing", async () => {
    const h = await mount({ snap: three() });
    await h.press("j"); await h.press("l");
    await h.press(press(12, 4));
    expect(h.frame()).toContain("File not found: design.md");
    expect(h.openEditor).not.toHaveBeenCalled();
    expect(h.frame()).toMatch(/> .*design\.md/);
  });

  it("click below the last node or on the status bar does nothing", async () => {
    const h = await mount({ snap: three(), height: 20 });
    await h.press(press(5, 8));
    await h.press(press(5, 19));
    expect(h.frame()).toMatch(/> .*Active \(2\)/);
    expect(h.frame()).toContain("add-search");
  });

  it("click accounts for a scrolled window and a row rendered above the tree", async () => {
    const many = snapshot({ active: Array.from({ length: 30 }, (_, i) => change(`chg-${String(i).padStart(2, "0")}`, "active")) });
    let resolve: (s: ScanSnapshot) => void = () => {};
    let first = true;
    const scan: AppDeps["scan"] = () => {
      if (first) { first = false; return Promise.resolve(many); }
      return new Promise<ScanSnapshot>((r) => { resolve = r; });
    };
    const h = await mount({ scan, height: 10 }); // treeHeight 6
    for (let i = 0; i < 10; i++) await h.press("j"); // cursor 10, window starts at 5
    await h.press("R"); // "Scanning…" now occupies the row above the tree
    expect(h.frame().split("\n")[0]).toContain(SCANNING);
    await h.press(press(10, 3));
    expect(h.frame()).toMatch(/> .*chg-05/);
    resolve(many);
  });

  it("wheel over the tree moves the cursor one row and does not wrap", async () => {
    const h = await mount({ snap: three() });
    await h.press(wheelDown(5, 4));
    expect(h.frame()).toMatch(/> .*add-search/);
    await h.press(wheelUp(5, 4));
    await h.press(wheelUp(5, 4));
    expect(h.frame()).toMatch(/> .*Active \(2\)/);
  });

  it("wheel on the status bar does nothing", async () => {
    const h = await mount({ snap: three(), height: 20 });
    await h.press(wheelDown(5, 19));
    expect(h.frame()).toMatch(/> .*Active \(2\)/);
  });
});

// ---------------------------------------------------------------------------
// Sorting, filtering, authors, and copying a change name.
// ---------------------------------------------------------------------------

const BACKSPACE = "";
const SPACE = " ";

const type = async (h: Harness, text: string) => { for (const ch of text) await h.press(ch); };

/** Change rows rendered under the Active group, in order, without their markers. */
function underActive(frame: string): string[] {
  const lines = frame.split("\n");
  const from = lines.findIndex((l) => l.includes("Active ("));
  const to = lines.findIndex((l, i) => i > from && l.includes("Parked ("));
  return lines.slice(from + 1, to).map((l) => l.replace(/^[>\s]*[▾▸]?\s*/, "").trim()).filter(Boolean);
}

// The three changes of the spec's sort example.
const at = (iso: string) => Date.parse(iso);
const sortable = () => snapshot({
  active: [
    change("add-search", "active", { createdAt: "2026-08-10", modifiedAt: at("2026-08-12T09:00:00Z") }),
    change("mid-tier", "active", { createdAt: "2026-08-12", modifiedAt: at("2026-08-11T17:00:00Z") }),
    change("zebra-fix", "active", { createdAt: null, modifiedAt: at("2026-08-13T08:00:00Z") }),
  ],
});

// The three changes of the spec's filter-text/author combination table.
const authored = () => snapshot({
  active: [
    change("add-dark-mode", "active", { proposer: "alice" }),
    change("add-light-mode", "active", { proposer: "bob" }),
    change("fix-login", "active", { proposer: "alice" }),
  ],
});

describe("change node text", () => {
  it.each([
    ["fripig", { complete: 3, total: 8 }, "add-dark-mode fripig (3/8)"],
    ["fripig", null, "add-dark-mode fripig"],
    [null, { complete: 3, total: 8 }, "add-dark-mode (3/8)"],
    [null, null, "add-dark-mode"],
  ])("proposer %j with progress %j renders %j", async (proposer, progress, expected) => {
    const h = await mount({ snap: snapshot({ active: [change("add-dark-mode", "active", { proposer, progress })] }) });
    expect(underActive(h.frame())).toEqual([expected]);
  });

  it("shows the proposer on an archived change too", async () => {
    const h = await mount({ snap: snapshot({ archived: [change("old-thing", "archived", { proposer: "alice" })] }) });
    await h.press("j"); await h.press("j"); await h.press("l");
    expect(h.frame()).toContain("old-thing alice");
  });
});

describe("sort mode", () => {
  it("orders by modification date, most recent first, when the pane starts", async () => {
    const h = await mount({ snap: sortable() });
    expect(h.frame()).toContain("sort: modified");
    expect(underActive(h.frame())).toEqual(["zebra-fix", "add-search", "mid-tier"]);
  });

  it("cycles modified to name to created with s and never rescans", async () => {
    const h = await mount({ snap: sortable() });
    await h.press("s");
    expect(h.frame()).toContain("sort: name");
    expect(underActive(h.frame())).toEqual(["add-search", "mid-tier", "zebra-fix"]);
    await h.press("s");
    expect(h.frame()).toContain("sort: created");
    expect(underActive(h.frame())).toEqual(["mid-tier", "add-search", "zebra-fix"]);
    await h.press("s");
    expect(h.frame()).toContain("sort: modified");
    expect(h.scan).toHaveBeenCalledTimes(1);
  });

  it("keeps the cursor and the expansion state across a sort change", async () => {
    const h = await mount({ snap: sortable() });
    await h.press("j"); await h.press("l");
    expect(h.frame()).toContain("design.md");
    await h.press("s");
    expect(h.frame()).toMatch(/> .*zebra-fix/);
    expect(h.frame()).toContain("design.md");
  });
});

describe("filter mode", () => {
  const filterable = () => snapshot({
    active: [change("add-search", "active"), change("mid-tier", "active"), change("zebra-fix", "active")],
    parked: [change("search-cache", "parked")],
  });

  it("narrows every group and shows the text in the header", async () => {
    const h = await mount({ snap: filterable() });
    await h.press("/"); await type(h, "search"); await h.press(ENTER);
    const f = h.frame();
    expect(f).toContain("sort: modified  filter: search");
    expect(f).toContain("Active (1/3)");
    expect(f).toContain("Parked (1/1)");
    expect(f).toContain("Archived (0/0)");
    expect(underActive(f)).toEqual(["add-search"]);
    await h.press("j"); await h.press("j"); await h.press("l");
    expect(h.frame()).toContain("search-cache");
  });

  it("matches case-insensitively", async () => {
    const h = await mount({ snap: filterable() });
    await h.press("/"); await type(h, "SEARCH"); await h.press(ENTER);
    expect(underActive(h.frame())).toEqual(["add-search"]);
  });

  it("keeps every artifact of a matching change", async () => {
    const h = await mount({ snap: filterable() });
    await h.press("/"); await type(h, "search"); await h.press(ENTER);
    await h.press("j"); await h.press("l");
    const f = h.frame();
    expect(f).toContain("design.md");
    expect(f).toContain("proposal.md");
    expect(f).toContain("tasks.md");
  });

  it("empties every group when nothing matches", async () => {
    const h = await mount({ snap: filterable() });
    await h.press("/"); await type(h, "zzz"); await h.press(ENTER);
    const f = h.frame();
    expect(f).toContain("Active (0/3)");
    expect(f).toContain("Parked (0/1)");
    expect(underActive(f)).toEqual([]);
    expect(f).toMatch(/> .*Active \(0\/3\)/);
  });

  it("shows the input line while typing and re-filters on each keystroke", async () => {
    const h = await mount({ snap: filterable() });
    await h.press("/");
    expect(h.frame()).toContain("/ ▌");
    await type(h, "sea");
    expect(h.frame()).toContain("/ sea▌");
    expect(underActive(h.frame())).toEqual(["add-search"]);
  });

  it("deletes the last character on Backspace", async () => {
    const h = await mount({ snap: filterable() });
    await h.press("/"); await type(h, "sea"); await h.press(BACKSPACE);
    expect(h.frame()).toContain("/ se▌");
  });

  it("clears the text and returns to the tree on Escape", async () => {
    const h = await mount({ snap: filterable() });
    await h.press("/"); await type(h, "search"); await h.press(ESC);
    const f = h.frame();
    expect(f).toContain("sort: modified");
    expect(f).not.toContain("filter:");
    expect(f).toContain("Active (3)");
    expect(h.onExit).not.toHaveBeenCalled();
  });

  it("treats q as a character rather than as quit", async () => {
    const h = await mount({ snap: filterable() });
    await h.press("/"); await h.press("q");
    expect(h.onExit).not.toHaveBeenCalled();
    expect(h.frame()).toContain("/ q▌");
  });
});

describe("author picker", () => {
  it("narrows to one author and names them in the header", async () => {
    const h = await mount({ snap: authored() });
    await h.press("@");
    expect(h.frame()).toContain("[ ] alice");
    expect(h.frame()).toContain("[ ] bob");
    await h.press(SPACE);
    expect(h.frame()).toContain("[x] alice");
    await h.press(ENTER);
    const f = h.frame();
    expect(f).toContain("authors: alice");
    expect(underActive(f)).toEqual(["add-dark-mode alice", "fix-login alice"]);
    expect(f).toContain("Active (2/3)");
  });

  it("offers the unknown-proposer candidate last and filters by it", async () => {
    const h = await mount({
      snap: snapshot({ active: [change("add-dark-mode", "active", { proposer: "alice" }), change("legacy-change", "active")] }),
    });
    await h.press("@");
    await h.press("j");
    await h.press(SPACE); await h.press(ENTER);
    expect(h.frame()).toContain("authors: Unknown");
    expect(underActive(h.frame())).toEqual(["legacy-change"]);
  });

  it("combines the author selection with the filter text", async () => {
    const h = await mount({ snap: authored() });
    await h.press("/"); await type(h, "add"); await h.press(ENTER);
    await h.press("@"); await h.press(SPACE); await h.press(ENTER);
    const f = h.frame();
    expect(f).toContain("filter: add");
    expect(f).toContain("authors: alice");
    expect(underActive(f)).toEqual(["add-dark-mode alice"]);
  });

  it("refuses to open with fewer than two candidates", async () => {
    const h = await mount({
      snap: snapshot({ active: [change("a-one", "active", { proposer: "alice" }), change("a-two", "active", { proposer: "alice" })] }),
    });
    await h.press("@");
    const f = h.frame();
    expect(f).toContain(NO_AUTHORS);
    expect(f).toContain("Active (2)");
    expect(f).not.toContain("[ ] alice");
  });

  it("keeps the selection and returns to the tree on Escape", async () => {
    const h = await mount({ snap: authored() });
    await h.press("@"); await h.press(SPACE); await h.press(ESC);
    expect(h.onExit).not.toHaveBeenCalled();
    expect(h.frame()).toContain("authors: alice");
  });
});

describe("copy the change name", () => {
  const named = () => snapshot({
    active: [change("sort-and-filter-changes", "active", { proposer: "fripig", progress: { complete: 3, total: 7 } })],
    parked: [change("add-search", "parked")],
  });

  it("copies the name alone from a change node", async () => {
    const h = await mount({ snap: named() });
    await h.press("j"); await h.press("y");
    expect(h.copy).toHaveBeenCalledWith("sort-and-filter-changes");
    expect(h.frame()).toContain("Copied: sort-and-filter-changes");
    expect(h.scan).toHaveBeenCalledTimes(1);
  });

  it("copies the owning change from an artifact node", async () => {
    const h = await mount({ snap: named() });
    await h.press("j"); await h.press("j"); await h.press("l"); await h.press("j");
    expect(h.frame()).toMatch(/> .*add-search/);
    await h.press("l"); await h.press("j");
    expect(h.frame()).toMatch(/> .*design\.md/);
    await h.press("y");
    expect(h.copy).toHaveBeenCalledWith("add-search");
  });

  it("reports a clipboard failure", async () => {
    const h = await mount({ snap: named(), copyOk: false });
    await h.press("j"); await h.press("y");
    expect(h.frame()).toContain("Copy failed: sort-and-filter-changes");
  });

  it("is inert on a group node", async () => {
    const h = await mount({ snap: named() });
    await h.press("y");
    expect(h.copy).not.toHaveBeenCalled();
    expect(h.frame()).toContain(SELECT_CHANGE_FIRST);
  });
});

describe("rescan keeps the view settings", () => {
  it("preserves the sort mode and the filter text", async () => {
    const second = snapshot({
      active: [change("zebra-search", "active"), change("add-search", "active"), change("mid-tier", "active")],
    });
    let n = 0;
    const h = await mount({ scan: async () => (n++ === 0 ? sortable() : second) });
    await h.press("s");
    await h.press("/"); await type(h, "search"); await h.press(ENTER);
    await h.press("R");
    const f = h.frame();
    expect(f).toContain("sort: name  filter: search");
    expect(underActive(f)).toEqual(["add-search", "zebra-search"]);
    expect(f).toContain("Active (2/3)");
  });

  it("keeps the authors still present and drops the ones that are gone", async () => {
    const second = snapshot({ active: [change("add-dark-mode", "active", { proposer: "alice" })] });
    let n = 0;
    const h = await mount({ scan: async () => (n++ === 0 ? authored() : second) });
    await h.press("@");
    await h.press(SPACE); await h.press("j"); await h.press(SPACE); await h.press(ENTER);
    expect(h.frame()).toContain("authors: alice, bob");
    await h.press("R");
    const f = h.frame();
    expect(f).toContain("authors: alice");
    expect(f).not.toContain("bob");
    expect(underActive(f)).toEqual(["add-dark-mode alice"]);
  });
});

describe("keys arriving faster than a render", () => {
  const filterable = () => snapshot({
    active: [change("add-search", "active"), change("mid-tier", "active")],
    parked: [change("search-cache", "parked")],
  });

  it("types into the filter line instead of running the command key that follows /", async () => {
    const h = await mount({ snap: filterable() });
    await h.pressFast("/", "c");
    expect(h.sendText).not.toHaveBeenCalled();
    expect(h.copy).not.toHaveBeenCalled();
    expect(h.frame()).toContain("/ c▌");
  });

  it("does not quit when q follows / straight away", async () => {
    const h = await mount({ snap: filterable() });
    await h.pressFast("/", "q");
    expect(h.onExit).not.toHaveBeenCalled();
    expect(h.frame()).toContain("/ q▌");
  });

  it("leaves filter mode and moves the cursor when j follows Escape straight away", async () => {
    const h = await mount({ snap: filterable() });
    await h.press("/");
    await h.pressFast(ESC, "j");
    expect(h.frame()).toContain("sort: modified");
    expect(h.frame()).toMatch(/> .*add-search/);
  });

  it("counts every s in a burst", async () => {
    const h = await mount({ snap: filterable() });
    await h.pressFast("s", "s");
    expect(h.frame()).toContain("sort: created");
  });
});
