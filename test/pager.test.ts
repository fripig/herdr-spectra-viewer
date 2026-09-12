import { describe, it, expect } from "vitest";
import { openInPager, viewerArgv, VIEWER_SPAWN_OPTIONS, type SpawnViewer, type ViewerProcess } from "../src/pager.js";
import { resolveViewer } from "../src/pane.js";
import type { HerdrClient } from "../src/herdr/client.js";

/** Nothing on the pager path talks to Herdr, so a client that fails every call is enough. */
const noClient = { run: () => Promise.reject(new Error("the pager path must not call Herdr")) } as unknown as HerdrClient;

const opts = {
  projectRoot: "/work/project",
  paneId: null,
  viewer: "less",
  filePath: "/work/project/openspec/changes/some-change/proposal.md",
  previousViewerPane: null,
};

interface SpawnCall {
  command: string;
  args: string[];
  options: typeof VIEWER_SPAWN_OPTIONS;
}

/**
 * A spawn that records what it was asked for and lets the test decide how the viewer ends. `ends`
 * reports an exit status; `fails` reports the error a viewer that could not be started reports.
 */
function fakeSpawn(outcome: { ends: number } | { fails: true } | { throws: true }) {
  const calls: SpawnCall[] = [];
  const order: string[] = [];
  const spawnViewer: SpawnViewer = (command, args, options) => {
    calls.push({ command, args, options });
    order.push("spawn");
    if ("throws" in outcome) throw new Error("spawn refused");
    const child: ViewerProcess = {
      on(event: string, listener: (arg: never) => void) {
        // Deliver the outcome on a later tick, the way a real child process does.
        if (event === "exit" && "ends" in outcome) setTimeout(() => listener(outcome.ends as never), 0);
        if (event === "error" && "fails" in outcome) setTimeout(() => listener(new Error("ENOENT") as never), 0);
        return child;
      },
    };
    return child;
  };
  const terminal = {
    suspend: () => void order.push("suspend"),
    resume: () => void order.push("resume"),
  };
  return { spawnViewer, terminal, calls, order };
}

describe("viewerArgv", () => {
  it("puts the artifact path in its own element", () => {
    expect(viewerArgv("less", "/work/a b/proposal.md")).toEqual(["less", "/work/a b/proposal.md"]);
  });

  it("keeps the flags a configured viewer carries", () => {
    expect(viewerArgv("less -R", "/work/p.md")).toEqual(["less", "-R", "/work/p.md"]);
  });
});

describe("openInPager", () => {
  it("runs the viewer with the artifact path as one argument, inheriting the terminal and using no shell", async () => {
    const f = fakeSpawn({ ends: 0 });
    await openInPager(f)(noClient, opts);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].command).toBe("less");
    expect(f.calls[0].args).toEqual([opts.filePath]);
    expect(f.calls[0].options.stdio).toBe("inherit");
    expect(f.calls[0].options.shell).toBe(false);
  });

  it("hands the terminal over before the viewer starts and takes it back after it ends", async () => {
    const f = fakeSpawn({ ends: 0 });
    await openInPager(f)(noClient, opts);
    expect(f.order).toEqual(["suspend", "spawn", "resume"]);
  });

  it("reports success with no pane, because none is created", async () => {
    const f = fakeSpawn({ ends: 0 });
    await expect(openInPager(f)(noClient, opts)).resolves.toEqual({ ok: true, paneId: null });
  });

  it("reports a non-zero status as a failure and still takes the terminal back", async () => {
    const f = fakeSpawn({ ends: 2 });
    const r = await openInPager(f)(noClient, opts);
    expect(r.ok).toBe(false);
    expect(f.order).toEqual(["suspend", "spawn", "resume"]);
  });

  it("reports a viewer that cannot be started as a failure and still takes the terminal back", async () => {
    const f = fakeSpawn({ fails: true });
    const r = await openInPager(f)(noClient, opts);
    expect(r.ok).toBe(false);
    expect(f.order).toEqual(["suspend", "spawn", "resume"]);
  });

  it("takes the terminal back even when the spawn itself throws", async () => {
    const f = fakeSpawn({ throws: true });
    const r = await openInPager(f)(noClient, opts);
    expect(r.ok).toBe(false);
    expect(f.order).toEqual(["suspend", "spawn", "resume"]);
  });

  it("runs the viewer the resolution chain names, not the default", async () => {
    const f = fakeSpawn({ ends: 0 });
    await openInPager(f)(noClient, { ...opts, viewer: "nvim" });
    expect(f.calls[0].command).toBe("nvim");
  });
});

describe("the pager path does not introduce PAGER as a source", () => {
  it("resolves to the default viewer even when PAGER names another one", () => {
    expect(resolveViewer({ PAGER: "bat" }, null)).toBe("less");
  });

  it("lets SPECTRA_VIEWER win over PAGER", () => {
    expect(resolveViewer({ PAGER: "bat", SPECTRA_VIEWER: "nvim" }, null)).toBe("nvim");
  });
});
