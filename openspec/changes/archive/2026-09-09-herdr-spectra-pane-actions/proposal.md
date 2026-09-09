## Why

核心 pane（change `herdr-spectra-pane-core`，已於 2026-09-09 歸檔）只能照掃描順序列出 changes，沒有辦法排序、篩選或看出提出者。當專案累積了數十個已歸檔的 change、又有多位貢獻者時，就需要 idea-spectra-viewer IntelliJ plugin 已經有的排序、篩選、作者與複製名稱這些能力，並改寫成鍵盤驅動的終端介面。

## What Changes

- 新增排序模式，用 `s` 鍵循環：Name、Modified（預設）、Created。目前模式顯示在 pane 標題列。排序只在既有 snapshot 上重排各群組內的 changes，不重新掃描。
- 新增名稱篩選，用 `/` 鍵進入：篩選列啟用時，輸入的字元會把三個群組收斂成名稱包含該字串（不分大小寫）的 changes；Enter 保留文字並回到樹狀檢視，Escape 清空文字。只要有篩選生效，群組節點就顯示 `matching/total` 計數。
- 新增作者篩選，用 `@` 鍵開啟：挑選器列出 snapshot 中所有相異的提出者，必要時加上 `Unknown`；Space 切換候選項，Enter 或 Escape 關閉挑選器。候選項少於兩個時挑選器拒絕開啟。重新掃描後，仍存在的作者其選取狀態會保留。
- 在 change 節點上顯示提出者，位置在名稱與進度計數之間，以淡色呈現，僅在已知時顯示。
- 新增複製 change 名稱，在 change 節點或該 change 的 artifact 節點上按 `y`：透過既有的剪貼簿 fallback 把純名稱寫入剪貼簿，並在狀態列確認。
- 修改既有的樹狀群組、進度顯示、重新掃描與 pane 離開等需求，使其涵蓋篩選計數、提出者位置、保留的篩選／排序／作者狀態，以及篩選列或作者挑選器開啟時 Escape 的新意義。

## Non-Goals (optional)

（記錄於 design.md 的 Goals / Non-Goals 一節。）

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `changes-pane`：新增排序、名稱篩選、作者篩選、提出者顯示與複製 change 名稱等需求；並修改樹狀群組計數、change 節點文字、重新掃描的狀態保留與 Escape 處理。

## Impact

- Affected specs: `changes-pane`（modified）
- Affected code:
  - New: `src/tui/change-order.ts`（排序比較器與模式循環）
  - New: `src/tui/change-filter.ts`（名稱與作者判定、候選清單）
  - New: `src/tui/FilterLine.tsx`、`src/tui/AuthorPicker.tsx`
  - New: `test/tui/change-order.test.ts`、`test/tui/change-filter.test.ts`
  - Modified: `src/tui/App.tsx`、`src/tui/tree-model.ts`、`src/tui/ChangeTree.tsx`、`src/tui/StatusBar.tsx`、`src/tui/keymap.ts`、`test/tui/App.test.tsx`
  - Removed: （無）
- Dependencies: 不新增任何相依；沿用 discovery snapshot 既有的 `modifiedAt`、`createdAt`、`proposer` 欄位，核心 change 已經產出這些資料。
