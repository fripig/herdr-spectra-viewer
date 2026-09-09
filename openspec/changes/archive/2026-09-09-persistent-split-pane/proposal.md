## Why

changes pane 是 overlay，所以把 Spectra 指令寫進工作 pane 之後，plugin 必須離開才不會擋住畫面。使用者送出一個指令後若還想繼續瀏覽或再送一個，每次都得重開 pane。2026-09-09 的討論得到的結論是：讓 pane 保持開啟只有在它不再覆蓋工作 pane 時才有意義，因此 placement 與離開行為必須一起改。

原本卡住這個 change 的兩個未知數，已於 2026-09-09 實測解答（記錄於 design.md 的 Context）：split placement 可以由 open action 直接指定，不必改 manifest；`pane focus` 帶明確 pane id 可以把焦點從 plugin pane 移回工作 pane。此外，`command-target-pane`（已歸檔）已經讓 invocation context 同時帶有 plugin 自己的 pane 與工作 pane 兩個 id，本 change 不必再新增欄位。

## What Changes

- open action 改成執行 `plugin pane open --plugin <id> --entrypoint changes --placement split --direction right`，讓 pane 以右側 split 開啟、與工作 pane 並排常駐。manifest 維持 `placement = "overlay"` 不動。
- `send-text` 成功之後不再離開，plugin pane 保持開啟，狀態列顯示 `Sent: <command text>`，並把鍵盤焦點交還工作 pane，使用者可以直接按 Enter。
- 在 Herdr client 新增 `focusPane` adapter 呼叫，執行 `pane focus --pane <paneId> --direction left`；失敗時 pane 仍保持開啟，並回報 `Sent, but could not focus pane`，讓使用者知道要自己切 pane。
- `q` 與 Escape 仍是關閉 pane 的唯二方式，剪貼簿 fallback 的各條路徑完全維持原樣。

## Non-Goals (optional)

（記錄於 design.md 的 Goals / Non-Goals 一節。）

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `changes-pane`：送出成功後 pane 不再離開；改為在狀態列回報並把焦點交還工作 pane。
- `herdr-plugin-packaging`：open action 帶上 split placement 參數；Herdr adapter 新增 focus 呼叫。

## Impact

- Affected specs: `changes-pane`（modified）、`herdr-plugin-packaging`（modified）
- Affected code:
  - New: （無）
  - Modified:
    - src/open.ts
    - src/herdr/client.ts
    - src/herdr/index.ts
    - src/tui/App.tsx
    - src/pane.tsx
    - test/herdr/open.test.ts
    - test/herdr/client.test.ts
    - test/tui/App.test.tsx
    - README.md
  - Removed: （無）
- Dependencies: 不新增任何相依。使用 Herdr 0.9.0 已具備且已實測的功能：`plugin pane open --placement split --direction right` 與 `pane focus --pane <id> --direction left`。
- 與其他 change 的互動：`mouse-support`、`viewer-pager`、`single-viewer-pane`、`command-target-pane`、`close-viewer-on-exit` 均已歸檔，不再有檔案衝突。已 park 的 `herdr-spectra-pane-actions` 新增一列標題，不涉及送出或離開行為。
