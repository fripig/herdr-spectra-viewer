import { describe, it, expect } from "vitest";
import { resolveViewer } from "../../src/pane.js";

describe("resolveViewer", () => {
  // One case per row of the resolved-viewer table in the changes-pane spec.
  it.each([
    [{}, "less"],
    [{ EDITOR: "nvim" }, "less"],
    [{ SPECTRA_VIEWER: "nvim" }, "nvim"],
    [{ SPECTRA_VIEWER: "nvim", EDITOR: "vi" }, "nvim"],
    [{ SPECTRA_VIEWER: "   ", EDITOR: "nvim" }, "less"],
    [{ SPECTRA_VIEWER: "  bat  " }, "bat"],
  ])("resolves %o to %s", (env, expected) => {
    expect(resolveViewer(env)).toBe(expected);
  });
});
