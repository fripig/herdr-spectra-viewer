import React from "react";
import { Box, Text } from "ink";
import type { Row } from "./tree-model.js";

export interface ChangeTreeProps {
  rows: Row[];
  cursorIndex: number;
  start: number;
  height: number;
}

function marker(row: Row): string {
  if (!row.expandable && row.kind !== "artifact") return "  ";
  if (row.kind === "artifact") return "  ";
  return row.expanded ? "▾ " : "▸ ";
}

/**
 * A change reads name first, so the proposer and the counts that follow it are
 * de-emphasised rather than competing with the name for attention.
 */
function content(row: Row): React.ReactNode {
  if (row.kind !== "change") return row.label;
  return (
    <>
      {row.change!.name}
      {row.proposer ? <Text dimColor> {row.proposer}</Text> : null}
      {row.progressText ? <Text dimColor> {row.progressText}</Text> : null}
    </>
  );
}

export function ChangeTree({ rows, cursorIndex, start, height }: ChangeTreeProps) {
  const slice = rows.slice(start, start + height);
  return (
    <Box flexDirection="column">
      {slice.map((row, i) => {
        const index = start + i;
        const selected = index === cursorIndex;
        const indent = "  ".repeat(row.depth);
        return (
          <Text key={row.key} inverse={selected} bold={row.kind === "group"}>
            {selected ? "> " : "  "}{indent}{marker(row)}{content(row)}
          </Text>
        );
      })}
    </Box>
  );
}
