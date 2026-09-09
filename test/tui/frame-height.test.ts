import { describe, it, expect, vi } from "vitest";
import { frameHeight, frameWidth, startupGeometry, startupSize } from "../../src/pane.js";
import { fakeClient } from "../herdr/fake-client.js";

describe("frameHeight", () => {
  it("renders one row fewer than the terminal so Ink never scrolls the frame", () => {
    expect(frameHeight(48)).toBe(47);
  });
  it("falls back to 23 when rows are unknown and never goes below 8", () => {
    expect(frameHeight(undefined)).toBe(23);
    expect(frameHeight(0)).toBe(23);
    expect(frameHeight(5)).toBe(8);
  });
});

describe("frameWidth", () => {
  it("uses the reported width", () => {
    expect(frameWidth(39)).toBe(39);
  });
  it("falls back to 80 when the width is unknown or not positive", () => {
    expect(frameWidth(undefined)).toBe(80);
    expect(frameWidth(0)).toBe(80);
  });
});

describe("startupGeometry", () => {
  const layout = JSON.stringify({ result: { layout: { panes: [{ pane_id: "p7", rect: { width: 39, height: 48 } }] } } });
  const info = JSON.stringify({ result: { pane: { scroll: { viewport_rows: 46 } } } });

  it("asks Herdr about the pane it runs in", async () => {
    const c = fakeClient([{ stdout: layout }, { stdout: info }]);
    expect(await startupGeometry(c, "p7")).toEqual({ columns: 39, rows: 46 });
  });

  it("makes no Herdr call at all without a pane id", async () => {
    const c = fakeClient();
    expect(await startupGeometry(c, null)).toBeNull();
    expect(c.calls).toEqual([]);
  });

  it("writes nothing to stderr when the lookup fails", async () => {
    const write = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    try {
      const c = fakeClient([{ exitCode: 2 }, { exitCode: 2 }]);
      expect(await startupGeometry(c, "p7")).toBeNull();
      expect(write).not.toHaveBeenCalled();
    } finally {
      write.mockRestore();
    }
  });
});

describe("startupSize", () => {
  it("draws the first frame at the size Herdr reports, not the stale pty size", () => {
    expect(startupSize({ columns: 39, rows: 46 }, { columns: 78, rows: 48 })).toEqual({ width: 39, height: 45 });
  });

  it("falls back to the pty size when Herdr gave no answer", () => {
    expect(startupSize(null, { columns: 78, rows: 48 })).toEqual({ width: 78, height: 47 });
  });

  it("falls back to Ink's defaults when neither knows", () => {
    expect(startupSize(null, {})).toEqual({ width: 80, height: 23 });
  });
});
