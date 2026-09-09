import type { ChangeGroup, ScanSnapshot, SpectraChange } from "../discovery/types.js";
import type { FilteredSnapshot } from "./change-filter.js";

export type RowKind = "group" | "change" | "artifact";

export interface Row {
  key: string;
  kind: RowKind;
  depth: number;
  /** The whole node text; the parts below are the same string, split for styling. */
  label: string;
  /** Change rows only: the proposer, rendered de-emphasised after the name. */
  proposer: string | null;
  /** Change rows only: `(complete/total)`, rendered de-emphasised and last. */
  progressText: string | null;
  group: ChangeGroup;
  change: SpectraChange | null;
  artifact: string | null;
  parentKey: string | null;
  expandable: boolean;
  expanded: boolean;
}

export const GROUPS: ReadonlyArray<{ id: ChangeGroup; label: string }> = [
  { id: "active", label: "Active" },
  { id: "parked", label: "Parked" },
  { id: "archived", label: "Archived" },
];

export const GROUP_IDS: readonly ChangeGroup[] = GROUPS.map((g) => g.id);

export const groupKey = (g: ChangeGroup): string => `g:${g}`;
export const changeKey = (c: SpectraChange): string => `c:${c.group}/${c.name}`;
export const artifactKey = (c: SpectraChange, rel: string): string => `a:${c.group}/${c.name}/${rel}`;

export function progressText(c: SpectraChange): string | null {
  return c.progress ? `(${c.progress.complete}/${c.progress.total})` : null;
}

/** Name, then the proposer when known, then the counts — so the counts stay last. */
export function changeLabel(c: SpectraChange): string {
  return [c.name, c.proposer, progressText(c)].filter((part) => part !== null).join(" ");
}

/**
 * `Active (2)` when nothing is filtered, `Active (1/3)` when something is, so a
 * group emptied by a filter cannot be read as a group with nothing in it.
 */
export function groupLabel(label: string, matching: number, total: number, filtered: boolean): string {
  return filtered ? `${label} (${matching}/${total})` : `${label} (${matching})`;
}

const row = (r: Omit<Row, "proposer" | "progressText">): Row => ({ ...r, proposer: null, progressText: null });

export function buildRows(snapshot: ScanSnapshot | FilteredSnapshot, expanded: ReadonlySet<string>): Row[] {
  const filtered = "filtered" in snapshot ? snapshot.filtered : false;
  const totals = "totals" in snapshot ? snapshot.totals : null;
  const rows: Row[] = [];
  for (const g of GROUPS) {
    const changes = snapshot[g.id];
    const gk = groupKey(g.id);
    const gExpanded = expanded.has(gk);
    rows.push(row({
      key: gk, kind: "group", depth: 0,
      label: groupLabel(g.label, changes.length, totals ? totals[g.id] : changes.length, filtered),
      group: g.id,
      change: null, artifact: null, parentKey: null, expandable: changes.length > 0, expanded: gExpanded,
    }));
    if (!gExpanded) continue;
    for (const c of changes) {
      const ck = changeKey(c);
      const cExpanded = expanded.has(ck);
      rows.push({
        ...row({
          key: ck, kind: "change", depth: 1, label: changeLabel(c), group: g.id,
          change: c, artifact: null, parentKey: gk, expandable: c.artifacts.length > 0, expanded: cExpanded,
        }),
        proposer: c.proposer,
        progressText: progressText(c),
      });
      if (!cExpanded) continue;
      for (const rel of c.artifacts) {
        rows.push(row({
          key: artifactKey(c, rel), kind: "artifact", depth: 2, label: rel, group: g.id,
          change: c, artifact: rel, parentKey: ck, expandable: false, expanded: false,
        }));
      }
    }
  }
  return rows;
}

/** Group key for any node key, used to recover the cursor after a rescan. */
export function groupOfKey(key: string): string {
  const body = key.slice(2);
  const slash = body.indexOf("/");
  return groupKey((slash >= 0 ? body.slice(0, slash) : body) as ChangeGroup);
}

/** Start index of the rendered window so the cursor row is always inside it. */
export function windowStart(cursorIndex: number, height: number, previousStart: number): number {
  if (height <= 0) return 0;
  if (cursorIndex < previousStart) return cursorIndex;
  if (cursorIndex >= previousStart + height) return cursorIndex - height + 1;
  return previousStart;
}
