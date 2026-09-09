## 1. Invocation context

- [x] 1.1 依「Resolve the invocation context from the environment」實作 Split the invocation context into an own pane and a command target pane：`InvocationContext` 新增 `commandPaneId`，值為 context JSON 的 `focused_pane_id`（非空字串）否則退回 `paneId`；`paneId` 維持 `HERDR_PANE_ID`。驗證：`test/herdr/context.test.ts` 以 table-driven 測試涵蓋 spec 的 command target pane 表格五列（`focused_pane_id` 有值／缺少／空字串／`HERDR_PANE_ID` 未設有 focused／兩者皆無 → null），`npx vitest run test/herdr/context.test.ts` 全綠。
- [x] 1.2 實作 Parse the flat context JSON keys Herdr actually emits：`projectRoot` 先讀扁平的 `workspace_cwd`，非空字串才採用，否則讀巢狀 `workspace.cwd`，都沒有則用行程工作目錄；JSON 解析失敗仍寫一行 stderr 警告。驗證：`test/herdr/context.test.ts` 涵蓋 spec 的 project root 表格六列（扁平／巢狀／空字串／空 workspace／非 JSON 有警告／未設），`npx vitest run test/herdr/context.test.ts` 全綠。

## 2. 指令送出目標

- [x] 2.1 依「Send a Spectra command for the selected change」實作 Send commands to the command target pane：`AppDeps` 取用 `context.commandPaneId` 作為 `sendText` 的目標 pane，成功後仍 `exit(0)`；`commandPaneId` 為 null 時走剪貼簿並顯示 `Copied: <command text>`，adapter 失敗時顯示 `Herdr send failed, copied instead`，剪貼簿也失敗時顯示 `Copy failed: <command text>`。驗證：`test/tui/App.test.tsx` 新增一則測試，context 為 `paneId: "w4:p1C"`、`commandPaneId: "w4:p1"` 時按 `a`，斷言 `sendText` 收到的是 `w4:p1` 且未曾以 `w4:p1C` 呼叫；既有三條 fallback 測試改用 `commandPaneId` 後仍全綠。
- [x] 2.2 確認 viewer split 仍以 plugin 自己的 pane 為來源：`openInEditorSplit` 的 `paneId` 參數維持 `context.paneId`，型別與呼叫序列不變。驗證：`npx vitest run` 中 `test/herdr/client.test.ts` 既有斷言（`pane split --pane` 帶自己的 pane id）不需修改即通過。

## 3. 文件與整體驗證

- [x] 3.1 README 的 Keys and mouse 段落補上指令鍵送往「叫起 pane 的那個 pane」而非 plugin 自己的 pane，並說明找不到目標 pane 時退回剪貼簿。驗證：閱讀 README 該段，確認描述與 spec 的三條 fallback 訊息一致。
- [x] 3.2 執行 `npx vitest run` 與 `npm run build`，記錄結果；除既有偶發失敗的 `expands parked with Right` 外皆須通過。驗證：貼出實際輸出，並以 `herdr plugin pane open --plugin spectra-viewer --entrypoint changes` 手動確認按 `a` 後指令出現在原本的 agent pane。
