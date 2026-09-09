import { describe, it, expect } from "vitest";
import path from "node:path";
import { CONFIG_FILE_NAME, readConfiguredViewer } from "../src/config.js";

const DIR = "/config/herdr/plugins/config/spectra-viewer";
const FILE = path.join(DIR, CONFIG_FILE_NAME);
const withDir: NodeJS.ProcessEnv = { HERDR_PLUGIN_CONFIG_DIR: DIR };

/** null content stands for a file the reader cannot open. */
function reader(content: string | null) {
  const paths: string[] = [];
  const read = (p: string): string => {
    paths.push(p);
    if (content === null) throw new Error("ENOENT");
    return content;
  };
  return { read, paths };
}

describe("readConfiguredViewer", () => {
  // One case per row of the configuration-file-outcomes table in the
  // changes-pane spec. No case touches the real filesystem.
  it.each([
    ["the config dir is unset", {} as NodeJS.ProcessEnv, null, null, 0],
    ["the file cannot be read", withDir, null, null, 0],
    ["the content is not valid JSON", withDir, "{ viewer: frogmouth", null, 1],
    ["the top level is an array", withDir, '["frogmouth"]', null, 1],
    ["the viewer field is absent", withDir, '{ "theme": "dark" }', null, 0],
    ["the viewer field is a number", withDir, '{ "viewer": 42 }', null, 1],
    ["the viewer field is whitespace only", withDir, '{ "viewer": "   " }', null, 1],
    ["the viewer field is frogmouth", withDir, '{ "viewer": "frogmouth" }', "frogmouth", 0],
  ] as const)("%s", (_label, env, content, expected, warnings) => {
    const { read } = reader(content);
    const lines: string[] = [];
    expect(readConfiguredViewer(env, read, (l) => lines.push(l))).toBe(expected);
    expect(lines).toHaveLength(warnings);
  });

  it("reads config.json out of the directory Herdr names", () => {
    const { read, paths } = reader('{ "viewer": "frogmouth" }');
    readConfiguredViewer(withDir, read, () => {});
    expect(paths).toEqual([FILE]);
  });

  it("reads nothing at all when the config dir is unset", () => {
    const { read, paths } = reader('{ "viewer": "frogmouth" }');
    readConfiguredViewer({}, read, () => {});
    expect(paths).toEqual([]);
  });

  it("trims the surrounding whitespace off the viewer command", () => {
    const { read } = reader('{ "viewer": "  frogmouth  " }');
    expect(readConfiguredViewer(withDir, read, () => {})).toBe("frogmouth");
  });
});
