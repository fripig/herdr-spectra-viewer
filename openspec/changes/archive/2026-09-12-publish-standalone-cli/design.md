## Context

這個 plugin 目前只有一條啟動路徑：Herdr 依 `herdr-plugin.toml` 以 `node dist/pane.js` 啟動 pane。但程式本身早就不需要 Herdr——`readInvocationContext` 在環境變數全缺時會退回 `process.cwd()` 當專案根目錄，`createHerdrClient(null)` 的每次呼叫都直接回報失敗而不 spawn 任何東西，送指令失敗時 `App` 會退回剪貼簿。實測 `node dist/pane.js` 在任意專案目錄可正常列出變更並操作。

缺的是兩件事。一是封裝：`package.json` 標著 `"private": true`、沒有 `bin`、`dist/` 在 gitignore，任何人都裝不到。二是一個會讓封裝白做的既有缺陷：`isEntryPoint` 拿 `process.argv[1]` 直接和 `import.meta.url` 比對，而 npm 在 `node_modules/.bin/` 建立的是符號連結。實測 probe 證實 `argv[1]` 是連結路徑、`import.meta.url` 是解析後的真實路徑，比對必然為 false，於是 `main()` 不執行、行程以 0 正常結束、終端上沒有任何輸出，連錯誤訊息都沒有。

沒有 Herdr 時唯一真正缺功能的操作是按 `e` 檢視 artifact：現行實作只會叫 Herdr 開右側 split pane 跑分頁器，binary path 為 null 時 adapter 直接回報失敗，狀態列顯示 `Could not open viewer`。

約束：Ink 佔用終端與 stdin，分頁器要在同一個終端執行就必須先把控制權交出去再收回。專案沒有既有的行程互動模組，所有 Herdr 呼叫都是「spawn、等結束、讀 stdout」的一次性模式。

## Goals / Non-Goals

**Goals:**

- 任何人可用 `npx spectra-viewer` 在任意專案目錄啟動 viewer，不需要 Herdr、不需要 clone、不需要自行建置。
- 經由符號連結執行時 `main()` 會真的執行——涵蓋 `node_modules/.bin/`、`npm link`、使用者自建的 symlink。
- 沒有 Herdr 時按 `e` 能實際看到 artifact 內容。
- Herdr 外掛路徑的行為逐項不變：manifest、建置流程、pane 與 action 啟動、有 Herdr 時的右側 split pane 檢視與其 ratio 計算。

**Non-Goals:**

- 不把 `src/discovery/` 抽成共享 package 給 `vscode-spectra-viewer` 用。那是另一個軸的決策，等該專案真的要動工再評估。
- 不在 TUI 內自建 artifact 檢視器（可捲動的文字檢視元件）。分頁器已經解決這件事，自建等於重寫 `less`。
- 不改變 viewer 指令的解析來源集合，也就是不新增 `PAGER` 這個來源（理由見決策）。
- 不加 CLI 參數解析（`--help`、`--version`、指定專案路徑）。目前專案根目錄就是 `process.cwd()`，這條路徑已經夠用。
- 不真的執行 `npm publish`。本變更只讓套件處於可發佈狀態，按下發佈是人的決定。

## Decisions

### 進入點判斷改用解析符號連結後的真實路徑

`import.meta.url` 永遠是模組解析後的真實路徑；`process.argv[1]` 是使用者給的路徑，經由 npm bin 連結執行時就是那個連結本身。兩者要能比對，必須先把 `argv[1]` 解析成真實路徑，再轉成 file URL 比對。

轉換一律用 `pathToFileURL`，不用字串拼接。`src/open.ts` 現在寫的是樣板字串接 `file://`，那沒有做 percent-encoding，路徑含空白、`#` 或 `?` 就會產出錯誤的 URL 而比對失敗——即使不經符號連結也會壞。

真實路徑解析失敗（`argv[1]` 指向不存在的路徑）時判定為「不是進入點」，不讓例外逸出。一個不存在的 `argv[1]` 不可能是正在執行的這個模組。

替代方案：比對 basename，或改看 `require.main`。前者會把同名的不同檔案誤判為進入點；後者在 ESM 下不存在。

### 進入點判斷抽成共用模組，兩個進入點共用

`src/pane.tsx` 與 `src/open.ts` 各有一份判斷，且兩份寫法不同（一份用 `pathToFileURL`，一份用字串拼接）。這正是兩者只有一個被修好的原因。抽成單一函式後兩個進入點共用同一條規則，規則也才有地方被測試——測試建立一個指向真實檔案的臨時符號連結，斷言經由連結的路徑仍判定為進入點。

替代方案：兩處各自就地修好。成本一樣，但下一個進入點會再複製一份，而且沒有測試落點。

### 套件名與 bin 名稱同名，並以 prepublishOnly 建置

`npx <spec>` 是拿套件名去找同名的 bin 來執行。實測證實 bin 只叫 `spectra-viewer` 而套件名叫 `herdr-spectra-viewer` 時，`npx herdr-spectra-viewer` 會找不到指令而改去執行那個字串本身。因此套件名定為 `spectra-viewer`，與 `herdr-plugin.toml` 的 manifest id 一致；`bin` 宣告 `spectra-viewer` 與短名 `sv` 兩個。

