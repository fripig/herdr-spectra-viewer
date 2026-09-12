## 1. 命令列參數面

- [x] 1.1 新增 `src/cli-args.ts`，以「參數解析獨立成純函式模組」的形式提供解析函式：吃 `process.argv` 去掉前兩個元素後的字串陣列，回傳「照常執行／印使用說明／印版本／參數錯誤」四變體的帶標籤聯集；不觸碰檔案系統、不讀環境變數、不印任何東西、不呼叫 `process.exit`。驗證：`test/cli-args.test.ts` 中「空參數列回傳照常執行、檢視器為 null、警告陣列為空」的案例通過。
- [x] 1.2 依「只提供三個長格式選項，不提供短別名」實作 `--viewer` 的兩種值形式（空白分隔與等號），值去除前後空白，重複出現時以最後一次為準；`-h` 與 `-v` 不被接受，落入未知旗標。驗證：`test/cli-args.test.ts` 依 standalone-cli spec 的「viewer command per argument list」範例表逐列展開的案例全數通過。
- [x] 1.3 依「取不到值的 --viewer 警告後跳過，不中止啟動」實作三種無效值：後面沒有元素、值為空字串、值只有空白；三者都回傳照常執行、檢視器為 null，並附帶恰好一行警告文字。驗證：`test/cli-args.test.ts` 三個對應案例通過，且斷言回傳的警告陣列長度為 1。
- [x] 1.4 依「未知旗標與位置參數以使用說明拒絕並結束」實作參數錯誤變體，訊息含該參數原文。驗證：`test/cli-args.test.ts` 中 `--bogus`、`openspec`、以及 `--viewer bat --style=plain` 三個案例都回傳參數錯誤，且訊息分別含 `--bogus`、`openspec`、`--style=plain`。
- [x] 1.5 在 `src/cli-args.ts` 加入使用說明常數（用法一行、三個選項各一行、四層來源順序、帶旗標命令須整體加引號的說明、以及不接受位置參數且專案根目錄取自當前工作目錄），並實作「--help 與 --version 在渲染前印出並結束」所需的固定優先序：`--help` 勝過 `--version`，兩者都勝過參數錯誤。驗證：`test/cli-args.test.ts` 中 `--help --version`、`--version --help`、`--help --bogus` 三個案例都回傳印使用說明，另斷言使用說明文字含三個選項名稱與 `SPECTRA_VIEWER`。
- [x] 1.6 依「--version 由套件的 package.json 讀取」實作版本讀取函式：以模組自身 URL 往上一層定位 `package.json`，接受注入的讀檔函式，成功時回傳 `version` 字串，讀取失敗或 `version` 非字串時擲錯。驗證：`test/cli-args.test.ts` 三個案例通過 —— 成功時回傳值與 `package.json` 實際版本相同、讀檔擲錯時向外擲出、`version` 為數字時擲出。

## 2. 四層檢視器解析順序

- [x] 2.1 依「旗標是第四個來源，四層順序集中在 resolveViewer」把 `resolveViewer` 的簽章改為單一具名來源物件（欄位 `flag`、`env`、`configured`，後兩者可省略），旗標為最高優先來源且同樣去除前後空白後才判斷是否為空。驗證：`test/tui/viewer.test.ts` 依 changes-pane spec 的「resolved viewer command」範例表十六列逐列展開改寫後全數通過。
- [x] 2.2 改寫 `test/pager.test.ts` 裡兩個 `resolveViewer` 案例以符合新簽章，維持「`PAGER` 不是來源」與「`SPECTRA_VIEWER` 勝過 `PAGER`」兩項斷言不變。驗證：`npx vitest run test/pager.test.ts` 全綠。

## 3. 接進啟動流程

- [x] 3.1 在 `main()` 最前面結算參數面 —— 早於讀取呼叫環境、解析專案根目錄、開啟滑鼠回報與 `render` —— 使 `Accept options on the command line` 成立：使用說明與版本印到標準輸出後以狀態碼 0 結束，參數錯誤兩行印到標準錯誤後以 2 結束，`--viewer` 的警告印到標準錯誤後照常啟動。驗證：以編譯輸出在管線中實測 `--help`、`--version`、`--bogus` 三條命令，貼出各自輸出與緊接的狀態碼。
- [x] 3.2 把解析出的檢視器命令接進 `resolveViewer` 的 `flag` 欄位，使 `Open an artifact in the editor` 的四層順序在 Herdr 分割 pane 與獨立執行接管終端機兩條路徑上都成立。驗證：以偽終端機帶 `--viewer 'head -3'` 啟動並按開啟鍵，貼出狀態列顯示 `Opened in head -3` 的實際擷取畫面。

## 4. 文件

- [x] 4.1 `README.md` 的檢視器設定一節改寫為先列四層來源順序、並把 `--viewer` 記錄為最高優先來源，補上獨立執行的設定段落（現有內容整段以 Herdr 外掛為前提，會把獨立執行的使用者導向 `herdr plugin config-dir`），並寫出帶旗標的檢視器命令必須整體加引號。驗證：內容審閱 —— 逐項對照 changes-pane spec 的四層順序、`EDITOR` 不被讀取的說明、以及引號規則。
- [x] 4.2 `README.md` 記錄 `--help` 與 `--version`：兩者印完即結束、不進入 TUI、因此在管線中也能用，並列出未知旗標與位置參數會以狀態碼 2 被拒絕。驗證：內容審閱 —— 對照 standalone-cli spec 的「outcome per argument list」範例表，確認文件敘述與表中每一種結果一致。

## 5. 收尾驗證

- [x] 5.1 整份程式庫的型別檢查與測試全綠。驗證：貼出 `npm run typecheck` 與 `npx vitest run` 的完整輸出，兩者皆無失敗。
