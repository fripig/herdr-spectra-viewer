## 1. 共用的 viewer pane 記憶

- [x] 1.1 實作 Lift the remembered viewer pane into shared state：`AppDeps` 新增 `viewerPane: { current: string | null }`，App 開檔後改寫這個 holder 而非元件內部 ref，開檔成功寫入新 pane id、開檔失敗寫入回報帶回的 pane id 或 `null`；開檔的 close → split → run 順序與 status bar 訊息不變。驗證：`test/tui/App.test.tsx` 新增斷言——mount 後 holder 為 `null`，成功開檔後為新 pane id，第二次開檔時 `openEditor` 收到的 `previousViewerPane` 等於第一次的 id；`npx vitest run test/tui/App.test.tsx` 全綠。

## 2. 離開時關閉 viewer

- [x] 2.1 依「Provide a Spectra changes pane」實作 Close the viewer synchronously on every exit path 的 `viewerLifecycle(close, ref)`：`shutdown()` 對非 null 的 `ref.current` 呼叫一次 `close` 後把它設為 `null`，`ref.current` 為 null 時不呼叫，`close` 拋錯一律吞掉。驗證：`test/tui/mouse-lifecycle.test.ts` 新增四則測試（有值關一次並清空／null 不關／close 拋錯不外傳／連續兩次 shutdown 只關一次），`npx vitest run test/tui/mouse-lifecycle.test.ts` 全綠。
- [x] 2.2 在 pane 入口接上 `viewerLifecycle`：holder 由入口建立並傳給 App，正式 close 以 `execFileSync` 執行 Herdr binary、argv `["pane", "close", <paneId>]`、timeout 1000ms、stdio ignore，binary 路徑為 null 時不動作；`shutdown` 註冊到 `process.on("exit")`，訊號清單由 SIGINT、SIGTERM 擴充為含 SIGHUP，離開碼分別為 130、143、129。驗證：`npm run build` 通過，且 `npx vitest run` 全綠。
- [x] 2.3 依 Ignore the outcome of the close 確認離開路徑不因關閉失敗而改變行為：close 非零離開碼或拋錯時不寫 stderr、不改離開碼、不阻擋離開。驗證：`test/tui/mouse-lifecycle.test.ts` 中拋錯的那則測試同時斷言 `shutdown()` 正常返回且未拋出。

## 3. 文件與整體驗證

- [x] 3.1 README 的 Viewing an artifact 段落補上：關閉 changes pane 時連帶關掉 viewer pane，且外部關閉 pane 的情境是 best-effort。驗證：閱讀該段，確認與 spec 的離開路徑表格一致。
- [x] 3.2 執行 `npx vitest run` 與 `npm run build` 並貼出輸出；再以 `herdr plugin pane open --plugin spectra-viewer --entrypoint changes` 開 pane、開一個 artifact、送 `q`，用 `herdr pane list` 確認 plugin pane 與 viewer pane 都不在。驗證：貼出 pane list 前後對照。
