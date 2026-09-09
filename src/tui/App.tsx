import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import path from "node:path";
import type { ScanSnapshot } from "../discovery/types.js";
import type { AdapterResult, HerdrClient, ViewerResult } from "../herdr/client.js";
import type { InvocationContext } from "../herdr/context.js";
import { ChangeTree } from "./ChangeTree.js";
import { StatusBar } from "./StatusBar.js";
import { commandForKey, commandText } from "./keymap.js";
import { hitTest, looksLikeMouse, parseMouse, type Layout, type MouseEvent } from "./mouse.js";
import { buildRows, groupKey, groupOfKey, windowStart, type Row } from "./tree-model.js";

export const NOT_INITIALISED = "This project is not initialised for Spectra (no openspec directory).";
export const SCANNING = "Scanning…";
export const SELECT_CHANGE_FIRST = "Select a change first";

export interface AppDeps {
  projectRoot: string;
  context: InvocationContext;
  client: HerdrClient;
  viewer: string;
  scan: (projectRoot: string) => Promise<ScanSnapshot>;
  hasOpenspec: (projectRoot: string) => Promise<boolean>;
  readArtifact: (absolutePath: string) => Promise<string>;
  sendText: (client: HerdrClient, paneId: string, text: string) => Promise<AdapterResult>;
  /** Moves keyboard focus from this pane back to the pane on its left. */
  focusPane: (client: HerdrClient, opts: { paneId: string }) => Promise<AdapterResult>;
  openEditor: (
    client: HerdrClient,
    opts: { projectRoot: string; paneId: string | null; viewer: string; filePath: string; previousViewerPane: string | null },
  ) => Promise<ViewerResult>;
  copy: (text: string) => Promise<AdapterResult>;
  /**
   * The viewer pane created by the last open; closed before the next one so at
   * most one is ever on screen, and closed again by the exit paths so none
   * outlives this pane. A pane that closed itself leaves a stale id, which
   * every close tolerates. The entry point owns it because the exit paths live
   * outside the component.
   */
  viewerPane: { current: string | null };
  onExit: (code: number) => void;
  height: number;
}

const RESERVED_ROWS = 4;

