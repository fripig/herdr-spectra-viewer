import { describe, it, expect } from "vitest";
import React from "react";
import { Box } from "ink";
import { render } from "ink-testing-library";
import { CommandMenu } from "../../src/tui/CommandMenu.js";
import { MENU_HEIGHT, MENU_WIDTH, menuContains, menuGeometry, menuItemAt } from "../../src/tui/command-menu.js";
import { MENU_ITEMS } from "../../src/tui/keymap.js";

describe("menu size", () => {
  it("is the widest item plus a border, by as many rows as there are items plus a border", () => {
    // `d discuss` and `r archive` are the widest of the five items.
    expect(MENU_WIDTH).toBe(11);
    expect(MENU_HEIGHT).toBe(7);
  });
});

describe("menuGeometry", () => {
  // Spec example: menu position by anchor and pane size.
  const cases: Array<[number, number, number, number, number, number]> = [
    [80, 24, 5, 4, 4, 3],
    [80, 24, 75, 4, 69, 3],
    [80, 24, 5, 22, 4, 17],
    [80, 24, 78, 23, 69, 17],
    [8, 5, 3, 3, 0, 0],
  ];

  it.each(cases)(
    "pane %ix%i, right press at (%i, %i) -> left %i, top %i",
    (width, height, col, row, left, top) => {
      expect(menuGeometry({ col, row }, { width, height })).toEqual({ left, top, width: MENU_WIDTH, height: MENU_HEIGHT });
    },
  );
});

describe("menu hit-testing", () => {
  // Spec example: what a press does while the menu is open. This menu's item
  // cells are terminal columns 6 through 14 and terminal rows 5 through 9.
  const rect = { left: 4, top: 3, width: MENU_WIDTH, height: MENU_HEIGHT };

  const cases: Array<[number, number, string]> = [
    [8, 5, "d discuss"],
    [8, 9, "c commit"],
    [5, 5, "border"],
    [8, 4, "border"],
    [8, 11, "outside"],
    [20, 6, "outside"],
  ];

  it.each(cases)("a press at (%i, %i) is %s", (col, row, expected) => {
    const item = menuItemAt(rect, col, row);
    const outcome = item !== null ? MENU_ITEMS[item] : menuContains(rect, col, row) ? "border" : "outside";
    expect(outcome).toBe(expected);
  });
});

describe("CommandMenu", () => {
  it("draws every item at one width, inside a border, offset by the rect", () => {
    const rect = { left: 4, top: 2, width: MENU_WIDTH, height: MENU_HEIGHT };
    // The menu is out of flow, so it needs the sized pane box App gives it.
    const { lastFrame } = render(
      React.createElement(
        Box,
        { flexDirection: "column" as const, height: rect.top + MENU_HEIGHT, width: 40 },
        React.createElement(CommandMenu, { items: MENU_ITEMS, cursorIndex: 0, rect }),
      ),
    );
    const frame = lastFrame() ?? "";
    for (const item of MENU_ITEMS) expect(frame).toContain(item);
    // The item rows sit between the two border rows; each is the same width.
    const boxed = frame.split("\n").filter((line) => line.includes("\u2502"));
    expect(boxed).toHaveLength(MENU_ITEMS.length);
    const widths = new Set(boxed.map((line) => line.trimEnd().length));
    expect(widths.size).toBe(1);
    // Two border rows above and below the items, offset down by the rect's top.
    expect(frame.split("\n").length).toBe(rect.top + MENU_HEIGHT);
  });
});
