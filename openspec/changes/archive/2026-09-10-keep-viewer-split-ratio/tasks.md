## 1. 比例計算

- [x] 1.1 依「從兩個 pane 的寬度算比例，而不是讀版面回報的 ratio 欄位」與「比例格式化成小數點後四位」兩個決定，在 `src/herdr/client.ts` 新增一個純函式，與 `extractPaneRect` 放在一起：輸入是一份 Herdr 版面回報的原始輸出加上 changes pane 與 viewer pane 兩個 pane id，輸出是 changes pane 寬度除以兩者寬度之和、取小數點後四位的字串，或在算不出來時回傳 `null`。算不出來的情況為輸出不是合法 JSON、任一 pane 不在版面裡、任一 pane 的寬度不是正整數、兩個 pane 的 `y` 或 `height` 不同、viewer pane 的 `x` 不等於 changes pane 的 `x` 加上其寬度。驗證：`test/herdr/client.test.ts` 中該函式的測試全數通過。
- [x] 1.2 在 `test/herdr/client.test.ts` 為該函式加一組測試，全部以固定的版面 JSON 字面值餵入，不經過 client：寬 27 與寬 50 且相鄰時得到 `0.3506`、寬 39 與寬 38 且相鄰時得到 `0.5065`、pane 不在版面裡時為 `null`、寬度為 0 時為 `null`、兩個 pane 不相鄰時為 `null`。驗證：`npx vitest run test/herdr/client.test.ts` 全綠。

## 2. 接進開檔流程

- [x] 2.1 依「在 close 之前量一次版面」的決定，讓 `openInEditorSplit` 在同時知道自己的 pane id 與前一個 viewer pane 時，先向 Herdr 要一次以自己 pane 為對象的版面，再 close，呼叫序列成為 layout、close、split、run，並把算出的比例接在既有 split 參數尾端成為 `--ratio` 與比例字串。驗證：`test/herdr/client.test.ts` 新增的案例斷言這四個呼叫的順序，且 split 參數以 `--ratio` 與 `0.3506` 結尾。
- [x] 2.2 依「量不到就不帶比例，絕不擋開檔」的決定，讓下列每一種情況都跳過 `--ratio` 而其餘流程不變：沒有前一個 viewer pane、不知道自己的 pane id、版面查詢結束碼非零、版面輸出不是合法 JSON、任一 pane 不在版面裡、任一寬度不是正整數、兩個 pane 不相鄰。沒有前一個 viewer pane 或不知道自己 pane id 這兩種還必須完全不發出版面查詢。驗證：`test/herdr/client.test.ts` 為每一種情況各一個案例，斷言 split 參數不含 `--ratio`、開檔的回傳仍是成功、且前兩種的呼叫清單裡沒有 layout。
- [x] 2.3 確認 `Open an artifact in the editor` requirement 既有的行為沒有被動到：`test/herdr/client.test.ts` 中 `openInEditorSplit` 原有的全部案例維持通過，其中沒有前一個 viewer pane 的案例與沒有 pane id 的案例，其 split 參數必須與今天逐字相同。驗證：`npx vitest run test/herdr/client.test.ts` 全綠且無案例被改寫預期值。

## 3. 驗證

- [x] 3.1 在真實 Herdr 版面確認比例會被保住：開一個 artifact，把 changes pane 與 viewer pane 的邊界拉到 27 欄 / 50 欄，再開另一個 artifact。驗證：`herdr pane layout` 回報的兩個 pane 寬度仍是 27 與 50。
- [x] 3.2 `npm test` 全綠、`spectra validate` 結束碼為 0。驗證：兩個指令的實際輸出。
