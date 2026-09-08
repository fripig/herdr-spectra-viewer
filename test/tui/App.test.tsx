import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "ink-testing-library";
import { App, NOT_INITIALISED, SCANNING, SELECT_CHANGE_FIRST, type AppDeps } from "../../src/tui/App.js";
import type { ScanSnapshot, SpectraChange } from "../../src/discovery/types.js";
import { fakeClient } from "../herdr/fake-client.js";

const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const ESC = "";
const UP = `${ESC}[A`;
const DOWN = `${ESC}[B`;
const LEFT = `${ESC}[D`;
const RIGHT = `${ESC}[C`;
const ENTER = "\r";

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
  hasOpenspec?: boolean;
  height?: number;
  scan?: AppDeps["scan"];
  sendOk?: boolean;
  copyOk?: boolean;
  editorOk?: boolean;
  editor?: string;
}

interface Harness {
  deps: AppDeps;
  frame: () => string;
  press: (s: string) => Promise<void>;
  files: Map<string, string>;
  client: ReturnType<typeof fakeClient>;
  sendText: ReturnType<typeof vi.fn>;
  copy: ReturnType<typeof vi.fn>;
  openEditor: ReturnType<typeof vi.fn>;
  onExit: ReturnType<typeof vi.fn>;
  scan: ReturnType<typeof vi.fn>;
}

async function mount(opts: MountOpts = {}): Promise<Harness> {
  const files = new Map<string, string>();
  const client = fakeClient();
  const scan = vi.fn(opts.scan ?? (async () => opts.snap ?? snapshot()));
  const sendText = vi.fn(async () => (opts.sendOk === false ? { ok: false as const, reason: "x" } : { ok: true as const }));
  const copy = vi.fn(async () => (opts.copyOk === false ? { ok: false as const, reason: "x" } : { ok: true as const }));
  const openEditor = vi.fn(async () => (opts.editorOk === false ? { ok: false as const, reason: "x" } : { ok: true as const }));
  const onExit = vi.fn();
  const deps: AppDeps = {
    projectRoot: "/repo",
    context: { projectRoot: "/repo", projectRootFromContext: true, paneId: opts.paneId === undefined ? "p1" : opts.paneId, herdrBin: "/x/herdr" },
    client, editor: opts.editor ?? "nvim", scan,
    hasOpenspec: async () => opts.hasOpenspec ?? true,
    readArtifact: async (p) => { const c = files.get(p); if (c === undefined) throw new Error("ENOENT"); return c; },
    sendText, openEditor, copy, onExit, height: opts.height ?? 20,
  };
  const r = render(<App {...deps} />);
  await tick();
  return {
    deps, files, client, sendText, copy, openEditor, onExit, scan,
    frame: () => r.lastFrame() ?? "",
    press: async (s) => { r.stdin.write(s); await tick(); },
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

describe("preview", () => {
  it("shows an artifact's text with its relative path as title", async () => {
    const h = await mount({ snap: three() });
    h.files.set("/repo/changes/add-search/design.md", "# Design\nhello");
    await h.press("j"); await h.press("l"); await h.press("j");
    expect(h.frame()).toMatch(/> .*design\.md/);
    await h.press(ENTER);
    expect(h.frame()).toContain("# Design");
    expect(h.frame()).toContain("hello");
  });

  it("Enter on a change toggles expansion and leaves the preview alone", async () => {
    const h = await mount({ snap: three() });
    await h.press("j"); await h.press(ENTER);
    expect(h.frame()).toContain("design.md");
    expect(h.frame()).toContain("Press Enter on an artifact");
  });

  it("reports a deleted artifact without changing the tree", async () => {
    const h = await mount({ snap: three() });
    await h.press("j"); await h.press("l"); await h.press("j");
    await h.press(ENTER);
    expect(h.frame()).toContain("File not found: design.md");
    expect(h.frame()).toMatch(/> .*design\.md/);
  });
});

describe("open in editor", () => {
  async function onArtifact(opts: MountOpts = {}) {
    const h = await mount({ snap: three(), ...opts });
    h.files.set("/repo/changes/add-search/proposal.md", "p");
    await h.press("j"); await h.press("l"); await h.press("j"); await h.press("j");
    expect(h.frame()).toMatch(/> .*proposal\.md/);
    return h;
  }

  it("asks the adapter to open the file with the editor", async () => {
    const h = await onArtifact();
    await h.press("e");
    expect(h.openEditor).toHaveBeenCalledWith(h.client, {
      projectRoot: "/repo", paneId: "p1", editor: "nvim", filePath: "/repo/changes/add-search/proposal.md",
    });
    expect(h.frame()).toContain("Opened in nvim");
  });

  it("uses the configured fallback editor name", async () => {
    const h = await onArtifact({ editor: "vi" });
    await h.press("e");
    expect(h.openEditor.mock.calls[0][1]).toMatchObject({ editor: "vi" });
  });

  it("reports adapter failure", async () => {
    const h = await onArtifact({ editorOk: false });
    await h.press("e");
    expect(h.frame()).toContain("Could not open editor");
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
  ])("key %s sends %s to the invoking pane and exits", async (key, text) => {
    const h = await mount({ snap: three() });
    await h.press("j");
    await h.press(key);
    expect(h.sendText).toHaveBeenCalledWith(h.client, "p1", text);
    expect(h.onExit).toHaveBeenCalledWith(0);
    expect(h.scan).toHaveBeenCalledTimes(1);
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
    expect(h.copy).toHaveBeenCalledWith("/spectra-commit add-search");
    expect(h.onExit).not.toHaveBeenCalled();
    expect(h.frame()).toContain("Copied: /spectra-commit add-search");
  });

  it("copies when sending fails", async () => {
    const h = await mount({ snap: three(), sendOk: false });
    await h.press("j"); await h.press("d");
    expect(h.copy).toHaveBeenCalledWith("/spectra-discuss add-search");
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
