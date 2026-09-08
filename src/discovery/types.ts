export type ChangeGroup = "active" | "parked" | "archived";
export type ChangeStatus = "draft" | "not-started" | "in-progress" | "complete";

export interface TaskProgress {
  complete: number;
  total: number;
}

export interface SpectraChange {
  name: string;
  group: ChangeGroup;
  directory: string;
  /** Markdown files relative to `directory`, forward slashes, sorted as strings. */
  artifacts: string[];
  progress: TaskProgress | null;
  status: ChangeStatus;
  /** ISO date (YYYY-MM-DD) from `.openspec.yaml` `created`, or null. */
  createdAt: string | null;
  /** Epoch milliseconds of the newest Markdown file, or null. */
  modifiedAt: number | null;
  proposer: string | null;
}

export interface ScanSnapshot {
  active: SpectraChange[];
  parked: SpectraChange[];
  archived: SpectraChange[];
  warnings: string[];
}
