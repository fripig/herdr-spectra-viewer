import { describe, it, expect } from "vitest";
import { mouseLifecycle } from "../../src/pane.js";
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
