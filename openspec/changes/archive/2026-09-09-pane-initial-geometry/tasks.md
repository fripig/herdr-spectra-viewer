## 1. 啟動尺寸向 Herdr 查詢，而不是向 pty 查詢

- [x] 1.1 在 Herdr client 新增取得 pane 幾何的非同步函式，實作 spec 需求 Resolve the pane geometry at startup 的取值規則：columns 取 layout 的 `rect.width`，rows 取兩個來源的較小值 `min(viewport_rows, rect.height - 2)`，全部拿到才回傳 `{ columns, rows }`，否則回傳 `null`。驗證目標：`test/herdr/client.test.ts` 新增案例，涵蓋 `viewport_rows` 過時時取 `rect.height - 2`、pane 穩定時兩來源相等、pane id 不在 layout 中、任一次查詢非零結束、輸出不是 JSON、缺欄位六種情形。
- [x] 1.2 pane 啟動時先解析幾何再繪製首幀，把解析結果當作 `Sized` 的初始寬高；查詢失敗一律靜默退回 `process.stdout`，不寫 stderr、不擋啟動，後續 resize 事件行為不變。驗證目標：`test/tui/frame-height.test.ts` 新增案例，斷言有幾何時用查到的值、沒有 pane id 或查詢失敗時用 stdout 的值，且失敗路徑不產生 stderr 輸出。

## 2. 快捷鍵提示改為依寬度折行

- [x] 2.1 新增 `src/tui/hint-layout.ts`，提供依寬度貪婪打包提示字串的純函式（兩空白分隔、保持宣告順序、單一提示超寬時獨佔一行），以及由輸入模式與寬度算出狀態列總行數的函式。驗證目標：新增 `test/tui/hint-layout.test.ts`，以 spec 的 Example: hints packed by width 表格逐列建立參數化測試，另加寬度為 0 與負數不進入無窮迴圈的案例。
- [x] 2.2 狀態列改為多行渲染，滿足 spec 需求 Show every key hint within the pane width：快捷鍵提示依寬度折行而非截斷，送出指令那一行與 modal 提示行使用同一個折行函式。驗證目標：`test/tui/App.test.tsx` 新增案例，斷言窄寬度下 `q quit` 與 `c commit` 都出現在畫面上，寬版面下提示仍在同一行。

## 3. 保留行數由實際渲染行數推導

- [x] 3.1 依 spec 需求 Display changes as a grouped tree 修改後的樹高定義，把樹的可用高度改為由 header 與狀態列實際渲染行數推導，取代寫死的保留行數常數，並隨當下輸入模式與寬度變動。驗證目標：`test/tui/App.test.tsx` 新增案例，斷言在提示折行的窄寬度下 frame 行數等於傳入的 height，且樹顯示的列數相應減少。

## 4. 驗收

- [x] 4.1 執行 `npm test`、`npm run typecheck`、`npm run check-dist` 並確認全數通過。驗證目標：三個指令的實際輸出與結束碼記錄於驗收筆記。
- [x] 4.2 在真實 Herdr session 驗收：從一個寬度會被對半分割的 pane 開啟 plugin pane，不做任何 focus 轉換就讀取畫面。驗證目標：`herdr pane read` 的畫面中最後一個提示 `q quit` 可見，且 `herdr pane get` 回報的 `scroll.max_offset_from_bottom` 為 0；結果寫入 `openspec/notes/` 下的驗收筆記。
