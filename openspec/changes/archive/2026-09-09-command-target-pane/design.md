## Context

Plugin pane 有兩種啟動路徑：

1. 在既有 pane 裡直接執行 pane 入口（早期用法）。此時 `HERDR_PANE_ID` 就是使用者操作的那個 pane，指令送回去剛好正確。
2. 透過 plugin action / 快速鍵。Herdr 會**新開一個 plugin pane** 來跑入口程式，`HERDR_PANE_ID` 變成 plugin 自己的 pane，叫起它的 pane 只出現在 `HERDR_PLUGIN_CONTEXT_JSON` 的 `focused_pane_id`。

目前程式碼只有一個 `paneId` 欄位，同時被拿去做兩件事：切 viewer split 的來源 pane，以及送指令的目標 pane。在路徑 2 下後者是錯的。

實測 Herdr 0.9.0 的 `HERDR_PLUGIN_CONTEXT_JSON`（`ps eww` 取得，已略去不相關鍵）：

```json
{"workspace_id":"w4","workspace_cwd":"/path/to/herdr-spectra-viewer",
 "tab_id":"w4:t1","focused_pane_id":"w4:p1","focused_pane_cwd":"...",
 "focused_pane_agent":"claude","invocation_source":"api"}
```

同一份資料也證實鍵是扁平的，不是現有解析假設的 `{"workspace":{"cwd":...}}`。

## Goals / Non-Goals

**Goals:**

- 指令鍵送出的 `/spectra-*` 文字，在兩種啟動路徑下都送到使用者原本操作的 pane。
- context JSON 解析支援 Herdr 0.9.0 實際輸出的扁平鍵。
- viewer split 的行為完全不變。

**Non-Goals:**

- 不改 manifest 的 `placement`（維持 overlay）。
- 不改五個指令鍵的對應、指令文字格式、狀態列訊息文字。
- 不處理 plugin pane 自己再叫起一次 plugin action 的巢狀情境；該情境會落到既有的送出失敗 → 剪貼簿 fallback。
- 不使用 `focused_pane_cwd`、`focused_pane_agent` 等其他 context 欄位。

## Decisions

### Split the invocation context into an own pane and a command target pane

`InvocationContext` 保留現有的 `paneId`（自己的 pane，來源 `HERDR_PANE_ID`），新增 `commandPaneId`（指令目標）。`commandPaneId` 取 context JSON 的 `focused_pane_id`（非空字串時），否則退回 `paneId`；兩者都沒有時為 `null`。

為什麼不直接把 `paneId` 改成 focused pane：`paneId` 還被 viewer split（`pane split --pane <id>`）和 project root fallback（`pane get <id>`）使用，那兩處要的就是自己的 pane。混用同一個欄位正是這個 bug 的成因，所以用兩個名字明確分開。

替代方案：在 `App.tsx` 內就地讀環境變數挑 pane。否決，因為環境變數解析集中在 context 模組是既有慣例，散開後測試也難寫。

### Parse the flat context JSON keys Herdr actually emits

`workspace_cwd` 先讀，找不到才讀巢狀的 `workspace.cwd`。保留巢狀分支是為了不讓既有 spec 情境與測試失效，成本只有一個 fallback。

替代方案：只支援扁平鍵。否決，因為無法確認舊版 Herdr 或其他呼叫端是否還送巢狀格式，多一個 fallback 沒有代價。

### Send commands to the command target pane

`sendCommand` 改讀 `context.commandPaneId`。有值就送、送成功後照舊 `exit(0)`；沒有值走「Copied: …」剪貼簿路徑；送出失敗走「Herdr send failed, copied instead」。三條路徑的訊息文字與是否關閉 pane 都不變，只有目標 pane 換了。

## Implementation Contract

**Behavior**

- 用快速鍵開啟 pane、游標停在某個 change、按 `a`：`/spectra-apply <change>` 出現在原本那個 agent pane 的輸入列（不送出），plugin pane 關閉、focus 回到該 pane。`d`/`i`/`r`/`c` 同理。
- 在 agent pane 裡直接執行 pane 入口（context JSON 未設）時，行為與現在完全相同。
- 開啟 artifact 仍然是從 plugin 自己的 pane 往右切一個 viewer pane；`pane split --pane <id>` 帶的 id 不變。

**Interface / data shape**

- `InvocationContext` 欄位：`projectRoot`、`projectRootFromContext`、`paneId`、`commandPaneId`、`herdrBin`。
- `commandPaneId` 解析規則：context JSON 的 `focused_pane_id` 為非空字串 → 用它；否則 → `paneId`（其本身可能為 `null`）。
- `projectRoot` 解析順序：context JSON 的 `workspace_cwd`（非空字串）→ 巢狀 `workspace.cwd`（非空字串）→ 行程工作目錄。JSON 無法解析時照舊寫一行 stderr 警告並退回工作目錄。
- `openInEditorSplit` 的參數與回傳型別不變。

**Failure modes**

- `commandPaneId` 為 `null`：不呼叫 adapter，寫剪貼簿，狀態列 `Copied: <command text>`，pane 保持開啟。
- adapter 回報失敗：寫剪貼簿，狀態列 `Herdr send failed, copied instead`，pane 保持開啟。
- 剪貼簿也失敗：狀態列 `Copy failed: <command text>`。
- context JSON 有 `focused_pane_id` 但那個 pane 已消失：由 adapter 的非零離開碼變成上面的送出失敗路徑，不另外做存活探測。

**Acceptance criteria**

- `npx vitest run` 全綠（既有偶發失敗的 `expands parked with Right` 不在此列，見 Risks）。
- context 測試涵蓋 spec 中 command target pane 與 project root 兩張 Example 表格的每一列。
- App 測試斷言按 `a` 時 adapter 收到的是 `commandPaneId` 而非 `paneId`，且兩者不同時仍送到前者。
- 手動驗證：以 `prefix+shift+s` 開啟 pane，按 `a`，指令出現在原本的 Claude pane。

**Scope boundaries**

- In scope：`src/herdr/context.ts` 的 context 解析、`src/tui/App.tsx` 的 `sendCommand` 目標、`src/pane.tsx` 傳遞、對應測試、README 說明。
- Out of scope：manifest placement、viewer split 行為、指令鍵集合與文字、既有偶發失敗測試的修復。

## Risks / Trade-offs

- [`focused_pane_id` 在某些呼叫路徑可能不存在] → 解析時退回 `HERDR_PANE_ID`，等同今日行為，不會比現況更糟。
- [目標 pane 在使用者按鍵前已被關閉] → adapter 非零離開碼觸發剪貼簿 fallback，指令不會遺失。
- [`App.test.tsx` 的 `expands parked with Right` 既有偶發失敗] → 已在前兩個 change 記錄為既存問題（於乾淨 worktree 重現過），本次不處理，驗證時以其餘測試為準。
