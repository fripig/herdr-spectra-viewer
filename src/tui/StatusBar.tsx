import React from "react";
import { Box, Text } from "ink";
import { COMMAND_KEYS } from "./keymap.js";

export interface StatusBarProps {
  message: string | null;
  skipped: number;
}

export function StatusBar({ message, skipped }: StatusBarProps) {
  const commands = COMMAND_KEYS.map((c) => `${c.key} ${c.label}`).join("  ");
  return (
    <Box flexDirection="column">
      <Text dimColor wrap="truncate-end">↑↓/jk move  ←→/hl fold  ⏎/e open  R rescan  q quit</Text>
      <Text dimColor wrap="truncate-end">send to pane: {commands}</Text>
      <Text wrap="truncate-end">
        {message ?? ""}
        {skipped > 0 ? (message ? "  " : "") + `${skipped} change(s) skipped` : ""}
      </Text>
    </Box>
  );
}
