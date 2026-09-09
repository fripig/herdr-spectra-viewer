/** What separates two hints on the same line. */
export const HINT_SEPARATOR = "  ";

/**
 * Packs hints onto as few lines as the width allows, filling each line before
 * starting the next and keeping the declared order. A hint wider than the line
 * gets a line of its own rather than being cut, so no key is ever hidden.
 *
 * Width is counted in characters. Every hint is a code-owned literal from
 * `keymap.ts` whose characters are all one column wide, so this matches what
 * the terminal draws; a hint carrying a double-width character would need a
 * display-width measure instead.
 */
export function packHints(hints: readonly string[], width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const hint of hints) {
    if (line.length === 0) {
      line = hint;
      continue;
    }
    const candidate = line + HINT_SEPARATOR + hint;
    if (candidate.length <= width) line = candidate;
    else {
      lines.push(line);
      line = hint;
    }
  }
  if (line.length > 0) lines.push(line);
  return lines;
}

/**
 * The key-hint lines the status bar draws, message line excluded.
 *
 * A modal input line replaces both key lines but is padded out to the same
 * number of rows, so opening the filter or the author picker does not shift
 * the tree up and down under the cursor.
 */
export function statusBarLines(opts: {
  hints: readonly string[];
  commands: readonly string[];
  modal: readonly string[] | null;
  width: number;
}): string[] {
  const full = [...packHints(opts.hints, opts.width), ...packHints(opts.commands, opts.width)];
  if (opts.modal === null) return full;
  const modal = packHints(opts.modal, opts.width);
  while (modal.length < full.length) modal.push("");
  return modal;
}
