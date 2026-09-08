import { describe, it, expect } from "vitest";
import { copyToClipboard, clipboardCommands } from "../../src/herdr/clipboard.js";

describe("copyToClipboard", () => {
  it("uses pbcopy on darwin with the exact text on stdin", async () => {
    const calls: Array<[string, string[], string]> = [];
    const r = await copyToClipboard("/spectra-apply add-search", "darwin", async (cmd, args, text) => {
      calls.push([cmd, args, text]);
      return 0;
    });
    expect(r).toEqual({ ok: true });
    expect(calls).toEqual([["pbcopy", [], "/spectra-apply add-search"]]);
  });

  it("tries wl-copy then xclip on linux", async () => {
    const calls: string[] = [];
    const r = await copyToClipboard("x", "linux", async (cmd) => { calls.push(cmd); return cmd === "xclip" ? 0 : 1; });
    expect(r.ok).toBe(true);
    expect(calls).toEqual(["wl-copy", "xclip"]);
  });

  it("reports failure on linux without any clipboard tool", async () => {
    const r = await copyToClipboard("x", "linux", async () => 1);
    expect(r.ok).toBe(false);
  });

  it("has no commands for unsupported platforms", () => {
    expect(clipboardCommands("win32")).toEqual([]);
  });
});
