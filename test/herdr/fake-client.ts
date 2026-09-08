import type { HerdrClient, RunResult } from "../../src/herdr/client.js";

export interface FakeClient extends HerdrClient {
  calls: string[][];
}

/** Responds per call in order; extra calls get exit 0 with empty stdout. */
export function fakeClient(responses: Array<Partial<RunResult>> = []): FakeClient {
  const calls: string[][] = [];
  const queue = [...responses];
  return {
    calls,
    async run(args) {
      calls.push(args);
      const r = queue.shift() ?? {};
      return { stdout: r.stdout ?? "", exitCode: r.exitCode ?? 0 };
    },
  };
}
