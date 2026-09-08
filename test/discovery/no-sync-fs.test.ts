import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const dir = new URL("../../src/discovery/", import.meta.url).pathname;

describe("discovery module uses only non-blocking fs APIs", () => {
  for (const name of readdirSync(dir)) {
    it(`${name} has no synchronous fs usage`, () => {
      const src = readFileSync(path.join(dir, name), "utf8");
      expect(src).not.toMatch(/from "node:fs"/);
      expect(src).not.toMatch(/\b\w+Sync\(/);
    });
  }
});
