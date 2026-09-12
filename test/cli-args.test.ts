import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { packageVersion, PACKAGE_MANIFEST_URL, parseCliArgs, USAGE } from "../src/cli-args.js";

describe("parseCliArgs", () => {
  it("runs the pane with no viewer and nothing to report when given no arguments", () => {
    expect(parseCliArgs([])).toEqual({ kind: "run", viewer: null, warnings: [] });
  });

  // One case per row of the viewer-command-per-argument-list table in the
  // standalone-cli spec. The quoting in that table is the shell's; by the time
  // the arguments reach here a quoted value is already one element.
  it.each([
    [["--viewer", "mdcat"], "mdcat", 0],
    [["--viewer=mdcat"], "mdcat", 0],
    [["--viewer", "mdcat -p"], "mdcat -p", 0],
    [["--viewer=mdcat -p"], "mdcat -p", 0],
    [["--viewer", "  bat  "], "bat", 0],
    [["--viewer", ""], null, 1],
    [["--viewer="], null, 1],
    [["--viewer", "   "], null, 1],
    [["--viewer"], null, 1],
    [["--viewer", "a", "--viewer", "b"], "b", 0],
    [["--viewer", "a", "--viewer", "  "], null, 1],
  ] as const)("reads %o as viewer %s with %i warning(s)", (args, viewer, warnings) => {
    const parsed = parseCliArgs(args);
    expect(parsed.kind).toBe("run");
    if (parsed.kind !== "run") return;
    expect(parsed.viewer).toBe(viewer);
    expect(parsed.warnings).toHaveLength(warnings);
  });

  it("does not accept short aliases for the viewer option", () => {
    expect(parseCliArgs(["-v", "mdcat"]).kind).toBe("usage-error");
  });
});

describe("USAGE", () => {
  it.each(["--viewer", "--help", "--version", "SPECTRA_VIEWER", "less"])("names %s", (token) => {
    expect(USAGE).toContain(token);
  });

  it("states that no positional argument is taken and where the project comes from", () => {
    expect(USAGE).toContain("no positional");
    expect(USAGE).toContain("the directory the program is run from");
  });

  it("spells out the quoting rule for a viewer command carrying options", () => {
    expect(USAGE).toContain("--viewer 'bat --style=plain'");
  });

  // Asking is settled before refusing, in a fixed order, so the outcome does
  // not depend on which option the user happened to type first.
  it.each([
    [["--help"], "help"],
    [["--version"], "version"],
    [["--help", "--version"], "help"],
    [["--version", "--help"], "help"],
    [["--help", "--bogus"], "help"],
    [["--viewer", "--help"], "help"],
  ] as const)("reads %o as %s", (args, kind) => {
    expect(parseCliArgs(args).kind).toBe(kind);
  });

  // The program takes no positional arguments, so anything unrecognised is a
  // typo or a misunderstanding and is named back rather than ignored.
  it.each([
    ["an unrecognised option", ["--bogus"], "--bogus"],
    ["a positional argument", ["openspec"], "openspec"],
    ["an unquoted viewer command", ["--viewer", "bat", "--style=plain"], "--style=plain"],
  ] as const)("refuses %s and names it", (_label, args, named) => {
    const parsed = parseCliArgs(args);
    expect(parsed.kind).toBe("usage-error");
    if (parsed.kind !== "usage-error") return;
    expect(parsed.message).toContain(named);
  });

  // A viewer option that yields nothing is passed over, never refused: the pane
  // still starts and the next source down gets to answer.
  it.each([
    ["no value follows it", ["--viewer"]],
    ["its value is empty", ["--viewer", ""]],
    ["its value holds only whitespace", ["--viewer", "   "]],
  ] as const)("warns once and still starts the pane when %s", (_label, args) => {
    const parsed = parseCliArgs(args);
    expect(parsed.kind).toBe("run");
    if (parsed.kind !== "run") return;
    expect(parsed.viewer).toBeNull();
    expect(parsed.warnings).toHaveLength(1);
    expect(parsed.warnings[0]).toContain("--viewer");
  });
});

describe("packageVersion", () => {
  it("reads the version the package is actually published under", () => {
    const manifest: unknown = JSON.parse(readFileSync(fileURLToPath(PACKAGE_MANIFEST_URL), "utf8"));
    expect(packageVersion()).toBe((manifest as { version: string }).version);
  });

  it("throws when the manifest cannot be read", () => {
    expect(() =>
      packageVersion(() => {
        throw new Error("ENOENT");
      }),
    ).toThrow();
  });

  it("throws rather than guessing when the version is not a string", () => {
    expect(() => packageVersion(() => '{ "version": 42 }')).toThrow();
  });
});
