import React from "react";
import { Box, Text } from "ink";
import { COMMAND_KEYS, VIEW_HINTS } from "./keymap.js";

export interface StatusBarProps {
  message: string | null;
  skipped: number;
  /** Replaces the two key lines while a modal input line owns the keyboard. */
  modalHints?: string | null;
}

export function StatusBar({ message, skipped, modalHints }: StatusBarProps) {
  const commands = COMMAND_KEYS.map((c) => `${c.key} ${c.label}`).join("  ");
  return (
    <Box flexDirection="column">
      {modalHints ? (
        <>
          <Text dimColor wrap="truncate-end">{modalHints}</Text>
          <Text> </Text>
        </>
      ) : (
        <>
          <Text dimColor wrap="truncate-end">{VIEW_HINTS.join("  ")}</Text>
          <Text dimColor wrap="truncate-end">send to pane: {commands}</Text>
        </>
      )}
      <Text wrap="truncate-end">
        {message ?? ""}
        {skipped > 0 ? (message ? "  " : "") + `${skipped} change(s) skipped` : ""}
      </Text>
    </Box>
  );
}