建置掛在 `prepublishOnly` 而非 `prepare`。`dist/` 在 gitignore 裡，所以打包前必須建置，但 `prepare` 是在**安裝方**的機器上執行，而 npm 11 預設封鎖套件的 install script（實測安裝時出現 `npm warn install-scripts`，需要使用者手動放行）。`prepublishOnly` 只在發佈者的機器上跑，tarball 裡已含建好的 `dist`，安裝方零建置、零放行。

`files` 只列 `dist`，原始碼與測試不進 tarball。

替代方案：走 `npx github:<owner>/<repo>`，不必發佈到 registry。但那需要安裝時建置，正好撞上上述的 install script 封鎖，還得把建置產物一起進版控。

### 分頁器檢視由 render 層交出終端控制權

Ink 佔用終端並讀 stdin，分頁器要在同一個終端顯示就必須先把兩者都交出去。交接動作分成 suspend 與 resume 一對：

- suspend：關閉滑鼠回報、清掉 Ink 目前的畫面、關閉 raw mode（Ink 因此停止讀 stdin）。
- resume：重開 raw mode、重開滑鼠回報、重畫。

交接需要三個原語，它們分別只在不同的地方取得，所以一律在掛載時註冊進同一個可變參照，供分頁器路徑取用：

- `setRawMode`：只能經由 Ink 自己的這個函式切換（Ink 用它來管 Ctrl+C），而它只在 component 內取得。關閉時 Ink 會移除 stdin 的 readable 監聽並 unref，這正是「停止讀輸入」；重開時反向還原。由 component 註冊。
- 清畫面：render instance 的 `clear`，會抹掉 Ink 目前畫在螢幕上的那幾行。instance 要等 `render` 回傳才存在，所以由組裝處註冊。
- 重畫：Ink 記得最後一次的輸出字串，且輸出未變時會跳過重寫，因此 `rerender` 無法強迫它重畫。可行的原語是 component 內 `useStdout` 的 `write`：它會先清掉、寫入給的內容、再把記住的最後一幀重新寫回去，以空字串呼叫即等於一次強制重畫。由 component 註冊。

分頁器本身以 argv 陣列 spawn、不經 shell、`stdio` 全數繼承當前終端，等其結束後才 resume。spawn 函式作為參數注入，測試才能斷言 argv、stdio 與 suspend/resume 的先後順序而不需要真終端。

替代方案：不交接，直接 spawn。結果是 Ink 與分頁器同時讀 stdin、同時寫畫面，兩邊都不可用。

### 依執行環境挑選檢視 adapter，App 不需要改

`AppDeps.openEditor` 已經是注入點，`App` 只管呼叫並依結果設狀態列文字。因此分流放在組裝處：invocation context 有 Herdr binary path 就注入既有的 Herdr adapter，沒有就注入分頁器 adapter。兩者共用同一個函式簽章，`App` 的程式碼與既有測試都不需要改動。

判準用 binary path 而非 pane id：沒有 binary 就一定無法呼叫 Herdr，而有 pane id 但沒有 binary 是不可能成立的組合。

替代方案：在 Herdr adapter 內部偵測 binary 為 null 時改走分頁器。那會讓 adapter 同時負責兩種終端模型，且 `src/herdr/` 會開始處理與 Herdr 無關的事。

### 沿用既有的 viewer 解析鏈，不新增 PAGER 來源

檢視指令維持現行三段解析：`SPECTRA_VIEWER`、plugin 設定檔的 `viewer` 欄位、然後 `less`。standalone 下設定檔那一段自然落空（`HERDR_PLUGIN_CONFIG_DIR` 不會被設），等效於 `SPECTRA_VIEWER` 或 `less`。

不新增 `PAGER`。既有 spec 明文禁止查 `EDITOR`，理由是它與 git 等工具共用、在此設值會外溢；`PAGER` 有完全相同的問題。兩條啟動路徑用同一個解析鏈，使用者也只需要記一個變數。

替代方案：standalone 改查 `PAGER`。代價是兩條路徑對同一個專案解析出不同的檢視器，以及使用者的 `PAGER` 設定被這個工具沿用而非明示。

### 檢視結果的 paneId 改為可為 null

`ViewerResult` 成功變體目前強制帶一個 `paneId: string`，那是 Herdr split pane 的 id。分頁器路徑沒有 pane，回傳假值會讓 `App` 記住一個不存在的 pane。成功變體的 `paneId` 因此放寬為可為 null；Herdr adapter 照舊回傳真實 id，分頁器 adapter 回傳 null。`App` 現行的記錄邏輯已能處理 null，行為不變。

替代方案：分頁器回空字串。型別不必改，但那是謊報，讀 `App` 的人會以為真有一個 pane。

## Implementation Contract

**Behavior**

