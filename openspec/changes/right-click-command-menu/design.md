## Context

changes pane 已經開著終端機滑鼠回報：pane 在畫第一幀之前寫出 `ESC[?1000h` 與 `ESC[?1006h`，離開時寫出對應的關閉序列。模式 1000 回報所有按鍵，不只左鍵，所以右鍵的位元組其實一直都送進了 stdin。

本次動工前的實測結果（Herdr 0.9.0、macOS 終端機）：

- 右鍵在 pane 內按一次會產生兩個 SGR 報文，`ESC[<2;col;rowM` 與 `ESC[<2;col;rowm`，button 欄位都是 2。
- 修飾鍵不會編進 button 欄位。Alt+右鍵仍然回報 2，二十次點擊中從未出現過 10。所以「用修飾鍵區分右鍵用途」在這個輸入通道上做不到。
- 不需要改任何 Herdr 設定。對照組把 `ui.right_click_passthrough_modifier` 維持在預設空字串，純右鍵照樣送進六個報文；把它設成 `alt` 產生的位元組串與對照組完全相同，也就是這個設定對本功能沒有作用。
- Ink 5.2.1 的 `Box` 支援 `position="absolute"`，而且絕對定位的框會實際覆寫底下已經畫好的字，不是把內容擠開。用 ink-testing-library 的探針驗證過：一個 `position="absolute"` 的 bordered Box 蓋掉了底下數列的後半段。
- Ink 5.2.1 的 `Styles` 沒有 `top` / `left` / `right` / `bottom` 屬性。絕對定位的位移只能用 `marginTop` / `marginLeft` 表達。

擋住這個功能的三個地方：`src/tui/mouse.ts` 的 `kindOf` 只認 button 0、64、65，button 2 落到 `return null` 而被丟棄；`src/tui/App.tsx` 的 `handleMouse` 只在 tree 模式下作用，而且第一件事就是跳過所有 release；`changes-pane` 規格的「Parse SGR mouse reports from input」需求明文寫著其他 button 一律丟棄，範例表也列著 `ESC[<32;9;5M` 為 dropped。

## Goals / Non-Goals

**Goals:**

- 右鍵在樹上的一列成為一個可用的輸入：移動游標，並開出一個列出五個 `/spectra-*` 指令的浮動選單。
- 選單同時支援滑鼠與鍵盤，兩者都能選定與取消。
- 選定後的行為與既有的字母鍵完全一致，包含五種狀態列結果，做法是重用同一個送指令函式而不是複製它。
- 選單永遠完整留在 pane 內，靠近右緣或下緣時往內夾。
- 選單的幾何與命中判定是純函式，可以獨立測試，不需要渲染。

**Non-Goals:**

- 不支援子選單、多層選單、選單內搜尋。
- 不在選單模式支援字母鍵直選。
- 不處理修飾鍵組合，實測沒有可分辨的輸入。
- 不改動既有五個字母鍵在 tree 模式的行為。
- 不改動 `/spectra-propose` 的排除決定。
- 不改動 Herdr 設定或安裝說明。

## Decisions

### 右鍵解析成獨立的 right-press 事件，release 維持既有處理

`MouseKind` 加入第五個成員 `right-press`，`kindOf` 在非 release 且 button 為 2 時回傳它。release 分支不動：目前任何 button 配上 `m` 都回傳 `release`，所以右鍵放開自動落在既有的 release 路徑，`handleMouse` 既有的 release 跳過邏輯不需要為它加任何例外。其他未知 button 仍然回傳 `null` 而被丟棄。

替代方案是讓 button 2 也回傳 `press`，再靠 `button` 欄位在 App 裡分辨。否決理由是 `MouseKind` 存在的目的就是讓下游不必再看原始 button 值，把分辨責任推回 App 會讓 `hitTest` 的呼叫端變成兩層判斷。

### 浮動選單用 Ink 絕對定位加 margin 定位

選單是 root Box 的最後一個子節點，帶 `position="absolute"`，位移用 `marginTop` 與 `marginLeft` 表達，因為 Ink 5.2.1 沒有 `top` / `left` 屬性。放在最後一個子節點是為了讓它在文件順序上晚於樹，畫在樹之上。座標原點是 root Box 的左上角，也就是 pane 的 (0, 0)。

