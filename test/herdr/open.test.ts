import { describe, it, expect } from "vitest";
import { runOpenAction, MISSING_BIN_MESSAGE } from "../../src/open.js";

describe("open action", () => {
  it("executes herdr plugin pane open as a right split", async () => {
    const calls: Array<[string, string[]]> = [];
    const code = await runOpenAction({
      env: { HERDR_BIN_PATH: "/usr/local/bin/herdr", HERDR_PLUGIN_ID: "spectra-viewer" },
      spawnProcess: async (bin, args) => { calls.push([bin, args]); return 0; },
      stderr: () => {},
    });
    expect(code).toBe(0);
    expect(calls).toEqual([[
      "/usr/local/bin/herdr",
      ["plugin", "pane", "open", "--plugin", "spectra-viewer", "--entrypoint", "changes", "--placement", "split", "--direction", "right"],
    ]]);
  });

  it("propagates the herdr exit code", async () => {
    const code = await runOpenAction({
      env: { HERDR_BIN_PATH: "/x/herdr", HERDR_PLUGIN_ID: "spectra-viewer" },
      spawnProcess: async () => 3,
      stderr: () => {},
    });
    expect(code).toBe(3);
  });

  it("prints the documented message and exits 1 outside Herdr", async () => {
    const lines: string[] = [];
    let spawned = false;
    const code = await runOpenAction({
      env: {},
      spawnProcess: async () => { spawned = true; return 0; },
      stderr: (l) => lines.push(l),
    });
    expect(code).toBe(1);
    expect(spawned).toBe(false);
    expect(lines).toEqual([MISSING_BIN_MESSAGE]);
  });
});
