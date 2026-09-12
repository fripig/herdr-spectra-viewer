import { describe, it, expect } from "vitest";
import { chooseOpenEditor } from "../src/pane.js";
import { openInEditorSplit, type HerdrClient } from "../src/herdr/client.js";
import { VIEWER_SPAWN_OPTIONS, type SpawnViewer, type ViewerProcess } from "../src/pager.js";

/** Records whether the pager path was taken, by being the only spawn either adapter could use. */
function recordingPager() {
  const spawned: string[] = [];
  const spawnViewer: SpawnViewer = (command) => {
    spawned.push(command);
    const child: ViewerProcess = {
      on(event: string, listener: (arg: never) => void) {
        if (event === "exit") setTimeout(() => listener(0 as never), 0);
        return child;
      },
    };
    return child;
  };
  return { spawnViewer, terminal: { suspend: () => {}, resume: () => {} }, spawned };
}

const opts = {
  projectRoot: "/work/project",
  paneId: null,
  viewer: "less",
  filePath: "/work/project/openspec/changes/c/proposal.md",
  previousViewerPane: null,
};

describe("chooseOpenEditor", () => {
  it("uses the Herdr adapter when the invocation carries a Herdr binary path", () => {
    expect(chooseOpenEditor("/usr/local/bin/herdr", recordingPager())).toBe(openInEditorSplit);
  });

  it("uses the pager adapter when there is no Herdr binary path", async () => {
    const pager = recordingPager();
    const open = chooseOpenEditor(null, pager);
    expect(open).not.toBe(openInEditorSplit);
    // A client that fails every call proves the chosen adapter never asks Herdr for anything.
    const client = { run: () => Promise.reject(new Error("no Herdr call may happen here")) } as unknown as HerdrClient;
    await expect(open(client, opts)).resolves.toEqual({ ok: true, paneId: null });
    expect(pager.spawned).toEqual(["less"]);
  });

  it("starts the viewer with the options the pager path always uses", async () => {
    const calls: unknown[] = [];
    const spawnViewer: SpawnViewer = (command, args, options) => {
      calls.push(options);
      const child: ViewerProcess = {
        on(event: string, listener: (arg: never) => void) {
          if (event === "exit") setTimeout(() => listener(0 as never), 0);
          return child;
        },
      };
      return child;
    };
    const open = chooseOpenEditor(null, { spawnViewer, terminal: { suspend: () => {}, resume: () => {} } });
    await open({} as HerdrClient, opts);
    expect(calls).toEqual([VIEWER_SPAWN_OPTIONS]);
  });
});