替代方案是像 `AuthorPicker` 那樣整欄取代樹。否決理由是使用者剛用右鍵指到某一列，把那一列連同整棵樹換掉會讓「我對哪個 change 下指令」失去視覺依據。

### 選單幾何與命中判定抽成純函式模組

新模組匯出選單尺寸常數、`menuGeometry` 與兩個命中判定函式，全部不碰 Ink，比照 `hint-layout.ts` 與 `StatusBar.tsx` 的既有分工。渲染元件只負責把算好的矩形畫出來。

選單內容寬度由 `COMMAND_KEYS` 推導，取五個項目標籤中最長的字元數，不寫死。加上左右框線各一欄得到總寬，項目數加上下框線各一列得到總高。

替代方案是把幾何算在元件裡。否決理由是滑鼠命中判定需要同一份矩形，算在元件裡就只能靠渲染輸出測試，命中邊界（框線、項目外緣、pane 邊緣）會變得難以逐格驗證。

### 選單項目補滿內容寬度

五個標籤長度不一。絕對定位的框只會蓋住它實際畫出的字元，較短的標籤右邊會露出底下的樹。所以每個項目都用空白補滿到內容寬度，框內每一格都是不透明的。游標所在的項目用 `inverse` 呈現，補滿後反白會覆蓋整列而不是半列。

### 選單是第四種 input mode，滑鼠派送改讀 modeRef

`InputMode` 加入 `menu`。選單開啟時它擁有鍵盤：方向鍵與 `j` / `k` 移動、Enter 選定、Escape 取消，其餘按鍵一律不作用，包含 `q`——與 authors 模式對 `q` 的處理一致，所以選單開著時 `q` 不會結束 process。

`handleMouse` 改成從 `modeRef.current` 讀模式，而不是從該次渲染的 `mode` 讀。理由與檔案裡 `modeRef` 既有的註解相同：一個 stdin chunk 可能帶多個事件，而開選單的那個事件會在同一輪迴圈內改變模式。`setMode` 同步寫入 ref，所以後續事件會走到正確的分支。

選單的矩形存在一般的 state，不另外做 ref。一個 chunk 內能同時出現的只有同一次實體點擊的 press 與 release，release 一律被跳過，所以選單分支讀到尚未更新的 state 這件事在真實輸入下不會造成誤判；選單分支仍然在矩形為空時直接跳過該事件，不會拋錯。

### 選定後重用既有的送指令函式

選單選定不自己組指令文字、不自己決定目標 pane、不自己處理剪貼簿退路。它呼叫既有的送指令函式並傳入指令名稱，該函式已經處理目標 pane、焦點移動、送出失敗改寫剪貼簿，以及五種狀態列訊息。游標在開選單時已經移到被點的那一列，所以該函式讀到的「目前的 change」就是使用者指到的那一個。

### 選單靠邊時往內夾

錨點是被點的那一格，換算成以 pane 左上角為原點的零基座標。左緣取 `min(錨點欄, pane 寬 - 選單寬)` 再取下限 0；上緣取 `min(錨點列, pane 高 - 選單高)` 再取下限 0。pane 比選單還小的極端情況下，夾邊會把選單放在 (0, 0)，超出的部分由終端機裁掉，鍵盤操作仍然可用。

## Implementation Contract

**Behavior**

- 在樹的一列上按右鍵：游標移到該列，且不論點在哪一欄都不切換該節點的展開狀態。
- 該列有所屬 change（change 節點本身，或 artifact 節點所屬的 change）時，在點擊位置開出選單，選單游標停在第一個項目 `d discuss`。
- 該列是群組節點時不開選單，狀態列顯示 `Select a change first`，游標仍然移到該列。
- 右鍵點在樹的範圍之外（標頭列、狀態列、最後一個節點以下）不做任何事。
- 選單開啟後：`↑` / `k` 上移、`↓` / `j` 下移，兩端不繞回；Enter 送出游標所在項目的指令並關閉選單回到 tree 模式；Escape 關閉選單回到 tree 模式且不送出任何東西；其他按鍵不作用，`q` 不結束 process。
- 選單開啟後的滑鼠：任一按鍵按在某個項目上等同 Enter 選定該項目；按在選單框線上不作用且選單保持開啟；按在選單之外關閉選單且不送出任何東西；滾輪不作用，樹不捲動；放開一律忽略。
- 開選單、關選單、選定，都不觸發檔案掃描，樹的展開狀態不變。
- 狀態列在選單模式顯示自己的一行提示，取代 tree 模式的兩行按鍵提示，並比照 filter 與 authors 模式補到相同行數，所以開選單不會讓樹上下跳動。

