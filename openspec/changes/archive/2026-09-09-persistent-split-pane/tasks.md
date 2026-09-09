## 1. open action 帶出右側 split

- [x] 1.1 依「The open action launches the pane」實作 The open action requests the split instead of the manifest：`openPaneArgs` 產生的 argv 加上 `--placement split --direction right`，不帶 `--target-pane`；`herdr-plugin.toml` 不動。驗證：`test/herdr/open.test.ts` 斷言完整 argv 為 `["plugin","pane","open","--plugin","spectra-viewer","--entrypoint","changes","--placement","split","--direction","right"]`，`HERDR_BIN_PATH` 未設時仍印出既有訊息並回離開碼 1；`npx vitest run test/herdr/open.test.ts` 全綠。

## 2. focus adapter

- [x] 2.1 依「Herdr adapter executes the Herdr binary without a shell」實作 Focus hand-back reuses the context's own pane id 的 `focusPane(client, { paneId })`：執行 argv `["pane","focus","--pane",paneId,"--direction","left"]`，離開碼 0 回 `{ ok: true }`，否則回 `{ ok: false, reason }` 並在 reason 指出離開碼，絕不拋例外；binary 路徑為 null 時不 spawn 直接回失敗。並從 `src/herdr/index.ts` 匯出。驗證：`test/herdr/client.test.ts` 斷言確切 argv、離開碼 0 的成功、離開碼 2 的失敗、null binary 不 spawn；`npx vitest run test/herdr/client.test.ts` 全綠。

## 3. 送出後保持開啟並交還焦點

- [x] 3.1 依「Send a Spectra command for the selected change」實作 Send keeps the pane open and reports in the status bar：`AppDeps` 新增 `focusPane`，送出成功分支不再呼叫 `onExit`，改為把狀態列設成 `Sent: <command text>` 後以 `context.paneId` 呼叫 `focusPane`；`paneId` 為 null 時不呼叫 adapter，焦點失敗或 null 都顯示 `Sent, but could not focus pane`；剪貼簿兩條分支不呼叫 `focusPane`、措辭不變。驗證：`test/tui/App.test.tsx` 依 spec 的「outcome per context and adapter result」表格五列各一則測試，並把既有那則「sends … to the invoking pane and exits」改寫成新契約（斷言 `onExit` 未被呼叫）；`npx vitest run test/tui/App.test.tsx` 全綠。
- [x] 3.2 依「Provide a Spectra changes pane」把正式的 `focusPane` 接到 `src/pane.tsx` 的 render 呼叫，並確認 `q`／Escape 是 App 內唯一觸發 `exit(0)` 的路徑。驗證：`grep -n "exit(" src/tui/App.tsx` 只出現在按鍵處理與 `exit` 輔助函式；既有的 q／Escape 離開測試仍通過；`npm run build` 通過。

## 4. 文件與整體驗證

- [x] 4.1 README 更新：說明 pane 以右側 split 開啟（placement 由 open action 指定、manifest 只是 fallback）、送出指令後 pane 保持開啟並顯示 `Sent: <command text>`、焦點回到工作 pane 可直接按 Enter，以及 `q`／Escape 是關閉方式。驗證：對照 `changes-pane` delta spec 逐條檢查 README 敘述與四則狀態列訊息一致。
- [x] 4.2 執行 `npx vitest run` 與 `npm run build` 並貼出輸出；再以 `herdr plugin link` 後從 open action 開啟 pane，在某個 change 上按 `a`，確認 split 保持開啟、狀態列 `Sent: …`、工作 pane 有文字且已取得焦點、按 Enter 可直接送出，最後按 `q` 確認 split 關閉。驗證：貼出 `herdr pane layout` 的並排座標與操作前後的 pane 清單。
