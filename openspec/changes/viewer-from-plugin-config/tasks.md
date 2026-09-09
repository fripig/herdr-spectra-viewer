## 1. 讀取 plugin 設定檔

- [x] 1.1 新增 `src/config.ts`，匯出一個函式：給它環境變數集合、一個同步讀檔函式與一個 `warn` callback，它回傳設定檔裡去除前後空白後的 `viewer` 字串，或在取不到時回傳 `null`。取不到的情況為 `HERDR_PLUGIN_CONFIG_DIR` 未設定或為空、讀檔擲錯、內容不是合法 JSON、頂層不是物件、沒有 `viewer` 欄位、`viewer` 不是字串、`viewer` 去除空白後為空。其中內容不合法 JSON、頂層不是物件、`viewer` 不是字串、`viewer` 去除空白後為空這四種會呼叫 `warn` 恰好一次，其餘三種不呼叫。驗證：`test/config.test.ts` 全數通過。
- [x] 1.2 新增 `test/config.test.ts`，以參數化表格逐列覆蓋 design 的「configuration file outcomes」八列，每列同時斷言回傳值與 `warn` 的呼叫次數，且測試不觸碰真實檔案系統（讀檔函式由測試注入）。驗證：`npx vitest run test/config.test.ts` 全綠。

## 2. 把設定檔接進 viewer 解析

- [x] 2.1 `src/pane.tsx` 的 `resolveViewer` 改為同時接受環境變數與設定檔字串兩個來源，並依「環境變數去空白後非空 > 設定檔字串 > `DEFAULT_VIEWER`」決定結果，回傳型別維持 `string`。驗證：`test/tui/viewer.test.ts` 全數通過。
- [x] 2.2 `main()` 在決定 viewer 之前先讀設定檔，把結果交給 `resolveViewer`，`warn` 沿用 `src/herdr/context.ts` 中寫入 stderr 的既有預設形式；設定檔任何失效都不改變 pane 啟動流程與行程結束碼。驗證：`node dist/pane.js` 在設定檔內容為壞掉的 JSON 時仍能開起 pane，且 stderr 出現一行提示。
- [x] 2.3 擴充 `test/tui/viewer.test.ts` 的參數化表格，逐列覆蓋 `Open an artifact in the editor` requirement 的「resolved viewer command」十列，其中必須包含環境變數與設定檔同時有值時環境變數勝出的那一列。驗證：`npx vitest run test/tui/viewer.test.ts` 全綠。

## 3. 文件

- [x] 3.1 README 的 Viewing an artifact 一節說明設定檔的完整路徑、JSON 格式範例與三層優先序，並點名設定成未安裝的命令會讓 viewer pane 直接消失、建議先在終端機跑一次確認。驗證：內容審閱，且與 delta spec 的優先序敘述一致。

## 4. 驗證

- [x] 4.1 在 `~/.config/herdr/plugins/config/spectra-viewer/config.json` 寫入 `{ "viewer": "frogmouth" }`、且環境沒有 `SPECTRA_VIEWER` 的情況下開啟 plugin pane 並在 artifact 上按 Enter，viewer pane 跑的是 frogmouth。驗證：`herdr pane get` 顯示的 terminal title 含 frogmouth，且該 pane 以 `Ctrl+Q` 結束後被回收。
- [x] 4.2 `npm test` 全綠、`spectra validate` 結束碼為 0。驗證：兩個指令的實際輸出。
