## Context

`src/pane.tsx` 的 `Sized` 元件用 `process.stdout` 的 `rows` 當首幀高度，並訂閱 stdout 的 `resize` 事件更新；寬度則由 ink 自己在重繪時讀取 `stdout.columns`。這套機制假設進程啟動時 pty 已經是 pane 的真實尺寸。

Herdr 0.9.0 不滿足這個假設。實測（2026-09-09，Herdr 0.9.0）：從 78 欄的 pane 呼叫 open action，新 plugin pane 的 rect 是 39x48，但首幀依 78 欄排版、frame 47 行；送一個按鍵強制 re-render 後仍是 78 欄，證明 pty 本身還是舊尺寸；做一次 focus 轉換後才變成 39 欄、frame 45 行。對照組（一般 shell pane 被 split 變窄）則是立刻收到新尺寸，所以問題只出在 Herdr 新建 plugin pane 的路徑上。

Herdr 自己知道正確答案：`herdr pane layout --pane <id>` 回報該 pane 的 `rect.width`，`herdr pane get <id>` 回報 `scroll.viewport_rows`。plugin 也已經有自己的 pane id（`InvocationContext.paneId`，來自 `HERDR_PANE_ID`）與執行 Herdr 的 client。

第二個問題與尺寸無關：`src/tui/StatusBar.tsx` 用 `wrap="truncate-end"` 畫單行快捷鍵提示，九個提示在窄 pane 放不下，`R rescan` 與 `q quit` 從來沒顯示過。

## Goals / Non-Goals

**Goals:**

- plugin pane 的第一幀就用正確的寬高排版，不需要使用者切換 focus。
- 快捷鍵提示在任何 pane 寬度都完整可見。
- 樹的可用高度與實際渲染出來的行數一致，frame 不超出 pane 高度。
- Herdr 查詢失敗時 pane 仍然開得起來，行為退回現況。

**Non-Goals:**

- 不修 Herdr 本身。新建 plugin pane 沒同步 pty 尺寸是 Herdr 端的缺陷，本變更只在 plugin 這側自保。
- 不改 viewer pane 的開啟、關閉或 focus 行為。
- 不改鍵盤綁定、排序、篩選、複製等既有互動。
- 不為 pane 尺寸新增設定項或環境變數覆寫。
- 不改 README 的按鍵表。

## Decisions

### 啟動尺寸向 Herdr 查詢，而不是向 pty 查詢

pty 在首幀當下就是錯的，所以任何「重讀 `process.stdout`」的做法都無效：實測按鍵強制 re-render 後讀到的仍是舊寬度。等 `resize` 事件也無效，因為在 focus 轉換之前根本不會有事件。唯一的真相來源是 Herdr。

考慮過但否決的替代方案：

- **輪詢 `process.stdout.columns`**：pty 值本身是舊的，輪詢多久都是同一個錯誤答案。
- **延後首幀繪製**：延後之後讀到的還是同一個舊值，只是多了一段空白畫面。
- **啟動時自己觸發 focus 轉換**：會搶走使用者的鍵盤焦點，副作用比問題本身嚴重。

### columns 取 layout 的 `rect.width`，rows 取兩個來源的較小值

寬度沒有爭議：`pane layout` 的 `rect.width` 從 pane 存在的那一刻就正確，與 pty 欄數一致（39 對 39、77 對 77）。

高度兩個來源各有一半問題，實測（2026-09-09，Herdr 0.9.0）：

- `pane get` 的 `scroll.viewport_rows` 是 pty 的行數，而 pty 正是那個過時的東西。新建的 plugin pane rect 高 24，`viewport_rows` 回報 48（沿用祖先 pane 的高度），要等 focus 轉換才變 22。
- `pane layout` 的 `rect.height` 建立當下就正確，但它是 pane 在版面上的高度，包含 Herdr 自己畫的 2 行外框。三個尺寸實測差距都是固定的 2：rect 48 對 22 之外的 46、rect 24 對 22、rect 12 對 10。

因此 rows 取 `min(viewport_rows, rect.height - 2)`。建立當下 stale 的 48 會被 `rect.height - 2` 壓成 22；pane 穩定之後兩者相等。這個取法有兩個好處：Herdr 日後若改成建立時就回報正確的 `viewport_rows`，程式自動跟上、不需要改；而 2 這個外框行數若有變動，偏差方向是算得比實際小（畫面少用一兩列），而不是 frame 溢出 pane。

兩個值分別來自 `pane layout --pane <id>` 與 `pane get <id>`，兩次呼叫並行、都在首幀之前完成；`resolveProjectRoot` 本來就已經在啟動路徑上執行 Herdr 子行程，量級一致。

### 查詢失敗一律靜默退回 `process.stdout`

沒有 `HERDR_PANE_ID`、Herdr 執行失敗、輸出不是預期的 JSON、或缺少對應欄位，都退回目前用 `process.stdout` 的行為。這條路徑涵蓋在 Herdr 之外執行 pane（例如測試或手動跑）的情況，不能因為查不到尺寸就讓 pane 開不起來，也不該把診斷訊息寫到 stdout 汙染畫面。

### 快捷鍵提示改為依寬度折行

提示改由一個純函式依可用寬度貪婪打包成多行，不再截斷。分隔符維持現行的兩個空白。單一提示本身就超過寬度時獨佔一行，由終端自行處理。送出指令那一行（`send to pane: ...`）用同一個函式折行，理由相同。

