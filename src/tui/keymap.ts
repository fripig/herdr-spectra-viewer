export interface CommandKey {
  key: string;
  command: string;
  label: string;
}

/** Workflow order: discuss opens, apply/ingest alternate, archive ends, commit lands files. */
export const COMMAND_KEYS: readonly CommandKey[] = [
  { key: "d", command: "/spectra-discuss", label: "discuss" },
  { key: "a", command: "/spectra-apply", label: "apply" },
  { key: "i", command: "/spectra-ingest", label: "ingest" },
  { key: "r", command: "/spectra-archive", label: "archive" },
  { key: "c", command: "/spectra-commit", label: "commit" },
];

export function commandForKey(key: string): CommandKey | undefined {
  return COMMAND_KEYS.find((c) => c.key === key);
}

export function commandText(command: string, changeName: string): string {
  return `${command} ${changeName}`;
}
