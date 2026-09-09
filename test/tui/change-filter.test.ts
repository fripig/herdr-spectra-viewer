import { describe, it, expect } from "vitest";
import {
  UNKNOWN_AUTHOR, authorCandidates, filterSnapshot, matchesAuthors, matchesName,
} from "../../src/tui/change-filter.js";
import type { ScanSnapshot, SpectraChange } from "../../src/discovery/types.js";

function change(name: string, proposer: string | null = null, group: SpectraChange["group"] = "active"): SpectraChange {
  return {
    name, group, directory: `/repo/changes/${name}`, artifacts: [],
    progress: null, status: "draft", createdAt: null, modifiedAt: null, proposer,
  };
}

function snapshot(partial: Partial<ScanSnapshot> = {}): ScanSnapshot {
  return { active: [], parked: [], archived: [], warnings: [], ...partial };
}

// The three changes of the spec's filter-text/author combination table.
const COMBINATION = snapshot({
  active: [change("add-dark-mode", "alice"), change("add-light-mode", "bob"), change("fix-login", "alice")],
});

describe("filterSnapshot", () => {
  it.each([
    ["", [], ["add-dark-mode", "add-light-mode", "fix-login"]],
    ["", ["alice"], ["add-dark-mode", "fix-login"]],
    ["add", [], ["add-dark-mode", "add-light-mode"]],
    ["add", ["alice"], ["add-dark-mode"]],
    ["add", ["alice", "bob"], ["add-dark-mode", "add-light-mode"]],
    ["zzz", ["alice"], []],
  ] as const)("text %j with authors %j shows %j", (text, authors, expected) => {
    const r = filterSnapshot(COMBINATION, { text, authors: new Set(authors) });
    expect(r.active.map((c) => c.name)).toEqual(expected);
  });

  it("reports each group's total beside the matches", () => {
    const snap = snapshot({
      active: [change("add-search"), change("mid-tier"), change("zebra-fix")],
      parked: [change("search-cache")],
    });
    const r = filterSnapshot(snap, { text: "search", authors: new Set() });
    expect(r.active.map((c) => c.name)).toEqual(["add-search"]);
    expect(r.parked.map((c) => c.name)).toEqual(["search-cache"]);
    expect(r.archived).toEqual([]);
    expect(r.totals).toEqual({ active: 3, parked: 1, archived: 0 });
    expect(r.filtered).toBe(true);
  });

  it.each([
    ["", [], false],
    ["add", [], true],
    ["", ["alice"], true],
  ] as const)("text %j with authors %j sets filtered to %s", (text, authors, filtered) => {
    expect(filterSnapshot(COMBINATION, { text, authors: new Set(authors) }).filtered).toBe(filtered);
  });

  it("keeps the warnings of the snapshot it filtered", () => {
    const snap = snapshot({ active: [change("add-search")], warnings: ["a", "b"] });
    expect(filterSnapshot(snap, { text: "zzz", authors: new Set() }).warnings).toEqual(["a", "b"]);
  });
});

describe("matchesName", () => {
  it.each([
    ["add-search", "search", true],
    ["add-search", "SEARCH", true],
    ["add-search", "Add", true],
    ["add-search", "", true],
    ["mid-tier", "search", false],
  ])("%s against %j is %s", (name, text, expected) => {
    expect(matchesName(change(name), text)).toBe(expected);
  });

  it("does not match a change on its proposer", () => {
    expect(matchesName(change("fix-login", "alice"), "alice")).toBe(false);
  });
});

describe("matchesAuthors", () => {
  it("accepts every change when nothing is selected", () => {
    expect(matchesAuthors(change("x", "alice"), new Set())).toBe(true);
    expect(matchesAuthors(change("x", null), new Set())).toBe(true);
  });

  it("matches an unknown proposer through the sentinel only", () => {
    expect(matchesAuthors(change("x", null), new Set([UNKNOWN_AUTHOR]))).toBe(true);
    expect(matchesAuthors(change("x", null), new Set(["alice"]))).toBe(false);
    expect(matchesAuthors(change("x", "alice"), new Set([UNKNOWN_AUTHOR]))).toBe(false);
  });

  it("shows only the unknown-proposer change when Unknown is selected", () => {
    const snap = snapshot({ active: [change("add-dark-mode", "alice"), change("legacy-change", null)] });
    const r = filterSnapshot(snap, { text: "", authors: new Set([UNKNOWN_AUTHOR]) });
    expect(r.active.map((c) => c.name)).toEqual(["legacy-change"]);
  });
});

describe("authorCandidates", () => {
  it.each([
    [["alice", "bob"], ["alice", "bob"]],
    [["bob", "alice", "bob"], ["alice", "bob"]],
    [["Carol", "alice", "Bob"], ["alice", "Bob", "Carol"]],
    [["alice", null], ["alice", "Unknown"]],
    [[null], ["Unknown"]],
    [[], []],
  ] as const)("proposers %j give candidates %j", (proposers, expected) => {
    const snap = snapshot({ active: proposers.map((p, i) => change(`c${i}`, p)) });
    expect(authorCandidates(snap).map((c) => c.label)).toEqual(expected);
  });

  it("gives the unknown candidate the sentinel id and every named one its own name", () => {
    const snap = snapshot({ active: [change("a", "alice"), change("b", null)] });
    expect(authorCandidates(snap)).toEqual([
      { id: "alice", label: "alice" },
      { id: UNKNOWN_AUTHOR, label: "Unknown" },
    ]);
  });

  it("draws candidates from all three groups", () => {
    const snap = snapshot({
      active: [change("a", "alice", "active")],
      parked: [change("b", "bob", "parked")],
      archived: [change("c", "Carol", "archived")],
    });
    expect(authorCandidates(snap).map((c) => c.id)).toEqual(["alice", "bob", "Carol"]);
  });
});
