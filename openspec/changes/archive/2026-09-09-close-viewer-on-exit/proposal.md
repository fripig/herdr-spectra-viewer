## Why

changes pane 關掉以後，它開出來的 viewer pane 會留在畫面上。使用者按 `q` 離開、或按指令鍵送出後自動離開，都會多留一個跑著 `less` 的 pane 要手動收拾。viewer pane 只在使用者自己結束 viewer 時才會自己消失。

實測（Herdr 0.9.0，workspace `w4`）：

```
開啟 artifact 後 → panes: w4:p1T (plugin), w4:p1V (viewer)
對 w4:p1T 送 q  → panes: w4:p1V 仍在
```

## What Changes

- pane 的每一條離開路徑（`q`、Escape、送出指令後離開、SIGINT、SIGTERM、SIGHUP）在行程結束前都會關掉記住的 viewer pane。
- 記住的 viewer pane id 從 App 元件內部的 ref 提升成 pane 入口與元件共用的狀態，離開路徑才讀得到。
- 關閉採同步 best-effort：結果一律忽略（含 pane 已消失的 not-found），不影響離開碼，也不做存活探測。
- 新增 SIGHUP 處理：Herdr 從外部關掉 pane 時送的就是 SIGHUP，實測約 200ms 後強制終止，因此只能同步搶關。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `changes-pane`: 離開路徑除了關閉滑鼠回報，還要關掉記住的 viewer pane，並多涵蓋 SIGHUP。

## Impact

- Affected specs: `changes-pane`
- Affected code:
  - Modified:
    - src/pane.tsx
    - src/tui/App.tsx
    - test/tui/mouse-lifecycle.test.ts
    - test/tui/App.test.tsx
    - README.md
  - New: （無）
  - Removed: （無）
