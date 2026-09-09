import { describe, it, expect } from "vitest";
import { SORT_MODES, compareChanges, nextSortMode, type SortMode } from "../../src/tui/change-order.js";
import type { SpectraChange } from "../../src/discovery/types.js";

function change(name: string, createdAt: string | null, modifiedAt: number | null): SpectraChange {
  return {
    name, group: "active", directory: `/repo/changes/${name}`, artifacts: [],
    progress: null, status: "draft", createdAt, modifiedAt, proposer: null,
  };
}

// The three changes of the spec's example, in scan order.
const at = (iso: string) => Date.parse(iso);
const EXAMPLE = [
  change("add-search", "2026-08-10", at("2026-08-12T09:00:00Z")),
  change("mid-tier", "2026-08-12", at("2026-08-11T17:00:00Z")),
  change("zebra-fix", null, at("2026-08-13T08:00:00Z")),
];

const order = (mode: SortMode, changes = EXAMPLE) => [...changes].sort(compareChanges(mode)).map((c) => c.name);

describe("compareChanges", () => {
  it.each([
    ["name", ["add-search", "mid-tier", "zebra-fix"]],
    ["modified", ["zebra-fix", "add-search", "mid-tier"]],
    ["created", ["mid-tier", "add-search", "zebra-fix"]],
  ] as const)("%s orders the three example changes as %j", (mode, expected) => {
    expect(order(mode)).toEqual(expected);
  });

  it.each([
    ["created", [change("known", "2026-08-01", null), change("absent", null, null)], ["known", "absent"]],
    ["modified", [change("known", null, at("2026-08-01T00:00:00Z")), change("absent", null, null)], ["known", "absent"]],
  ] as const)("%s puts a change without a date last", (mode, changes, expected) => {
    expect(order(mode, [...changes])).toEqual(expected);
    expect(order(mode, [...changes].reverse())).toEqual(expected);
  });

  it.each([
    ["created", [change("beta", "2026-08-01", null), change("alpha", "2026-08-01", null)]],
    ["modified", [change("beta", null, at("2026-08-01T00:00:00Z")), change("alpha", null, at("2026-08-01T00:00:00Z"))]],
  ] as const)("%s breaks a tie by name ascending", (mode, changes) => {
    expect(order(mode, [...changes])).toEqual(["alpha", "beta"]);
  });

  it("leaves unknown dates ordered by name", () => {
    expect(order("created", [change("beta", null, null), change("alpha", null, null)])).toEqual(["alpha", "beta"]);
  });
});

describe("nextSortMode", () => {
  it("cycles modified → name → created → modified", () => {
    expect(SORT_MODES).toEqual(["modified", "name", "created"]);
    expect(nextSortMode("modified")).toBe("name");
    expect(nextSortMode("name")).toBe("created");
    expect(nextSortMode("created")).toBe("modified");
  });
});