**Interface / data shape**

- `MouseKind` 新增字面量 `"right-press"`。SGR button 2 配 `M` 解析成 `{ kind: "right-press", button: 2, col, row }`；button 2 配 `m` 仍解析成 `release`。其餘未知 button 仍不產生事件。
- 新的幾何模組匯出一個矩形型別，欄位為以 pane 左上角為原點的零基 `left`、`top` 與 `width`、`height`；一個由錨點與 pane 尺寸算出該矩形的函式；一個判定某個一基座標是否落在矩形內的述詞；一個把一基座標對應到項目索引、落在框線或矩形外時回傳空值的函式。
- `InputMode` 新增字面量 `"menu"`。
- keymap 模組匯出選單項目標籤陣列與選單模式的提示陣列。既有的 `COMMAND_HINTS` 改由選單項目標籤推導，其內容維持不變。
- 選單元件接收項目標籤、游標索引與矩形三個 prop，不自行計算幾何。

**Failure modes**

- pane 寬度或高度小於選單尺寸時，夾邊把選單放在原點，超出部分由終端機裁掉。不報錯、不隱藏選單、鍵盤操作照常。
- 選單開啟中收到的事件若對應的矩形尚未就緒，該事件直接跳過，不拋錯也不改變模式。
- 送出指令的所有失敗路徑都由既有的送指令函式處理，本次不新增任何失敗訊息。

**Acceptance criteria**

- `test/tui/mouse.test.ts` 有一個案例斷言 `ESC[<2;17;18M` 解析成 `right-press`、欄 17、列 18，另有一個案例斷言 `ESC[<2;17;18m` 仍解析成 `release`，且既有的未知 button 丟棄案例仍然通過。
- 新增的 `test/tui/command-menu.test.ts` 以參數化表格覆蓋：選單完整落在 pane 內的一般位置、貼右緣往左夾、貼下緣往上夾、pane 比選單小時落在原點；以及命中判定的四種結果，項目內、框線上、矩形外、矩形內但在項目列之外。
- `test/tui/App.test.tsx` 覆蓋：在 change 列右鍵後畫面出現五個項目標籤且 `d discuss` 反白；在群組列右鍵後狀態列為 `Select a change first` 且畫面沒有出現 `c commit`；選單開啟時按 `j` 再按 Enter 送出 `/spectra-apply <change>`；選單開啟時按 Escape 後畫面沒有出現 `c commit` 且介面卡沒有收到任何送出；選單開啟時按 `q` 後 `onExit` 未被呼叫；在 artifact 列右鍵後選 `i` 送出的是所屬 change 的名稱。
- `npm test` 與 `npm run build` 全綠。

**Scope boundaries**

- 在範圍內：滑鼠報文解析新增 button 2；新的幾何模組與選單元件；App 的第四種模式、鍵盤分支、滑鼠分支與渲染；keymap 的選單項目與提示；README 的滑鼠表格一列；`changes-pane` 規格的四個既有需求修改與一個新增需求。
- 在範圍外：既有五個字母鍵的行為；送指令函式本身的邏輯；viewer 分頁；filter 與 authors 模式；掃描與樹的建構；Herdr 設定與安裝流程。

## Risks / Trade-offs

- 終端機或多工器把右鍵吃掉，pane 收不到 button 2 → 既有的五個字母鍵完全不變，右鍵只是額外的路徑，收不到就等於這個功能不存在，不影響任何既有操作。
- 絕對定位的覆蓋行為依賴 Ink 的渲染細節，未來升級可能改變 → 已用探針在 5.2.1 上驗證過實際覆寫；選單的幾何與命中判定是純函式且獨立測試，即使渲染方式要換，需要重寫的只有元件本身。
- 選單蓋住底下的樹，使用者暫時看不到被遮的列 → 選單只有七列高，且錨定在被點的那一列，遮住的是該列以下的內容；Escape 立刻還原。
- 新增的第四種模式讓 `q` 在更多情況下不結束 process → 與 filter、authors 兩個既有模式的行為一致，且選單是使用者主動開的、Escape 一鍵關閉，不會意外進入。
