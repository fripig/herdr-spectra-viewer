import type { SpectraChange } from "../discovery/types.js";

export type SortMode = "modified" | "name" | "created";

/** Cycle order, starting from the default so `s` walks it in the order the spec lists. */
export const SORT_MODES: readonly SortMode[] = ["modified", "name", "created"];

export function nextSortMode(mode: SortMode): SortMode {
  const i = SORT_MODES.indexOf(mode);
  return SORT_MODES[(i + 1) % SORT_MODES.length];
}

const byName = (a: SpectraChange, b: SpectraChange): number => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

/**
 * Newest first, unknown dates last, name ascending for ties. `null` is not a
 * date that sorts low: it means the change has none, so it goes after every
 * change that does, whichever direction the known dates run in.
 */
function byDateDescending<T extends string | number>(
  dateOf: (c: SpectraChange) => T | null,
): (a: SpectraChange, b: SpectraChange) => number {
  return (a, b) => {
    const x = dateOf(a);
    const y = dateOf(b);
    if (x === null && y === null) return byName(a, b);
    if (x === null) return 1;
    if (y === null) return -1;
    if (x > y) return -1;
    if (x < y) return 1;
    return byName(a, b);
  };
}

export function compareChanges(mode: SortMode): (a: SpectraChange, b: SpectraChange) => number {
  if (mode === "name") return byName;
  if (mode === "created") return byDateDescending((c) => c.createdAt);
  return byDateDescending((c) => c.modifiedAt);
}
