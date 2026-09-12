import { describe, it, expect } from "vitest";
import { resolveViewer } from "../../src/pane.js";

describe("resolveViewer", () => {
  // One case per row of the resolved-viewer table in the changes-pane spec.
  // `flag` is what the command line asked for and `configured` is the plugin
  // configuration file's answer; null is the one each gives when it has nothing
  // usable to say.
  it.each([
    [null, {}, null, "less"],
    [null, { EDITOR: "nvim" }, null, "less"],
    [null, { SPECTRA_VIEWER: "nvim" }, null, "nvim"],
    [null, { SPECTRA_VIEWER: "nvim", EDITOR: "vi" }, "vi", "nvim"],
    [null, { SPECTRA_VIEWER: "   ", EDITOR: "nvim" }, null, "less"],
    [null, { SPECTRA_VIEWER: "  bat  " }, null, "bat"],
    [null, {}, "frogmouth", "frogmouth"],
    [null, {}, "  frogmouth  ", "frogmouth"],
    [null, { SPECTRA_VIEWER: "   " }, "frogmouth", "frogmouth"],
    [null, {}, "   ", "less"],
    ["mdcat -p", {}, null, "mdcat -p"],
    ["mdcat -p", { SPECTRA_VIEWER: "nvim", EDITOR: "nvim" }, "frogmouth", "mdcat -p"],
    ["  bat  ", {}, null, "bat"],
    ["   ", { SPECTRA_VIEWER: "nvim" }, null, "nvim"],
    ["   ", {}, "frogmouth", "frogmouth"],
    ["   ", {}, null, "less"],
  ])("resolves flag %o and env %o with config %o to %s", (flag, env, configured, expected) => {
    expect(resolveViewer({ flag, env, configured })).toBe(expected);
  });

  it("falls back to the pager when no source but the environment is passed at all", () => {
    expect(resolveViewer({ env: {} })).toBe("less");
  });
});
