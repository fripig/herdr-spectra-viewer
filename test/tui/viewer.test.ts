import { describe, it, expect } from "vitest";
import { resolveViewer } from "../../src/pane.js";

describe("resolveViewer", () => {
  // One case per row of the resolved-viewer table in the changes-pane spec.
  // The second argument is the plugin configuration file's answer; null is the
  // one it gives when the file has nothing usable to say.
  it.each([
    [{}, null, "less"],
    [{ EDITOR: "nvim" }, null, "less"],
    [{ SPECTRA_VIEWER: "nvim" }, null, "nvim"],
    [{ SPECTRA_VIEWER: "nvim", EDITOR: "vi" }, "vi", "nvim"],
    [{ SPECTRA_VIEWER: "   ", EDITOR: "nvim" }, null, "less"],
    [{ SPECTRA_VIEWER: "  bat  " }, null, "bat"],
    [{}, "frogmouth", "frogmouth"],
    [{}, "  frogmouth  ", "frogmouth"],
    [{ SPECTRA_VIEWER: "   " }, "frogmouth", "frogmouth"],
    [{}, "   ", "less"],
  ])("resolves %o with config %o to %s", (env, configured, expected) => {
    expect(resolveViewer(env, configured)).toBe(expected);
  });

  it("falls back to the pager when no configuration source is passed at all", () => {
    expect(resolveViewer({})).toBe("less");
  });
});
