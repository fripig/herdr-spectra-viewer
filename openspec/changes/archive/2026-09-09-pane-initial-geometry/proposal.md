## Why

Herdr 0.9.0 用 `plugin pane open --placement split` 建立 plugin pane 時，新 pane 的 pty 沿用 split 前的尺寸，而且不會在建立當下 resize；真正的尺寸要等第一次 focus 轉換才送到進程。pane 因此用錯誤的寬高畫出第一幀：狀態列的快捷鍵提示被截在錯誤的欄寬（39 欄的 pane 裡截在 78 欄），frame 又比 viewport 高一列而把最上面一行捲掉。使用者必須把 focus 切走再切回來，畫面才會正確。

即使尺寸正確，狀態列的快捷鍵提示仍然是單行 `truncate-end`；九個提示在窄 pane 永遠放不下，後面幾個鍵（`R rescan`、`q quit`）從來沒被看到過。

## What Changes

- pane 啟動時不再只依賴 `process.stdout` 的寬高。當環境提供 `HERDR_PANE_ID` 且 Herdr 可執行時，先向 Herdr 查詢自己的 pane 幾何，用查到的值當作首幀尺寸。
- 查不到（沒有 pane id、Herdr 叫不動、輸出無法解析）時退回目前的 `process.stdout` 行為，不得讓 pane 開不起來。
- 查到之後仍照舊訂閱 stdout 的 resize 事件，後續尺寸變動維持現行行為。
- 狀態列的快捷鍵提示改為依實際寬度折行顯示，不再截斷，讓所有按鍵在任何寬度下都看得到。
- 樹的可用高度改為依狀態列實際佔用的行數計算，取代目前寫死的保留行數常數。

## Non-Goals (optional)

（design.md 會建立，範圍界線寫在該檔的 Goals/Non-Goals。）

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `herdr-plugin-packaging`: 新增啟動時向 Herdr 解析 pane 幾何的需求，以及查詢失敗時的退回行為。
- `changes-pane`: 新增快捷鍵提示必須完整顯示（折行而非截斷）的需求；修改樹的可用高度定義，使其依狀態列實際行數計算。

## Impact

- Affected specs: `herdr-plugin-packaging`, `changes-pane`
- Affected code:
  - Modified: `src/pane.tsx`, `src/herdr/client.ts`, `src/tui/App.tsx`, `src/tui/StatusBar.tsx`, `test/tui/frame-height.test.ts`, `test/herdr/client.test.ts`, `test/tui/App.test.tsx`
  - New: `src/tui/hint-layout.ts`, `test/tui/hint-layout.test.ts`
  - Removed: （無）
