import { describe, it, expect } from "vitest";
import { readInvocationContext } from "../../src/herdr/context.js";

describe("readInvocationContext", () => {
  it("reads root, pane id and binary from a Herdr invocation", () => {
    const ctx = readInvocationContext(
      { HERDR_PLUGIN_CONTEXT_JSON: '{"workspace":{"cwd":"/repo"}}', HERDR_PANE_ID: "p1", HERDR_BIN_PATH: "/usr/local/bin/herdr" },
      "/work",
      () => {},
    );
    expect(ctx).toEqual({ projectRoot: "/repo", projectRootFromContext: true, paneId: "p1", herdrBin: "/usr/local/bin/herdr" });
  });

  it("falls back entirely outside Herdr", () => {
    expect(readInvocationContext({}, "/work", () => {})).toEqual({
      projectRoot: "/work", projectRootFromContext: false, paneId: null, herdrBin: null,
    });
  });

  it.each([
    ['{"workspace":{"cwd":"/repo"}}', "/repo", false],
    ['{"workspace":{}}', "/work", false],
    ["not json", "/work", true],
    [undefined, "/work", false],
  ])("context %j → root %s (warning: %s)", (json, root, warns) => {
    const lines: string[] = [];
    const env: NodeJS.ProcessEnv = json === undefined ? {} : { HERDR_PLUGIN_CONTEXT_JSON: json };
    expect(readInvocationContext(env, "/work", (l) => lines.push(l)).projectRoot).toBe(root);
    expect(lines.length > 0).toBe(warns);
  });

  it("treats empty pane id and binary as null", () => {
    const ctx = readInvocationContext({ HERDR_PANE_ID: "", HERDR_BIN_PATH: "" }, "/work", () => {});
    expect(ctx.paneId).toBeNull();
    expect(ctx.herdrBin).toBeNull();
  });
});
