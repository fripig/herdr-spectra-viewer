## Why

用快速鍵（`plugin_action`）開啟 pane 時，Herdr 會另外開一個 plugin pane，`HERDR_PANE_ID` 指向的是 plugin 自己那個 pane，而不是使用者原本操作的 agent pane。目前 `d`/`a`/`i`/`r`/`c` 五個指令鍵是把指令文字送給 `HERDR_PANE_ID`，等於送回自己，接著 pane 就 `exit(0)` 關閉，指令因此完全消失，也不會退回剪貼簿。

實測（`ps eww` 讀 plugin pane 進程環境變數）：

```
HERDR_PANE_ID=w4:p1C
HERDR_PLUGIN_CONTEXT_JSON={"workspace_id":"w4","workspace_cwd":"/path/to/herdr-spectra-viewer",
  "focused_pane_id":"w4:p1","focused_pane_cwd":"...","focused_pane_agent":"claude", ...}
```

`w4:p1` 才是叫起 plugin 的 Claude pane。同一份實測也顯示，Herdr 0.9.0 給的 context JSON 是**扁平鍵**（`workspace_cwd`），而現有解析程式找的是巢狀的 `workspace.cwd`，所以 project root 一直落在 fallback 的行程工作目錄，只是目前兩者剛好相同才沒有出錯。

## What Changes

- invocation context 新增「指令目標 pane」欄位，與「自己的 pane」分開：目標優先取 context JSON 的 `focused_pane_id`，沒有時退回 `HERDR_PANE_ID`。
- 五個指令鍵改成送到指令目標 pane；剪貼簿 fallback 的觸發條件改為「沒有指令目標 pane」或「送出失敗」，訊息文字不變。
- context JSON 解析改為先讀扁平鍵 `workspace_cwd`，找不到才讀巢狀的 `workspace.cwd`，兩種格式都支援。
- 開啟 artifact 的 viewer split 維持使用自己的 pane（`HERDR_PANE_ID`），行為不變。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `herdr-plugin-packaging`: invocation context 多一個指令目標 pane 欄位，且 context JSON 支援 Herdr 0.9.0 的扁平鍵格式。
- `changes-pane`: 指令鍵送出的目標由「自己的 pane」改為「指令目標 pane」。

## Impact

- Affected specs: `herdr-plugin-packaging`, `changes-pane`
- Affected code:
  - Modified:
    - src/herdr/context.ts
    - src/tui/App.tsx
    - src/pane.tsx
    - test/herdr/context.test.ts
    - test/tui/App.test.tsx
    - README.md
  - New: （無）
  - Removed: （無）
