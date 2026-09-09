import { describe, it, expect } from "vitest";
import { readInvocationContext } from "../../src/herdr/context.js";

describe("readInvocationContext", () => {
  it("reads root, pane id and binary from a Herdr invocation", () => {
    const ctx = readInvocationContext(
      { HERDR_PLUGIN_CONTEXT_JSON: '{"workspace":{"cwd":"/repo"}}', HERDR_PANE_ID: "p1", HERDR_BIN_PATH: "/usr/local/bin/herdr" },
      "/work",
      () => {},
    );
    expect(ctx).toEqual({
      projectRoot: "/repo", projectRootFromContext: true, paneId: "p1", commandPaneId: "p1", herdrBin: "/usr/local/bin/herdr",
    });
  });

  it("keeps the plugin's own pane apart from the pane that invoked it", () => {
    const ctx = readInvocationContext(
      { HERDR_PANE_ID: "w4:p1C", HERDR_PLUGIN_CONTEXT_JSON: '{"workspace_cwd":"/repo","focused_pane_id":"w4:p1"}' },
      "/work",
      () => {},
    );
    expect(ctx.projectRoot).toBe("/repo");
    expect(ctx.paneId).toBe("w4:p1C");
    expect(ctx.commandPaneId).toBe("w4:p1");
  });

  it("falls back entirely outside Herdr", () => {
    expect(readInvocationContext({}, "/work", () => {})).toEqual({
      projectRoot: "/work", projectRootFromContext: false, paneId: null, commandPaneId: null, herdrBin: null,
    });
  });

  it.each([
    ['{"workspace_cwd":"/repo"}', "/repo", false],
    ['{"workspace":{"cwd":"/repo"}}', "/repo", false],
    ['{"workspace_cwd":""}', "/work", false],
    ['{"workspace":{}}', "/work", false],
    ["not json", "/work", true],
    [undefined, "/work", false],
  ])("context %j → root %s (warning: %s)", (json, root, warns) => {
    const lines: string[] = [];
    const env: NodeJS.ProcessEnv = json === undefined ? {} : { HERDR_PLUGIN_CONTEXT_JSON: json };
    expect(readInvocationContext(env, "/work", (l) => lines.push(l)).projectRoot).toBe(root);
    expect(lines.length > 0).toBe(warns);
  });

  it.each([
    ["w4:p1C", '{"focused_pane_id":"w4:p1"}', "w4:p1"],
    ["w4:p1C", "{}", "w4:p1C"],
    ["w4:p1C", '{"focused_pane_id":""}', "w4:p1C"],
    [undefined, '{"focused_pane_id":"w4:p1"}', "w4:p1"],
    [undefined, "{}", null],
  ])("pane %j with context %j → command pane %j", (paneId, json, expected) => {
    const env: NodeJS.ProcessEnv = { HERDR_PLUGIN_CONTEXT_JSON: json };
    if (paneId !== undefined) env.HERDR_PANE_ID = paneId;
    expect(readInvocationContext(env, "/work", () => {}).commandPaneId).toBe(expected);
  });

  it("treats empty pane id and binary as null", () => {
    const ctx = readInvocationContext({ HERDR_PANE_ID: "", HERDR_BIN_PATH: "" }, "/work", () => {});
    expect(ctx.paneId).toBeNull();
    expect(ctx.commandPaneId).toBeNull();
    expect(ctx.herdrBin).toBeNull();
  });
});
