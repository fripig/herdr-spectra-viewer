## 1. 進入點判斷

- [x] 1.1 新增 `src/entry-point.ts`，匯出單一判斷函式，實作決策「進入點判斷改用解析符號連結後的真實路徑」：輸入模組的 `import.meta.url` 與 `process.argv[1]`，把後者解析成真實路徑、以 `pathToFileURL` 轉成 URL 後比對；`argv[1]` 為 undefined 或真實路徑解析失敗時回傳 false 而不拋例外。驗收：新增 `test/entry-point.test.ts`，涵蓋直接路徑為 true、指向該檔的臨時符號連結為 true、路徑含空白為 true、指向另一個存在檔案為 false、不存在的路徑為 false、`argv[1]` 為 undefined 為 false 六個案例，全部通過。
- [x] 1.2 實作決策「進入點判斷抽成共用模組，兩個進入點共用」：`src/pane.tsx` 與 `src/open.ts` 各自的判斷式改為呼叫 1.1 的共用函式，`src/open.ts` 原本用樣板字串接 `file://` 的寫法一併移除。完成後滿足 requirement `Run the entry point when invoked through a symbolic link`：經由符號連結執行 pane 會實際繪製 TUI。驗收：`npm run typecheck` 回傳 0；`test/herdr/open.test.ts` 既有案例全綠；搜尋 `src/` 確認不再有任何自行組 `file://` 字串的位置。

## 2. 套件封裝

- [x] 2.1 在 `src/pane.tsx` 首行加入 interpreter 指示行，使編譯產出的 pane 檔第一行保留它，讓該檔可直接執行而不必前綴 `node`。驗收：`npm run build` 後 `head -1 dist/pane.js` 輸出該指示行。
- [x] 2.2 實作決策「套件名與 bin 名稱同名，並以 prepublishOnly 建置」：`package.json` 的 `name` 改為 `spectra-viewer`、移除 `private`、`bin` 宣告 `spectra-viewer` 與 `sv` 兩個名稱皆指向 pane 產出檔、`files` 設為只含編譯輸出目錄、新增 `prepublishOnly` 執行既有 build script（不使用 `prepare`）。驗收：`npm pack --dry-run` 的檔案清單除了套件 manifest、readme 與授權檔（npm 無條件納入、`files` 管不到）之外只含編譯輸出目錄下的檔案，無任何原始碼或測試檔。
- [x] 2.3 驗證 requirement `Publish the pane as a command-line program` 的端到端行為：`npm pack` 後在一個乾淨的臨時目錄安裝該 tarball，經由 `node_modules/.bin/spectra-viewer` 啟動，TUI 實際繪製並列出該目錄的變更。驗收：貼出該次執行的畫面輸出，其中包含分組列與按鍵提示列。

## 3. 不經 Herdr 的檢視路徑

- [x] 3.1 實作決策「檢視結果的 paneId 改為可為 null」：`ViewerResult` 成功變體的 `paneId` 型別放寬為可為 null，Herdr adapter 照舊回傳真實 pane id。驗收：`npm run typecheck` 回傳 0；`test/herdr/client.test.ts` 既有案例全綠。
- [x] 3.2 新增 `src/pager.ts`，實作決策「分頁器檢視由 render 層交出終端控制權」的可測部分：函式接受注入的 spawn 函式與 suspend/resume 一對，先 suspend、以 argv 陣列且不經 shell 啟動檢視器並繼承三個標準串流、等其結束後 resume，成功回傳不帶 pane 的成功結果、spawn 失敗或非零結束碼回傳失敗結果且 resume 仍被呼叫。同時實作決策「沿用既有的 viewer 解析鏈，不新增 PAGER 來源」：檢視指令沿用既有的 `resolveViewer`，不讀 `PAGER`。驗收：新增 `test/pager.test.ts`，斷言 argv 內容與 artifact 絕對路徑為獨立元素、stdio 為繼承、suspend 早於 spawn 且 resume 晚於行程結束、非零碼回報失敗且 resume 已執行、`PAGER` 設為其他值時仍解析為 `less`。
- [x] 3.3 在 render 層補上終端交接的實際動作：掛載時把 Ink 的 `setRawMode` 與 render instance 的 `clear` 註冊進可變參照，suspend 依序關閉滑鼠回報、清畫面、停止讀輸入，resume 反序還原並重畫。完成後滿足 requirement `Show an artifact in the terminal when Herdr is absent`。驗收：手動在無 Herdr 環境下對一個 artifact 按 `e`，分頁器接手整個終端顯示內容，離開後 TUI 重新繪製且方向鍵與滑鼠仍可操作；貼出操作結果描述。
- [x] 3.4 實作決策「依執行環境挑選檢視 adapter，App 不需要改」，滿足 requirement `Select the artifact viewer by the invocation environment`：在 `src/pane.tsx` 的組裝處依 invocation context 是否帶 Herdr binary path 注入 Herdr adapter 或分頁器 adapter，`src/tui/App.tsx` 不做任何修改。驗收：`test/tui/App.test.tsx` 既有案例全綠且該檔無需改動；新增一個組裝層測試，斷言 binary path 為 null 時選到分頁器 adapter、非 null 時選到 Herdr adapter。

## 4. spec 對齊與文件

- [x] 4.1 確認 requirement `Open an artifact in the editor` 的 delta 與實作一致：有 Herdr 時的 split、單一檢視 pane、ratio 計算與兩則狀態列文字逐項未變，沒有 Herdr 時走分頁器路徑。驗收：`npm test` 全綠，且逐條比對該 requirement 的 scenario 與 `test/tui/App.test.tsx`、`test/herdr/client.test.ts` 的對應案例，列出比對結果。
- [x] 4.2 在 `README.md` 補上獨立啟動的用法段落：`npx spectra-viewer` 的呼叫方式、專案根目錄取當前工作目錄、以及沒有 Herdr 時送指令會退回剪貼簿而按 `e` 走分頁器。驗收：README 含該段落，且其中的指令與 `package.json` 的 `bin` 名稱一致。
- [x] 4.3 全套驗證：`npm run typecheck`、`npm test`、`npm run check-dist` 三者皆回傳 0，`spectra validate publish-standalone-cli` 通過，`spectra analyze publish-standalone-cli` 無 Critical。驗收：貼出四項指令的實際輸出。
