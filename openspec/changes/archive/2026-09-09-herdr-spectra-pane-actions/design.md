## Context

核心 pane（`src/tui/App.tsx`、`src/tui/tree-model.ts`）把 `ScanSnapshot` 依掃描順序渲染成一列列，用節點 key 記住游標，並透過 `useInput` 派送單鍵指令。每個 change 都已經從 `src/discovery/` 帶有 `modifiedAt`、`createdAt` 與 `proposer`，所以這個 change 只動到 TUI 層。要移植的行為是 idea-spectra-viewer `changes-tool-window` spec 中的排序、名稱篩選、作者篩選、提出者顯示與複製名稱等需求，並把工具列元件與右鍵選單改寫成按鍵與模態輸入列。

目前 pane 只有一種輸入模式：每個按鍵都是指令。加入文字篩選與作者挑選器等於引入另外兩種「按鍵有別的意義」的模式，這是本設計最主要的問題。

## Goals / Non-Goals

**Goals:**

- 在既有 snapshot 上，依名稱、修改日期或建立日期重排群組內的 changes，預設為 Modified。
- 以行內輸入的方式，用 change 名稱的子字串（不分大小寫）收斂三個群組。
- 依一位或多位提出者收斂三個群組，候選清單由 snapshot 推導。
- 在每個節點上顯示該 change 的提出者。
- 一鍵把 change 的純名稱複製到剪貼簿。
- 樹狀檢視取得焦點時，核心 pane 既有的每個按鍵意義都不變。

**Non-Goals:**

- 多節點選取。TUI 只有一個游標，所以複製名稱只複製一個；IntelliJ 的多選情境直接捨棄而非模擬。
- 滑鼠或右鍵選單互動。
- 讓排序模式、篩選文字或作者選取跨 pane 啟動保留。每次啟動都是 Modified、空篩選、無作者。
- 依 artifact 路徑、狀態或日期篩選。
- 任何對 `src/discovery/` 或 `src/herdr/` 的改動。

## Decisions

### Three input modes: tree, filter line, author picker

`App` 新增一個 `mode` 狀態，值為 `tree`、`filter`、`authors`。`useInput` 先依模式派送：

- `tree`：既有的 keymap，再加上 `s`（循環排序）、`/`（進入篩選模式）、`@`（進入作者模式）、`y`（複製名稱）。
- `filter`：可列印字元附加到篩選文字，Backspace 刪掉最後一個字元，Enter 保留文字並回到 `tree`，Escape 清空文字並回到 `tree`。其他按鍵一律無作用，因此 `q`、`j`、`a` 之類在這裡就是字面文字。
- `authors`：Up/Down 或 `k`/`j` 移動挑選器游標，Space 切換游標下的候選項，Enter 與 Escape 都保留選取並回到 `tree`。此模式忽略 `q`，避免與離開混淆。

已否決的替代方案：只用單一模式，`/` 透過 Ink 的 `TextInput` 套件開一個獨立提示。那會多一個相依，而且仍然需要模式旗標來擋住打字時觸發樹狀按鍵。另一個已否決的替代方案：讓篩選模式的 Escape 保留文字（與 Enter 相同）。把 Escape 定義成「清空並離開」，才給了使用者一鍵脫離篩選的方式，而那正是常見需求。

### Pure ordering and filtering functions over the snapshot

`src/tui/change-order.ts` 匯出 `SORT_MODES`（循環順序為 `["modified", "name", "created"]`，從預設值起算）、`nextSortMode(mode)`，以及回傳比較器的 `compareChanges(mode)`。日期比較器把 `null` 排在最後，同分時以名稱升冪決勝；名稱比較器用單純字串比較，與 discovery 模組的 artifact 排序一致。

`src/tui/change-filter.ts` 匯出 `matchesName(change, text)`；`authorCandidates(snapshot)` 回傳有序的 `{ id, label }` 清單，其中 `id` 是提出者字串或哨兵值 `"__unknown__"`，`label` 是提出者或 `Unknown`；`matchesAuthors(change, selectedIds)`；以及 `filterSnapshot(snapshot, { text, authors })`，回傳只含符合項目的新 snapshot 加上各群組總數。候選項以 `localeCompare` 搭配 `sensitivity: "base"` 排序，使 `alice`、`Bob`、`Carol` 不分大小寫排列，`Unknown` 固定放在最後。

`tree-model.ts` 的 `buildRows` 接收篩選後的 snapshot 與總數，群組標籤在沒有篩選時渲染成 `Active (2)`，有篩選時渲染成 `Active (1/3)`。排序由 `App` 在 `buildRows` 之前套用，因此 tree model 不需要知道排序模式。

已否決的替代方案：把篩選寫進 `buildRows`。把篩選與排序保持為各自獨立的純函式，才能不透過 Ink 就針對 spec 的範例做表格式測試。

### Proposer rendered inside the change label

`changeLabel(change)` 變成：`name`，接著在已知時加一個空格與提出者，接著在有進度時加一個空格與 `(complete/total)`。標籤是單一字串，因此既有的游標與視窗邏輯完全不動。`ChangeTree` 把標籤切成三段 `Text` 並以 `dimColor` 渲染提出者與計數；row model 帶有 `proposer` 與 `progressText` 欄位，元件不需要再去解析字串。

### Author selection survives rescan by intersection

重新掃描後，`selectedAuthors` 換成它與 `authorCandidates(newSnapshot)` 中 id 的交集。篩選文字與排序模式是單純狀態，原封不動保留。既有的游標復原邏輯（同 key，否則退回群組）已經能處理游標所在的 change 被篩掉或消失的情況。

