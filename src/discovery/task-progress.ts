import type { ChangeStatus, TaskProgress } from "./types.js";

const CHECKBOX = /^[-*+]\s+\[(.)\]/;
const FENCE = /^(`{3,}|~{3,})/;

/** Parse tasks.md content; null when no counted checkbox exists. */
export function parseTaskProgress(content: string): TaskProgress | null {
  let total = 0;
  let complete = 0;
  let inFence = false;
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trimStart();
    if (FENCE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = CHECKBOX.exec(line);
    if (!m) continue;
    const mark = m[1];
    if (mark === " ") total += 1;
    else if (mark === "x" || mark === "X") {
      total += 1;
      complete += 1;
    }
  }
  return total === 0 ? null : { complete, total };
}

export function deriveStatus(progress: TaskProgress | null): ChangeStatus {
  if (!progress || progress.total === 0) return "draft";
  if (progress.complete === 0) return "not-started";
  if (progress.complete === progress.total) return "complete";
  return "in-progress";
}
