## 1. 滑鼠報文解析

- [x] 1.1 依「Parse SGR mouse reports from input」與設計的「右鍵解析成獨立的 right-press 事件，release 維持既有處理」，讓 `src/tui/mouse.ts` 的 `MouseKind` 多一個 `"right-press"`，`kindOf` 在非 release 且 button 為 2 時回傳它，release 分支與其他未知 button 的丟棄行為都不動。驗證：`test/tui/mouse.test.ts` 新增斷言 `ESC[<2;17;18M` 解析成 `{ kind: "right-press", col: 17, row: 18 }`、`ESC[<2;17;18m` 仍解析成 `release`，且既有的 `ESC[<32;9;5M` 丟棄案例與部分報文案例仍然通過。

## 2. 選單幾何與元件

- [x] 2.1 依設計的「選單幾何與命中判定抽成純函式模組」與「選單靠邊時往內夾」，新增 `src/tui/command-menu.ts`，匯出一個以 pane 左上角為原點的零基矩形型別（`left`、`top`、`width`、`height`）、由 `COMMAND_KEYS` 推導出的內容寬度與選單尺寸，以及一個吃「一基的點擊欄列」加「pane 寬高」算出矩形的函式：左緣取錨點欄與 `pane 寬 - 選單寬` 的較小值再取下限 0，上緣同理。驗證：新增 `test/tui/command-menu.test.ts`，用規格中「menu position by anchor and pane size」的五列表格逐列斷言，涵蓋一般位置、右緣夾、下緣夾、雙邊夾、pane 比選單小。
- [x] 2.2 在 `src/tui/command-menu.ts` 補上兩個命中判定：一個述詞判斷某個一基座標是否落在矩形內（含框線），一個函式把一基座標對應到項目索引、落在框線或矩形外時回傳空值。驗證：`test/tui/command-menu.test.ts` 用規格中「what a press does while the menu is open」的六列表格逐列斷言，涵蓋第一個項目、最後一個項目、左框線、上框線、矩形下方、矩形右方。
- [x] 2.3 依設計的「浮動選單用 Ink 絕對定位加 margin 定位」與「選單項目補滿內容寬度」，新增 `src/tui/CommandMenu.tsx`：接收項目標籤、游標索引、矩形三個 prop，用 `position="absolute"` 加 `marginTop` / `marginLeft` 定位（Ink 5.2.1 沒有 `top` / `left` 屬性），四邊帶框，每個項目補空白到內容寬度，游標所在項目 `inverse`。驗證：在 `test/tui/command-menu.test.ts` 用 ink-testing-library 單獨渲染，斷言輸出含五個項目標籤、每個項目列在框內的寬度相同。

## 3. 選單項目與提示文字

- [x] 3.1 在 `src/tui/keymap.ts` 匯出選單項目標籤陣列（由 `COMMAND_KEYS` 推導成 `d discuss`、`a apply`、`i ingest`、`r archive`、`c commit`）與選單模式的提示陣列，並把既有的 `COMMAND_HINTS` 改成由該標籤陣列推導，內容維持不變。驗證：在 `test/tui/App.test.tsx` 新增斷言，選單項目標籤陣列等於 `["d discuss", "a apply", "i ingest", "r archive", "c commit"]`，而 `COMMAND_HINTS` 仍等於同一組標籤前面加上 `send to pane:`；`test/tui/hint-layout.test.ts` 與既有的狀態列斷言仍然全綠。

## 4. App 整合

- [x] 4.1 依設計的「選單是第四種 input mode，滑鼠派送改讀 modeRef」，在 `src/tui/App.tsx` 讓 `InputMode` 多一個 `"menu"`，`handleMouse` 改由 `modeRef.current` 判斷模式並分出選單分支，選單矩形存在 state、分支在矩形為空時直接跳過該事件。驗證：`test/tui/App.test.tsx` 斷言開選單後再送一個 tree 區域的左鍵按下不會移動樹的游標。
- [x] 4.2 依「Open a Spectra command menu with the right button」實作開啟路徑：右鍵落在樹的一列上時把游標移到該列、不切換展開狀態、不觸發掃描；該列有所屬 change 就在點擊位置開選單並把選單游標放在第一項，該列是群組節點就不開選單並顯示 `Select a change first`；右鍵落在樹範圍外不做任何事。同時依「Select, toggle, and open by clicking the tree」把既有的移動游標、切換展開、開啟 artifact 三種行為明確收斂成只由左鍵觸發。驗證：`test/tui/App.test.tsx` 對應規格的「Right-clicking a change opens the menu there」、「Right-clicking the marker cells does not toggle」、「Right-clicking a group node opens no menu」、「A right press on an artifact does not open it」四個場景各一個案例。
- [x] 4.3 實作選單模式的鍵盤：`↑` / `k` 與 `↓` / `j` 移動且兩端不繞回，Enter 依設計的「選定後重用既有的送指令函式」呼叫既有的送指令函式後關閉選單回到 tree 模式，Escape 關閉選單且不送出任何東西，其餘按鍵不作用。依「Provide a Spectra changes pane」，選單開啟時 `q` 不結束 process。驗證：`test/tui/App.test.tsx` 斷言按 `j` 再按 Enter 會送出 `/spectra-apply <change>`、按 Escape 後畫面不再有 `c commit` 且介面卡沒有收到送出、按 `q` 後 `onExit` 未被呼叫；另一個案例從 artifact 列右鍵後選 `i ingest`，斷言送出的是所屬 change 的名稱。
- [x] 4.4 實作選單模式的滑鼠：按在項目上等同 Enter 選定並關閉、按在框線上不作用且選單保持開啟、按在選單之外關閉選單且不送出任何東西、滾輪不作用不捲動樹、放開一律忽略。驗證：`test/tui/App.test.tsx` 對應規格的「Choosing an item with the mouse sends the command」、「Clicking outside the menu closes it」、「Clicking the menu border keeps it open」三個場景各一個案例。
- [x] 4.5 依「Show every key hint within the pane width」，讓狀態列在選單模式顯示選單自己的提示行取代 tree 模式的兩行按鍵提示，並沿用既有的補行機制讓行數不變。驗證：`test/tui/App.test.tsx` 斷言開選單前後樹的可見列數相同，且選單模式的狀態列含選單提示、不含 `q quit`。

## 5. 文件與整體驗證

- [x] 5.1 在 README.md 的「Keys and mouse」表格補上右鍵那一列，說明右鍵會把游標移到該列並開出指令選單，以及選單的選定與取消方式。驗證：閱讀該表格，確認新列與既有列的敘述風格一致且沒有提到任何 Herdr 設定需求。
- [x] 5.2 確認整體無回歸。驗證：`npm test` 與 `npm run build` 全綠，並實際在 Herdr pane 內開啟 plugin 手動右鍵一次，確認選單出現在點擊位置、選一項後指令出現在左邊的 pane。
