import React from "react";
import { Text } from "ink";

export const FILTER_CURSOR = "▌";

export interface FilterLineProps {
  text: string;
}

/** The header row while filter mode owns the keyboard, so the typing is visible. */
export function FilterLine({ text }: FilterLineProps) {
  return (
    <Text wrap="truncate-end">/ {text}{FILTER_CURSOR}</Text>
  );
}
