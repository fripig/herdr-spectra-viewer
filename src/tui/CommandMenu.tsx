import React from "react";
import { Box, Text } from "ink";
import { MENU_CONTENT_WIDTH, type MenuRect } from "./command-menu.js";

export interface CommandMenuProps {
  items: readonly string[];
  cursorIndex: number;
  rect: MenuRect;
}

/**
 * Floats over the tree while menu mode owns the keyboard. Ink 5 has no `top`
 * or `left` style, so an absolutely positioned box is placed by its margins;
 * the offsets are counted from the pane's own corner, which is this box's
 * containing block. Items are padded to a common width so the box covers every
 * cell inside its border instead of letting the tree show through.
 */
export function CommandMenu({ items, cursorIndex, rect }: CommandMenuProps) {
  return (
    <Box position="absolute" marginTop={rect.top} marginLeft={rect.left} borderStyle="round" flexDirection="column">
      {items.map((item, i) => (
        <Text key={item} inverse={i === cursorIndex}>{item.padEnd(MENU_CONTENT_WIDTH)}</Text>
      ))}
    </Box>
  );
}
