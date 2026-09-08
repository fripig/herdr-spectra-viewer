import { describe, it, expect } from "vitest";
import { frameHeight } from "../../src/pane.js";

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
