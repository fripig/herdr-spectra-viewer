export { scanChanges } from "./scan.js";
export { resolveGitDir } from "./git-dir.js";
export { resolveSpecDir, specDirExists, SPECTRA_CONFIG_FILE, DEFAULT_SPEC_DIR } from "./spec-dir.js";
export type { SpecDirResolution } from "./spec-dir.js";
export { parseTaskProgress, deriveStatus } from "./task-progress.js";
export { readChangeMetadata, listArtifacts, newestModification, parseCreatedAt, parseProposer } from "./metadata.js";
export type { ChangeGroup, ChangeStatus, ScanSnapshot, SpectraChange, TaskProgress } from "./types.js";
