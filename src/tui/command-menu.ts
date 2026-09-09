// Geometry and hit-testing for the floating Spectra command menu. Pure
// functions only; no Ink access here, so every cell boundary can be checked
// without rendering a frame.

import { MENU_ITEMS } from "./keymap.js";

/** The frame the menu draws on all four sides, one cell thick. */
const BORDER = 1;

/**
 * Every item is padded to this width. The menu is drawn over the tree rather
 * than in place of it, and an absolutely positioned box only covers the cells
 * it actually paints, so a short item would let the row beneath show through.
 */
export const MENU_CONTENT_WIDTH = Math.max(...MENU_ITEMS.map((item) => item.length));

export const MENU_WIDTH = MENU_CONTENT_WIDTH + 2 * BORDER;
export const MENU_HEIGHT = MENU_ITEMS.length + 2 * BORDER;

/** The menu's box, counted from the pane's own top-left corner, zero-based. */
export interface MenuRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Where the menu sits for a right press at a 1-based terminal cell. The anchor
 * is that cell, and the box is pulled back towards the pane's origin by however
 * much of it would fall off the right or bottom edge, so the whole menu stays
 * inside the pane. A pane smaller than the menu leaves it at the corner and
 * lets the terminal clip what does not fit; the keyboard still reaches every
 * item.
 */
export function menuGeometry(
  anchor: { col: number; row: number },
  pane: { width: number; height: number },
): MenuRect {
  return {
    left: Math.max(0, Math.min(anchor.col - 1, pane.width - MENU_WIDTH)),
    top: Math.max(0, Math.min(anchor.row - 1, pane.height - MENU_HEIGHT)),
    width: MENU_WIDTH,
    height: MENU_HEIGHT,
  };
}

/** True when a 1-based terminal cell falls anywhere on the menu, border included. */
export function menuContains(rect: MenuRect, col: number, row: number): boolean {
  const x = col - 1;
  const y = row - 1;
  return x >= rect.left && x < rect.left + rect.width && y >= rect.top && y < rect.top + rect.height;
}

/**
 * The item under a 1-based terminal cell, or null when the cell is on the
 * border or outside the menu altogether. The two cases are told apart by
 * `menuContains`: a press on the border leaves the menu alone, a press outside
 * it closes it.
 */
export function menuItemAt(rect: MenuRect, col: number, row: number): number | null {
  if (!menuContains(rect, col, row)) return null;
  const x = col - 1;
  if (x < rect.left + BORDER || x >= rect.left + rect.width - BORDER) return null;
  const index = row - 1 - rect.top - BORDER;
  return index >= 0 && index < MENU_ITEMS.length ? index : null;
}
