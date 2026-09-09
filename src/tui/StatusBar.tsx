import React from "react";
import { Box, Text } from "ink";
import { COMMAND_HINTS, VIEW_HINTS } from "./keymap.js";
import { statusBarLines } from "./hint-layout.js";

export interface StatusBarProps {
  message: string | null;
  skipped: number;
  /** The pane width the hint lines are packed against. */
  width: number;
  /** Replaces the key lines while a modal input line owns the keyboard. */
  modalHints?: readonly string[] | null;
}

/** The key-hint lines this bar draws at a given width, message line excluded. */
export function hintLines(width: number, modalHints: readonly string[] | null): string[] {
  return statusBarLines({ hints: VIEW_HINTS, commands: COMMAND_HINTS, modal: modalHints, width });
}

export function StatusBar({ message, skipped, width, modalHints }: StatusBarProps) {
  const lines = hintLines(width, modalHints ?? null);
  return (
    <Box flexDirection="column">
      {lines.map((line, i) => (
        // The index is the identity here: these lines have no other one.
        <Text key={i} dimColor>{line === "" ? " " : line}</Text>
      ))}
      <Text wrap="truncate-end">
        {message ?? ""}
        {skipped > 0 ? (message ? "  " : "") + `${skipped} change(s) skipped` : ""}
      </Text>
    </Box>
  );
}
