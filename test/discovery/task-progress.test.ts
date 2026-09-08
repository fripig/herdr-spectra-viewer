import { describe, it, expect } from "vitest";
import { parseTaskProgress, deriveStatus } from "../../src/discovery/task-progress.js";

describe("parseTaskProgress", () => {
  it.each([
    ["- [ ] 1.1 Implement scanner", 1, 0],
    ["- [x] 1.2 Write tests", 1, 1],
    ["- [X] 1.3 Update docs", 1, 1],
    ["  - [ ] 1.4 Nested subtask", 1, 0],
    ["- [ ] [P] 1.5 Parallel task", 1, 0],
    ["- [~] 1.6 Unknown marker", 0, 0],
    ["## 2. Section heading", 0, 0],
  ])("line %j counts total=%i complete=%i", (line, total, complete) => {
    const p = parseTaskProgress(line);
    if (total === 0) expect(p).toBeNull();
    else expect(p).toEqual({ complete, total });
  });

  it("ignores checkboxes inside fenced code blocks", () => {
    const content = ["- [x] real", "```", "- [ ] inside a fenced block", "```", "- [ ] real too"].join("\n");
    expect(parseTaskProgress(content)).toEqual({ complete: 1, total: 2 });
  });

  it("returns null for content without counted checkboxes", () => {
    expect(parseTaskProgress("# Tasks\n\nnothing here\n")).toBeNull();
    expect(parseTaskProgress("")).toBeNull();
  });
});

describe("deriveStatus", () => {
  it.each([
    [null, "draft"],
    [{ complete: 0, total: 8 }, "not-started"],
    [{ complete: 3, total: 8 }, "in-progress"],
    [{ complete: 8, total: 8 }, "complete"],
  ])("progress %j → %s", (progress, status) => {
    expect(deriveStatus(progress)).toBe(status);
  });
});