### Copy name reuses the clipboard adapter and the status bar

在 change 節點或 artifact 節點上按 `y`，透過已經注入 `App` 的 `copy` 相依複製 `change.name`。成功時狀態列顯示 `Copied: <name>`，失敗時顯示 `Copy failed: <name>`。在群組節點上顯示 `Select a change first`，與指令鍵用的是同一則訊息。這一點偏離了 IntelliJ spec 的「不給任何可見回饋」，因為 TUI 沒有別的方式確認剪貼簿寫入。

### Header line shows sort mode and active filters

樹狀檢視上方一列標題顯示 `sort: modified`，並在生效時附加 `filter: <text>` 與 `authors: <labels joined by comma>`。在篩選模式下，這列標題就變成輸入列，渲染成 `/ <text>▌`。這會多佔一列保留空間，`RESERVED_ROWS` 從而變成 5。

## Implementation Contract

**Behavior**

- 全新啟動：標題為 `sort: modified`；各群組的 changes 依 `modifiedAt` 遞減排序，`null` 排最後，同分以名稱決勝。
- `s` 依 `modified → name → created → modified` 循環，標題更新，不觸發掃描。
- 按 `/` 後輸入 `sea` 再 Enter：標題為 `sort: modified  filter: sea`，群組顯示 `Active (1/3)` 形式的計數，只留下名稱小寫後包含 `sea` 的 changes，其所有 artifact 仍完整列出。
- 按 `/` 後 Escape：篩選文字清空，計數回到 `Active (3)`。
- 候選項有兩個以上時按 `@`：挑選器取代樹狀欄位，以 `[x]`/`[ ]` 標記列出候選項；Space 切換，Enter 關閉。候選項少於兩個時，狀態列顯示 `No authors to filter by`，模式維持 `tree`。
- change 節點文字：`add-dark-mode fripig (3/8)`；沒有提出者時為 `add-dark-mode (3/8)`；沒有進度時為 `add-dark-mode fripig`。
- 在 change 或 artifact 節點按 `y`：剪貼簿收到的就是 change 名稱，狀態列顯示 `Copied: <name>`。
- `R` 保留排序模式、篩選文字，以及仍存在的作者選取。

**Interface / data shape**

```ts
type SortMode = "modified" | "name" | "created";
interface AuthorCandidate { id: string; label: string }       // id "__unknown__" ↔ label "Unknown"
interface FilterState { text: string; authors: ReadonlySet<string> }
interface FilteredSnapshot extends ScanSnapshot { totals: Record<ChangeGroup, number>; filtered: boolean }
function compareChanges(mode: SortMode): (a: SpectraChange, b: SpectraChange) => number
function matchesName(change: SpectraChange, text: string): boolean
function authorCandidates(snapshot: ScanSnapshot): AuthorCandidate[]
function matchesAuthors(change: SpectraChange, selected: ReadonlySet<string>): boolean
function filterSnapshot(snapshot: ScanSnapshot, filter: FilterState): FilteredSnapshot
```

**Failure modes**

- `y` 遇到剪貼簿失敗：狀態列顯示 `Copy failed: <name>`，其他一切不變。
- 候選項少於兩個時按 `@`：狀態列顯示 `No authors to filter by`，模式不變。
- 篩選文字沒有任何符合：三列群組顯示 `(0/N)` 計數且沒有子節點，游標停在群組列上。

**Acceptance criteria**

- `test/tui/change-order.test.ts` 驗證三個 change 的排序範例，以及兩種日期模式下「未知日期排最後」的規則。
- `test/tui/change-filter.test.ts` 驗證 spec 中六列的篩選文字／作者表格，以及六列的候選清單表格。
- `test/tui/App.test.tsx` 新增各按鍵（`s`、`/`、`@`、`y`）的案例、模式隔離（在篩選模式打 `q` 不會離開）、計數格式、提出者標籤，以及重新掃描的狀態保留。
- `npm test` 與 `npm run check-dist` 離開碼為 0。
- 手動：在本 repo 執行 `herdr plugin pane open --plugin spectra-viewer --entrypoint changes`，按兩次 `s`、輸入 `/core` 再 Enter，觀察標題與計數。

**Scope boundaries**

- In scope：proposal 列出的 `src/tui/` 檔案、其測試，以及 delta spec。
- Out of scope：discovery、Herdr adapter、manifest、README，以及任何 UI 狀態的持久化。

## Risks / Trade-offs

- [單鍵指令容易誤按，尤其是 `y` 與 `s`] → 兩者都可一鍵還原或本身無副作用（`s` 再循環回來，`y` 只寫剪貼簿），而且狀態列會說明剛剛發生什麼。
- [篩選模式吃掉 `q`，忘記自己在篩選模式的使用者無法用 `q` 離開] → 標題會把篩選列連同游標符號渲染出來，Escape 永遠能離開篩選模式，且篩選模式的狀態列會顯示 `Enter keep  Esc clear`。
- [不分大小寫的 `localeCompare` 排序可能因 Node ICU 版本而異] → Node 20 之後預設內建完整 ICU，測試會驗證 spec 的 `alice, Bob, Carol` 範例，一有差異就會直接失敗。
- [每次切換候選項，Ink 都會重繪整份挑選器清單] → 候選清單長度等於相異作者數，通常不到二十列。

## Migration Plan

沒有資料或 manifest 變更。以 `npm run build` 重新建置並重開 pane 就會套用新按鍵。

## Open Questions

無。按鍵配置（`s`、`/`、`@`、`y`）與核心 keymap 沒有衝突。
