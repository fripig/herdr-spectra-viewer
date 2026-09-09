import { describe, it, expect } from "vitest";
import {
  MOUSE_DISABLE, MOUSE_ENABLE, hitTest, looksLikeMouse, parseMouse, type Layout, type MouseEvent,
} from "../../src/tui/mouse.js";

const ESC = "";

describe("enable/disable sequences", () => {
  it("enable turns on button reporting then SGR encoding; disable reverses the order", () => {
    expect(MOUSE_ENABLE).toBe(`${ESC}[?1000h${ESC}[?1006h`);
    expect(MOUSE_DISABLE).toBe(`${ESC}[?1006l${ESC}[?1000l`);
  });
});

describe("parseMouse", () => {
  // Reports observed in Herdr 0.9.0 (spec example table).
  const samples: Array<[string, MouseEvent | null]> = [
    [`${ESC}[<0;17;18M`, { kind: "press", button: 0, col: 17, row: 18 }],
    [`${ESC}[<0;17;18m`, { kind: "release", button: 0, col: 17, row: 18 }],
    [`${ESC}[<2;17;18M`, { kind: "right-press", button: 2, col: 17, row: 18 }],
    [`${ESC}[<2;17;18m`, { kind: "release", button: 2, col: 17, row: 18 }],
    [`${ESC}[<64;10;21M`, { kind: "wheel-up", button: 64, col: 10, row: 21 }],
    [`${ESC}[<65;10;21M`, { kind: "wheel-down", button: 65, col: 10, row: 21 }],
    [`${ESC}[<32;9;5M`, null],
    [`${ESC}[<0;17`, null],
  ];

  it.each(samples)("parses %j", (input, expected) => {
    expect(parseMouse(input)).toEqual(expected ? [expected] : []);
  });

  it("accepts the report without its leading ESC, as Ink's useInput delivers it", () => {
    expect(parseMouse("[<0;17;18M")).toEqual([{ kind: "press", button: 0, col: 17, row: 18 }]);
  });

  it("returns every report in a chunk that holds more than one", () => {
    expect(parseMouse(`${ESC}[<64;1;1M${ESC}[<64;1;1M`)).toHaveLength(2);
  });

  it("ignores ordinary keys", () => {
    expect(parseMouse("q")).toEqual([]);
    expect(parseMouse(`${ESC}[A`)).toEqual([]);
    expect(parseMouse("")).toEqual([]);
  });
});

describe("looksLikeMouse", () => {
  it("recognises complete and partial reports, with or without ESC", () => {
    expect(looksLikeMouse(`${ESC}[<0;17;18M`)).toBe(true);
    expect(looksLikeMouse("[<0;17")).toBe(true);
    expect(looksLikeMouse(`${ESC}[A`)).toBe(false);
    expect(looksLikeMouse("q")).toBe(false);
    expect(looksLikeMouse("")).toBe(false);
  });
});

describe("hitTest", () => {
  const layout = (over: Partial<Layout> = {}): Layout => ({
    treeTop: 0, treeHeight: 10, treeLeft: 0, treeWidth: 80, windowStart: 0, rowCount: 30, ...over,
  });
  const press = (col: number, row: number): MouseEvent => ({ kind: "press", button: 0, col, row });

  // Spec example: row mapping.
  const mapping: Array<[number, number, number, number | null]> = [
    [0, 0, 1, 0],
    [0, 0, 3, 2],
    [1, 0, 1, null],
    [1, 5, 3, 6],
  ];
  it.each(mapping)("treeTop %i windowStart %i terminal row %i -> row index %j", (treeTop, windowStart, row, expected) => {
    const hit = hitTest(press(10, row), layout({ treeTop, windowStart }));
    expect(hit ? hit.rowIndex : null).toBe(expected);
  });

  it("returns null below the tree rows (status bar) and past the last node", () => {
    expect(hitTest(press(5, 11), layout({ treeHeight: 10 }))).toBeNull();
    expect(hitTest(press(5, 4), layout({ rowCount: 3 }))).toBeNull();
  });

  it("returns null outside the tree columns", () => {
    expect(hitTest(press(81, 1), layout({ treeWidth: 80 }))).toBeNull();
    expect(hitTest(press(1, 1), layout({ treeLeft: 2 }))).toBeNull();
  });

  // Marker cells are the two cells after "> " plus two cells of indent per depth.
  const marker: Array<[number, number, boolean]> = [
    [0, 3, true], [0, 4, true], [0, 2, false], [0, 5, false],
    [1, 5, true], [1, 6, true], [1, 4, false], [1, 7, false],
    [2, 7, true], [2, 8, true], [2, 6, false], [2, 9, false],
  ];
  it.each(marker)("depth %i, terminal column %i -> onMarker %s", (depth, col, expected) => {
    const hit = hitTest(press(col, 1), layout(), () => depth);
    expect(hit?.onMarker).toBe(expected);
  });

  it("wheel events map to rows the same way", () => {
    const wheel: MouseEvent = { kind: "wheel-down", button: 65, col: 3, row: 2 };
    expect(hitTest(wheel, layout({ windowStart: 4 }))).toEqual({ area: "tree", rowIndex: 5, onMarker: true });
  });
});