- 在任意專案目錄執行 `npx spectra-viewer`（或安裝後執行 `spectra-viewer` / `sv`）會啟動 changes pane，專案根目錄取 `process.cwd()`，內容與 Herdr 下啟動的 pane 相同。
- 經由符號連結執行 pane 進入點時，TUI 會實際繪製。修正前的觀察結果是行程以 0 結束且沒有任何輸出。
- 沒有 Herdr 時按 `e`：Ink 畫面清除、分頁器接手整個終端顯示 artifact、使用者離開分頁器後 TUI 重新繪製，狀態列顯示 `Opened in <viewer>`。
- 有 Herdr 時按 `e` 的行為逐項不變，含右側 split、單一檢視 pane、ratio 計算、`Opened in <viewer>` 與 `Could not open viewer`。
- 檔案不存在時維持 `File not found: <relative path>`，不啟動分頁器、不交出終端。

**Interface / data shape**

- 新增共用的進入點判斷函式，輸入是模組的 `import.meta.url` 與 `process.argv[1]`，輸出布林。`argv[1]` 為 undefined 或其真實路徑無法解析時回傳 false。
- 新增分頁器檢視函式，簽章與 `AppDeps.openEditor` 相容（接受 client 與同一組選項，回傳 `ViewerResult`），並額外接受注入的 spawn 函式與 suspend/resume 一對。
- `ViewerResult` 成功變體的 `paneId` 型別改為 `string | null`。
- `package.json`：`name` 為 `spectra-viewer`，無 `private`，`bin` 為 `spectra-viewer` 與 `sv` 兩個皆指向 pane 產出檔，`files` 為 `["dist"]`，新增 `prepublishOnly` 執行既有的 build script。
- pane 原始碼首行為 interpreter 指示行，編譯產出檔首行必須保留它。

**Failure modes**

- 分頁器 spawn 失敗或以非零碼結束：回報失敗，`App` 顯示 `Could not open viewer`，且終端必須已經 resume——resume 在成功與失敗兩條路徑上都要執行。
- 進入點判斷中真實路徑解析失敗：回傳 false，不拋例外。
- Herdr binary path 為 null 時不再有任何 Herdr 呼叫發生在檢視路徑上。

**Acceptance criteria**

- 新增測試：經由指向真實檔案的臨時符號連結的路徑，進入點判斷為 true；直接路徑亦為 true；`argv[1]` 為 undefined 或不存在的路徑為 false；路徑含空白時為 true（涵蓋 percent-encoding）。
- 新增測試：分頁器函式以 argv 陣列 spawn 注入的假 spawn、不經 shell、stdio 繼承、artifact 絕對路徑為獨立 argv 元素；suspend 在 spawn 之前、resume 在行程結束之後；非零結束碼回報失敗且 resume 仍被呼叫。
- `npm test` 全綠、`npm run typecheck` 為 0、`npm run check-dist` 為 0。
- `npm pack --dry-run` 的檔案清單除了 npm 無條件納入的套件 manifest、readme 與授權檔之外只含 `dist` 之下的檔案，無任何原始碼或測試檔；產出的 `dist/pane.js` 首行為 interpreter 指示行。
- 手動驗證：`npm pack` 後在一個乾淨目錄安裝該 tarball，經由 `node_modules/.bin/spectra-viewer` 執行，TUI 繪製且列出該目錄的變更。
- README 含 `npx spectra-viewer` 的用法，並說明沒有 Herdr 時送指令會退回剪貼簿。

**Scope boundaries**

- 在範圍內：兩個進入點的判斷修正、interpreter 指示行、`package.json` 封裝欄位與套件改名、分頁器 adapter 與其注入點、`ViewerResult` 型別放寬、README 用法段落。
- 不在範圍內：`herdr-plugin.toml` 的任何欄位、Herdr adapter 的行為、`src/discovery/` 的任何檔案、CLI 參數解析、實際執行發佈、抽出共享 package。

## Risks / Trade-offs

- [Ink 與分頁器的終端交接在某些終端留下殘跡（游標位置、alternate screen 狀態）] → suspend 先清畫面再關 raw mode、resume 反序還原；滑鼠回報的關閉序列本來就設計成可重複寫入。手動驗證涵蓋一次完整的進入與離開。
- [分頁器路徑因為需要真終端而難以自動測試] → 把 spawn 與 suspend/resume 都做成注入參數，讓可測的部分（argv、stdio、呼叫順序、失敗處理）全部進單元測試；只留「畫面實際還原」給手動驗證。
- [套件改名後，既有以 `herdr-spectra-viewer` 為名的本機安裝或連結會失效] → 套件從未發佈過，`private: true` 讓它連發佈都不可能，所以沒有既存使用者；repo 名不需要跟著改。
- [公開發佈後 `spectra-viewer` 這個名字被視為 Spectra 官方工具] → 本變更只讓套件可發佈，不執行發佈；README 的用法段落說明它是 Herdr plugin 的獨立啟動模式。
- [`files: ["dist"]` 漏掉未來新增的執行期資源] → 目前執行期只讀 `dist` 之下的 JS，`npm run check-dist` 已經驗證兩個產出檔存在；驗收另外要求檢查 `npm pack --dry-run` 的清單。
