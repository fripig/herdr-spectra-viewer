import React from "react";
import { Box, Text } from "ink";
import type { AuthorCandidate } from "./change-filter.js";

export interface AuthorPickerProps {
  candidates: readonly AuthorCandidate[];
  selected: ReadonlySet<string>;
  cursorIndex: number;
  height: number;
}

/** Replaces the tree column while authors mode owns the keyboard. */
export function AuthorPicker({ candidates, selected, cursorIndex, height }: AuthorPickerProps) {
  return (
    <Box flexDirection="column">
      {candidates.slice(0, height).map((c, i) => (
        <Text key={c.id} inverse={i === cursorIndex} wrap="truncate-end">
          {i === cursorIndex ? "> " : "  "}{selected.has(c.id) ? "[x] " : "[ ] "}{c.label}
        </Text>
      ))}
    </Box>
  );
}
