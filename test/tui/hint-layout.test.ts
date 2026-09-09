import { describe, it, expect } from "vitest";
import { packHints, statusBarLines } from "../../src/tui/hint-layout.js";

const THREE = ["a one", "b two", "c three"];

describe("packHints", () => {
  // The spec's Example: hints packed by width, one case per row.
  it.each([
    [20, THREE, ["a one  b two", "c three"]],
    [40, THREE, ["a one  b two  c three"]],
    [6, THREE, ["a one", "b two", "c three"]],
    [4, ["a one", "verylonghint", "b two"], ["a one", "verylonghint", "b two"]],
  ])("width %i packs %j into %j", (width, hints, expected) => {
    expect(packHints(hints, width)).toEqual(expected);
  });

  it("keeps every hint whatever the width", () => {
    for (const width of [0, 1, 5, 12, 200]) {
      expect(packHints(THREE, width).join(" ").split(/\s+/).length).toBeGreaterThanOrEqual(THREE.length);
    }
  });

  it("gives each hint its own line at width 0 or below instead of looping forever", () => {
    expect(packHints(THREE, 0)).toEqual(THREE);
    expect(packHints(THREE, -1)).toEqual(THREE);
  });

  it("returns no lines for no hints", () => {
    expect(packHints([], 20)).toEqual([]);
  });
});

describe("statusBarLines", () => {
  const opts = { hints: THREE, commands: ["send to pane:", "d discuss"], width: 40, modal: null };

  it("lists the key hints then the command keys", () => {
    expect(statusBarLines(opts)).toEqual(["a one  b two  c three", "send to pane:  d discuss"]);
  });

  it("wraps both groups when the pane is narrow", () => {
    expect(statusBarLines({ ...opts, width: 12 })).toEqual(["a one  b two", "c three", "send to pane:", "d discuss"]);
  });

  it("replaces both groups with the modal line", () => {
    expect(statusBarLines({ ...opts, modal: ["Esc clear"] })).toEqual(["Esc clear", ""]);
  });

  it("pads the modal line so the tree does not shift when a modal opens", () => {
    const tree = statusBarLines({ ...opts, width: 12 });
    const modal = statusBarLines({ ...opts, width: 12, modal: ["Esc clear"] });
    expect(modal).toHaveLength(tree.length);
    expect(modal[0]).toBe("Esc clear");
  });

  it("keeps every modal line when the modal needs more rows than the key hints", () => {
    const long = ["a".repeat(30), "b".repeat(30), "c".repeat(30)];
    expect(statusBarLines({ ...opts, modal: long })).toEqual(long);
  });
});
