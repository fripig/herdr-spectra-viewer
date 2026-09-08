import type { ChangeGroup, ScanSnapshot, SpectraChange } from "../discovery/types.js";

export type RowKind = "group" | "change" | "artifact";

export interface Row {
  key: string;
  kind: RowKind;
  depth: number;
  label: string;
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

export const groupKey = (g: ChangeGroup): string => `g:${g}`;
export const changeKey = (c: SpectraChange): string => `c:${c.group}/${c.name}`;
export const artifactKey = (c: SpectraChange, rel: string): string => `a:${c.group}/${c.name}/${rel}`;

export function changeLabel(c: SpectraChange): string {
  return c.progress ? `${c.name} (${c.progress.complete}/${c.progress.total})` : c.name;
}

export function buildRows(snapshot: ScanSnapshot, expanded: ReadonlySet<string>): Row[] {
  const rows: Row[] = [];
  for (const g of GROUPS) {
    const changes = snapshot[g.id];
    const gk = groupKey(g.id);
    const gExpanded = expanded.has(gk);
    rows.push({
      key: gk, kind: "group", depth: 0, label: `${g.label} (${changes.length})`, group: g.id,
      change: null, artifact: null, parentKey: null, expandable: changes.length > 0, expanded: gExpanded,
    });
    if (!gExpanded) continue;
    for (const c of changes) {
      const ck = changeKey(c);
      const cExpanded = expanded.has(ck);
      rows.push({
        key: ck, kind: "change", depth: 1, label: changeLabel(c), group: g.id,
        change: c, artifact: null, parentKey: gk, expandable: c.artifacts.length > 0, expanded: cExpanded,
      });
      if (!cExpanded) continue;
      for (const rel of c.artifacts) {
        rows.push({
          key: artifactKey(c, rel), kind: "artifact", depth: 2, label: rel, group: g.id,
          change: c, artifact: rel, parentKey: ck, expandable: false, expanded: false,
        });
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