export function App(deps: AppDeps) {
  const [snapshot, setSnapshot] = useState<ScanSnapshot | null>(null);
  const [scanning, setScanning] = useState(true);
  const [initialised, setInitialised] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([groupKey("active")]));
  const [cursorKey, setCursorKey] = useState<string>(groupKey("active"));
  const [message, setMessage] = useState<string | null>(null);
  const [start, setStart] = useState(0);
  const exited = useRef(false);
  const viewerPane = deps.viewerPane;
  const { stdout } = useStdout();

  const treeHeight = Math.max(3, deps.height - RESERVED_ROWS);

  const runScan = useCallback(async () => {
    setScanning(true);
    const ok = await deps.hasOpenspec(deps.projectRoot);
    if (!ok) {
      setInitialised(false);
      setScanning(false);
      return;
    }
    const snap = await deps.scan(deps.projectRoot);
    setSnapshot(snap);
    setScanning(false);
  }, [deps]);

  useEffect(() => {
    void runScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows: Row[] = useMemo(() => (snapshot ? buildRows(snapshot, expanded) : []), [snapshot, expanded]);

  // Keep the cursor on an existing row; after a rescan fall back to the node's group.
  let cursorIndex = rows.findIndex((r) => r.key === cursorKey);
  if (cursorIndex < 0 && rows.length > 0) {
    const fallback = groupOfKey(cursorKey);
    cursorIndex = Math.max(0, rows.findIndex((r) => r.key === fallback));
  }
  useEffect(() => {
    if (rows.length > 0 && rows[cursorIndex] && rows[cursorIndex].key !== cursorKey) setCursorKey(rows[cursorIndex].key);
  }, [rows, cursorIndex, cursorKey]);

  const windowFrom = windowStart(Math.max(0, cursorIndex), treeHeight, start);
  useEffect(() => {
    if (windowFrom !== start) setStart(windowFrom);
  }, [windowFrom, start]);

  const current: Row | undefined = rows[cursorIndex];

  const moveCursor = (delta: number) => {
    if (rows.length === 0) return;
    const next = Math.min(rows.length - 1, Math.max(0, cursorIndex + delta));
    setCursorKey(rows[next].key);
  };

  const toggle = (row: Row, force?: boolean) => {
    if (!row.expandable) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      const open = force ?? !next.has(row.key);
      if (open) next.add(row.key);
      else next.delete(row.key);
      return next;
    });
  };

  const artifactPath = (row: Row): string => path.join(row.change!.directory, row.artifact!);

  const openEditor = async (row: Row) => {
    const file = artifactPath(row);
    try {
      await deps.readArtifact(file);
    } catch {
      setMessage(`File not found: ${row.artifact}`);
      return;
    }
    const r = await deps.openEditor(deps.client, {
      projectRoot: deps.projectRoot, paneId: deps.context.paneId, viewer: deps.viewer, filePath: file,
      previousViewerPane: viewerPane.current,
    });
    viewerPane.current = r.ok ? r.paneId : (r.paneId ?? null);
    setMessage(r.ok ? `Opened in ${deps.viewer}` : "Could not open viewer");
  };

  const exit = (code: number) => {
    if (exited.current) return;
    exited.current = true;
    deps.onExit(code);
  };

  const sendCommand = async (command: string) => {
    if (!current || !current.change) {
      setMessage(SELECT_CHANGE_FIRST);
      return;
    }
    const text = commandText(command, current.change.name);
    const copyFallback = async (okMessage: string) => {
      const c = await deps.copy(text);
      setMessage(c.ok ? okMessage : `Copy failed: ${text}`);
    };
    // The destination is the pane that invoked the plugin, which is not this
    // pane when Herdr opened the plugin in a pane of its own.
    const target = deps.context.commandPaneId;
    if (target) {
      const r = await deps.sendText(deps.client, target, text);
      if (r.ok) {
        // The send already succeeded, so a focus that does not happen is worth
        // saying but never worth a clipboard write.
        const own = deps.context.paneId;
        const focused = own ? await deps.focusPane(deps.client, { paneId: own }) : { ok: false as const, reason: "no pane of its own" };
        setMessage(focused.ok ? `Sent: ${text}` : "Sent, but could not focus pane");
        return;
      }
      await copyFallback("Herdr send failed, copied instead");
      return;
    }
    await copyFallback(`Copied: ${text}`);
  };

  // Geometry of the tree as rendered below: the "Scanning…" line during a
  // rescan is the only row above the tree today; the actions change adds a header.
  const layout: Layout = {
    treeTop: scanning && snapshot ? 1 : 0,
    treeHeight,
    treeLeft: 0,
    treeWidth: stdout.columns || 80,
    windowStart: start,
    rowCount: rows.length,
  };

  const handleMouse = (events: MouseEvent[]) => {
    if (!initialised || !snapshot) return;
    for (const ev of events) {
      if (ev.kind === "release") continue;
      if (ev.kind === "wheel-up" || ev.kind === "wheel-down") {
        const treeRow = ev.row - 1 - layout.treeTop;
        if (treeRow >= 0 && treeRow < layout.treeHeight) moveCursor(ev.kind === "wheel-up" ? -1 : 1);
        continue;
      }
      const hit = hitTest(ev, layout, (i) => rows[i]?.depth ?? 0);
      if (!hit) continue;
      const row = rows[hit.rowIndex];
      setCursorKey(row.key);
      if (hit.onMarker) {
        if (row.expandable) toggle(row);
      } else if (row.kind === "artifact") {
        void openEditor(row);
      }
    }
  };

  useInput((input, key) => {
    if (looksLikeMouse(input)) {
      handleMouse(parseMouse(input));
      return;
    }
    if (input === "q" || key.escape) {
      exit(0);
      return;
    }
    if (scanning || !initialised) return;
    if (input === "R") {
      void runScan();
      return;
    }
    if (key.upArrow || input === "k") return moveCursor(-1);
    if (key.downArrow || input === "j") return moveCursor(1);
    if (!current) return;
    if (key.rightArrow || input === "l") return toggle(current, true);
    if (key.leftArrow || input === "h") {
      if (current.expanded) return toggle(current, false);
      if (current.parentKey) setCursorKey(current.parentKey);
      return;
    }
    if (key.return || input === "e") {
      if (current.kind === "artifact") void openEditor(current);
      else if (key.return) toggle(current);
      return;
    }
    const cmd = commandForKey(input);
    if (cmd) void sendCommand(cmd.command);
  });

  const skipped = snapshot?.warnings.length ?? 0;

  let body: React.ReactNode;
  if (!initialised) body = <Text>{NOT_INITIALISED}</Text>;
  else if (scanning && !snapshot) body = <Text>{SCANNING}</Text>;
  else
    body = (
      <Box flexDirection="column">
        {scanning ? <Text dimColor>{SCANNING}</Text> : null}
        <ChangeTree rows={rows} cursorIndex={cursorIndex} start={start} height={treeHeight} />
      </Box>
    );

  return (
    <Box flexDirection="column" height={deps.height}>
      <Box flexGrow={1}>{body}</Box>
      <StatusBar message={message} skipped={skipped} />
    </Box>
  );
}
