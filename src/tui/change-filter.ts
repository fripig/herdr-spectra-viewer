import type { ChangeGroup, ScanSnapshot, SpectraChange } from "../discovery/types.js";
import { GROUP_IDS } from "./tree-model.js";

/** The candidate id standing in for every change whose proposer is unknown. */
export const UNKNOWN_AUTHOR = "__unknown__";
export const UNKNOWN_LABEL = "Unknown";

export interface AuthorCandidate {
  id: string;
  label: string;
}

export interface FilterState {
  text: string;
  authors: ReadonlySet<string>;
}

export interface FilteredSnapshot extends ScanSnapshot {
  /** Group sizes before filtering, so a group can render `(matching/total)`. */
  totals: Record<ChangeGroup, number>;
  filtered: boolean;
}

export const EMPTY_FILTER: FilterState = { text: "", authors: new Set() };

export function isFiltering(filter: FilterState): boolean {
  return filter.text.length > 0 || filter.authors.size > 0;
}

/** Names only: a proposer that contains the text is not a match. */
export function matchesName(change: SpectraChange, text: string): boolean {
  if (text.length === 0) return true;
  return change.name.toLowerCase().includes(text.toLowerCase());
}

export function matchesAuthors(change: SpectraChange, selected: ReadonlySet<string>): boolean {
  if (selected.size === 0) return true;
  return selected.has(change.proposer ?? UNKNOWN_AUTHOR);
}

/**
 * Distinct proposers across every group, ordered case-insensitively so `alice`,
 * `Bob`, `Carol` read alphabetically, with the unknown candidate last because it
 * is a bucket rather than a name.
 */
export function authorCandidates(snapshot: ScanSnapshot): AuthorCandidate[] {
  const named = new Set<string>();
  let anyUnknown = false;
  for (const group of GROUP_IDS) {
    for (const change of snapshot[group]) {
      if (change.proposer === null) anyUnknown = true;
      else named.add(change.proposer);
    }
  }
  const candidates = [...named]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
    .map((id) => ({ id, label: id }));
  if (anyUnknown) candidates.push({ id: UNKNOWN_AUTHOR, label: UNKNOWN_LABEL });
  return candidates;
}

/** Both predicates as a conjunction, keeping every group and its original size. */
export function filterSnapshot(snapshot: ScanSnapshot, filter: FilterState): FilteredSnapshot {
  const groups = {} as Record<ChangeGroup, SpectraChange[]>;
  const totals = {} as Record<ChangeGroup, number>;
  for (const group of GROUP_IDS) {
    const all = snapshot[group];
    totals[group] = all.length;
    groups[group] = all.filter((c) => matchesName(c, filter.text) && matchesAuthors(c, filter.authors));
  }
  return {
    active: groups.active,
    parked: groups.parked,
    archived: groups.archived,
    warnings: snapshot.warnings,
    totals,
    filtered: isFiltering(filter),
  };
}
