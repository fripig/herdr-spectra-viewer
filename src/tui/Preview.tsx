import React from "react";
import { Box, Text } from "ink";

export interface PreviewContent {
  title: string;
  body: string;
}

export function Preview({ content, height }: { content: PreviewContent | null; height: number }) {
  if (!content) {
    return (
      <Box flexDirection="column">
        <Text dimColor>Preview</Text>
        <Text dimColor>Press Enter on an artifact to preview it here.</Text>
      </Box>
    );
  }
  const lines = content.body.split(/\r?\n/).slice(0, Math.max(1, height - 1));
  return (
    <Box flexDirection="column">
      <Text bold underline>{content.title}</Text>
      {lines.map((line, i) => (
        <Text key={i} wrap="truncate-end">{line.length === 0 ? " " : line}</Text>
      ))}
    </Box>
  );
}
