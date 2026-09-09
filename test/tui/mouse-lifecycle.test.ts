import { describe, it, expect } from "vitest";
import { mouseLifecycle, viewerLifecycle } from "../../src/pane.js";
import { MOUSE_DISABLE, MOUSE_ENABLE } from "../../src/tui/mouse.js";

describe("mouseLifecycle", () => {
  it("writes the enable sequence on start and the disable sequence once per shutdown call", () => {
    const writes: string[] = [];
    const m = mouseLifecycle((s) => writes.push(s));
    m.start();
    expect(writes).toEqual([MOUSE_ENABLE]);
    m.shutdown();
    expect(writes).toEqual([MOUSE_ENABLE, MOUSE_DISABLE]);
    m.shutdown();
    expect(writes).toEqual([MOUSE_ENABLE, MOUSE_DISABLE, MOUSE_DISABLE]);
  });

  it("writes nothing until start is called", () => {
    const writes: string[] = [];
    mouseLifecycle((s) => writes.push(s));
    expect(writes).toEqual([]);
  });
});

describe("viewerLifecycle", () => {
  it("closes the remembered pane once and forgets it", () => {
    const closed: string[] = [];
    const ref = { current: "p9" as string | null };
    const v = viewerLifecycle((id) => closed.push(id), ref);
    v.shutdown();
    expect(closed).toEqual(["p9"]);
    expect(ref.current).toBeNull();
  });

  it("closes nothing when no viewer pane is remembered", () => {
    const closed: string[] = [];
    viewerLifecycle((id) => closed.push(id), { current: null }).shutdown();
    expect(closed).toEqual([]);
  });

  it("swallows a failing close so the exit path continues", () => {
    const ref = { current: "p9" as string | null };
    const v = viewerLifecycle(() => { throw new Error("herdr is gone"); }, ref);
    expect(() => v.shutdown()).not.toThrow();
    expect(ref.current).toBeNull();
  });

  it("a second shutdown closes nothing", () => {
    const closed: string[] = [];
    const v = viewerLifecycle((id) => closed.push(id), { current: "p9" });
    v.shutdown();
    v.shutdown();
    expect(closed).toEqual(["p9"]);
  });
});