放進獨立模組而不是寫在 `StatusBar` 裡，是因為 `App` 也要用同一個結果來算樹高，兩邊必須看到同一個數字。

### 保留行數由實際渲染行數推導

`RESERVED_ROWS` 目前是常數 5。提示折行之後行數隨寬度變動，常數會讓樹高算錯、frame 超出 pane。改為由 header 行數加上狀態列實際行數計算。modal 模式（filter、authors）與 tree 模式的狀態列行數不同，計算必須跟著當下模式走，不能只算 tree 模式的情況。

## Implementation Contract

**Behavior**

- plugin pane 由 Herdr 開啟後，第一幀就以該 pane 的真實寬高排版：狀態列在 pane 底部、frame 行數不超過 pane 高度、快捷鍵提示依實際寬度折行且九個提示全部可見。使用者不需要切換 focus。
- 之後的尺寸變動（使用者調整分割、focus 轉換帶來的 resize）行為不變，仍由 stdout 的 `resize` 事件驅動。
- 在 Herdr 之外執行時（沒有 `HERDR_PANE_ID` 或 Herdr 不可用），pane 照常開啟，尺寸沿用 `process.stdout`。

**Interface / data shape**

- 新增一個由 Herdr client 取得 pane 幾何的非同步函式，輸入是 client 與 pane id，輸出是 `{ columns, rows }` 或 `null`。它執行 `pane layout --pane <id>` 取該 pane 的 `rect.width` 與 `rect.height`、執行 `pane get <id>` 取 `scroll.viewport_rows`，columns 用 `rect.width`，rows 用 `min(viewport_rows, rect.height - 2)`。
- 新增 `src/tui/hint-layout.ts`，匯出一個純函式把提示字串陣列依寬度打包成多行字串陣列，以及一個由當下輸入模式與寬度算出狀態列總行數的函式。
- `Sized` 接受一個可選的初始尺寸；未提供時維持現行的 `process.stdout` 取值。
- `App` 的樹高改由 pane 高度扣掉 header 行數與狀態列行數得出。

**Failure modes**

- Herdr 查詢的任何失敗都回傳 `null`，不丟例外、不寫 stderr、不顯示在狀態列。呼叫端退回 `process.stdout`。
- `pane layout` 的回應中找不到自己的 pane id、缺 `rect.width` 或 `rect.height`、或 `pane get` 缺 `scroll.viewport_rows` 時，同樣視為失敗。
- 兩次查詢只要有一次失敗就整體退回 `process.stdout`，不混用一半查到的值與一半 pty 的值。

**Acceptance criteria**

- `npm test`、`npm run typecheck`、`npm run check-dist` 全數通過。
- 折行函式的單元測試涵蓋：寬度足以放下全部提示時只有一行；寬度不足時分成多行且不遺漏任何提示；單一提示長過寬度時獨佔一行；寬度為 0 或負數時不進入無窮迴圈。
- 幾何查詢的單元測試涵蓋：`viewport_rows` 為過時的大值時高度取 `rect.height - 2`；pane 穩定時兩個來源相等；pane id 不在 layout 中回傳 `null`；任一次查詢非零結束回傳 `null`；輸出不是 JSON 回傳 `null`；缺 `rect.height` 或 `scroll.viewport_rows` 回傳 `null`。
- `App` 的測試涵蓋：在窄寬度下渲染時，`q quit` 出現在畫面上；frame 的行數等於傳入的 height，不因提示折行而超出。
- 真實 Herdr 驗收：從一個寬度會被對半分割的 pane 開啟 plugin pane，在**不做任何 focus 轉換**的情況下讀取畫面，狀態列的最後一個提示 `q quit` 可見，且 `herdr pane get` 回報的 `scroll.max_offset_from_bottom` 為 0（frame 沒有被捲掉）。

**Scope boundaries**

- 範圍內：`src/pane.tsx` 的啟動尺寸解析、`src/herdr/client.ts` 的幾何查詢、`src/tui/hint-layout.ts` 的折行、`src/tui/StatusBar.tsx` 的多行渲染、`src/tui/App.tsx` 的樹高計算，以及對應測試。
- 範圍外：Herdr 本身的修正、viewer pane 行為、鍵盤綁定與既有互動、README、以及任何新的設定項。

## Risks / Trade-offs

- **啟動多兩次 Herdr 子行程呼叫，首幀變慢** → 兩次呼叫與既有的 `resolveProjectRoot` 同一量級（各約 10–30 ms），且都在首幀之前完成，不會造成畫面閃動。若日後 Herdr 提供單一查詢可取得兩個值，再合併為一次。
- **`rect.height` 與 `viewport_rows` 之間的 2 行差距是觀察值，不是 Herdr 的公開契約** → 無法迴避：`viewport_rows` 在最需要它的時刻（pane 剛建立）是過時的，實測回報 48 而實際是 22。取兩者較小值把這個觀察值的風險限制在「畫面少用幾列」，不會變成 frame 溢出 pane；Herdr 若把外框改成別的行數，只有在同時仍未修好 `viewport_rows` 的情況下才會偏差。
- **Herdr 未來修好 pty 尺寸後，這段查詢就成了多餘** → 查詢結果與 pty 一致時行為完全相同，不會造成錯誤；屆時可以移除，不需要現在預留開關。
- **提示折行會吃掉樹的可用行數** → 在很窄的 pane，提示可能佔到三行。這是使用者選擇的取捨：寧可少看兩行樹，也要看得到全部按鍵。
