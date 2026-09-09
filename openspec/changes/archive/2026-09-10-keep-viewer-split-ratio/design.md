## Context

開啟 artifact 的流程在 `openInEditorSplit` 裡，依序是：close 掉記住的前一個 viewer pane、向 Herdr 要一個往右的 split、在新 pane 裡跑 viewer。組出來的 split 參數只有目標 pane、方向與工作目錄。

Herdr 的 split 命令另外接受一個比例參數 `--ratio`。實測於 155 欄視窗：changes pane 與 viewer pane 原本是 39 / 38 欄，手動把邊界拉成 27 / 50 後版面記下的比例是 0.35；把 viewer pane 關掉、改用帶 `--ratio 0.35` 的 split 重切一次，得到的是 27 / 50，與拉動前逐欄相同。因此 `--ratio` 的語義是「原 pane 保留的比例」，而使用者拉出來的比例可以從兩個 pane 的寬度反推。

比例是存在 split 上的，close 掉 viewer pane 就等於拆掉那個 split，比例隨之消失。目前的程式碼先 close 再 split，所以到了要送出 split 的那一刻，已經沒有東西可以量了。

`src/herdr/client.ts` 已經有 `extractPaneRect`，它從 Herdr 回報的版面裡取出指定 pane 的 rect（`x`、`y`、`width`、`height`）；`paneGeometry` 已經在用它，取版面的方式是帶 `--pane` 的 layout 查詢，可以指定任意 pane，不受目前焦點在哪個 tab 影響。

## Goals / Non-Goals

**Goals:**

- 換一個 artifact 之後，changes pane 與 viewer pane 的寬度比例與換之前相同。
- 比例完全由當下的版面決定，plugin 不需要保存任何新狀態。
- 任何一步問不到或算不出來時，開檔的結果與今天完全相同。

**Non-Goals:**

- 不記住比例。使用者自己結束 viewer 之後再開下一個 artifact 時，版面上已經沒有 viewer pane 可以量，這種情況維持回到 Herdr 的預設比例。
- 不改 close 先於 split 的呼叫順序。
- 不處理往下切的 split：viewer 一律切在右邊，只有寬度需要還原。
- 不改變 viewer 命令的解析、狀態列文字，或找不到檔案與 split 失敗時的行為。
- 不改變第一次開 artifact 的版面。

## Decisions

### 在 close 之前量一次版面

比例只在兩個 pane 同時存在時才量得到，而 close 會把它拆掉，所以量測必須排在 close 前面，成為每次開檔的第一個 Herdr 呼叫。

只有在有記住前一個 viewer pane 時才發出這個查詢：沒有前一個 viewer pane 就沒有比例可還原，多問一次是白費的往返。因此第一次開檔的呼叫序列與今天一模一樣，換檔時則多一個查詢，變成 layout、close、split、run。

替代方案是把量測放在上一次開檔成功之後（順手記下比例），這樣不必多一次查詢；但那等於保存狀態，而且使用者是在兩次開檔「之間」拉動邊界的，記下來的值正好是還沒被拉動的那個，會系統性地錯。

### 從兩個 pane 的寬度算比例，而不是讀版面回報的 ratio 欄位

Herdr 的版面回報裡有一份 splits 清單，每個 split 都帶自己的 ratio，數值就是要的東西；但清單裡沒有記載哪些 pane 屬於哪個 split，要對應回去得先從各個 split 的 rect 重建整棵樹。兩個 pane 的 rect 則是直接可用的，而且 `extractPaneRect` 已經在解析同一份回報。

比例取 changes pane 的寬度除以兩個 pane 寬度之和。以實測的 27 與 50 代入得到 0.3506，與版面回報的 0.35 一致。

算式成立的前提是兩個 pane 真的是同一個左右 split 的兩半，所以要先確認 viewer pane 緊接在 changes pane 右邊、而且兩者的 `y` 與 `height` 相同。實測資料符合：changes pane 的 `x` 是 78、寬 27，viewer pane 的 `x` 正好是 105，兩者 `y` 都是 0、`height` 都是 48。使用者若曾把 pane 搬到別處，這個檢查會不成立，於是退回不帶比例。

### 比例格式化成小數點後四位

相除的結果是無盡小數（27 除以 77 是 0.35064935…）。實測把完整的浮點字串交給 Herdr 是可以的，它自己會收成 0.35064936，但那讓測試裡的預期字串取決於浮點列印方式。取小數點後四位的字串比較好讀也比較穩定，而且精度綽綽有餘：0.3506 乘上 77 欄仍然落在第 27 欄，要讓第四位小數影響到欄位歸屬，pane 得寬到一萬欄以上。

### 量不到就不帶比例，絕不擋開檔

還原比例是舒適度，不是正確性。以下每一種情況都跳過 `--ratio`、其餘流程照舊：不知道自己的 pane id、沒有記住前一個 viewer pane、版面查詢失敗、兩個 pane 有任一個不在回報的版面裡、任一個寬度不是正整數、兩個 pane 不相鄰。

版面查詢失敗時不寫任何訊息，也不影響狀態列。這與同一段流程裡 close 的既有處理一致：close 的結果本來就被忽略，因為那不是使用者能行動的資訊。

## Implementation Contract

**Behavior**

在 changes pane 裡開過一個 artifact、把兩個 pane 的邊界拉到自己要的位置之後，再開另一個 artifact，兩個 pane 的寬度與拉動後相同。第一次開 artifact 時版面與今天相同，由 Herdr 決定。

**Interface / data shape**

`openInEditorSplit` 的參數與回傳型別不變。新增的行為全部發生在它內部：

- 當 `paneId` 與 `previousViewerPane` 兩者皆有值時，先發出一次帶 `--pane` 的版面查詢，對象是 `paneId`。
- 從回報中取出 `paneId` 與 `previousViewerPane` 兩者的 rect，算出比例。
- 算得出來時，在既有的 split 參數尾端接上 `--ratio` 與比例字串；算不出來時參數與今天相同。

新增一個純函式負責「一份版面回報加上兩個 pane id」到「比例字串或 null」的轉換，與 `extractPaneRect` 放在一起，這樣它可以用固定的 JSON 字面值單獨測試，不必經過 client。

比例字串為 changes pane 寬度除以兩個 pane 寬度之和，取小數點後四位。以 27 與 50 為例，字串是 `0.3506`。

**Failure modes**

| 情況 | 行為 |
| --- | --- |
| 沒有記住前一個 viewer pane | 不發出版面查詢，split 不帶比例 |
| 不知道自己的 pane id | 不發出版面查詢，split 不帶比例 |
| 版面查詢結束碼非零，或輸出不是合法 JSON | split 不帶比例，不回報 |
| 兩個 pane 有任一個不在回報的版面裡 | split 不帶比例，不回報 |
| 任一個 pane 的寬度不是正整數 | split 不帶比例，不回報 |
| 兩個 pane 的 `y` 或 `height` 不同，或 viewer pane 的 `x` 不等於 changes pane 的 `x` 加上其寬度 | split 不帶比例，不回報 |

任何一種都不得改變開檔的成敗、狀態列文字，或記住哪一個 viewer pane。

**Acceptance criteria**

- `test/herdr/client.test.ts` 既有的 `openInEditorSplit` 案例全數維持通過，其中「issues no close when no viewer pane is remembered」與「omits --pane when no pane id is known」兩條斷言的 split 參數不含 `--ratio`。
- 新增案例：有前一個 viewer pane 且版面回報 changes pane 寬 27、viewer pane 寬 50 且兩者相鄰時，呼叫序列是 layout、close、split、run，且 split 參數以 `--ratio` 與 `0.3506` 結尾。
- 新增案例逐條涵蓋上表六種退回情況，每一條都斷言 split 參數不含 `--ratio` 且開檔仍然成功。
- 純函式的測試以固定 JSON 字面值涵蓋：正常、pane 不在版面裡、寬度不是正整數、兩個 pane 不相鄰。
- `npm test` 全綠。
- 手動驗證：155 欄視窗裡開一個 artifact、把邊界拉到 27 / 50、再開另一個 artifact，版面查詢顯示兩個 pane 仍是 27 / 50。

**Scope boundaries**

在範圍內：`openInEditorSplit` 送出的呼叫序列與 split 參數、新增的比例計算函式、兩者的測試、`changes-pane` 的 delta spec。

不在範圍內：pane 的高度、往下切的 split、viewer 命令的解析、狀態列文字、記住 viewer pane 的邏輯、plugin pane 自己的幾何計算、README。

## Risks / Trade-offs

[換檔時多一次 Herdr 往返，開檔稍微慢一點] → 只有在有前一個 viewer pane 時才發出，第一次開檔不受影響；這個查詢與 close 一樣是輕量的本機呼叫，而且它必須在 close 之前完成，無法與 close 併行。

[使用者自己結束 viewer 之後再開下一個 artifact，比例仍然回到預設] → 已列為 Non-Goals。要涵蓋這條路得讓 plugin 保存比例，而保存下來的值會在使用者於別處改動版面後過期；這次先做完全由當下版面決定的那一半。

[把 pane 搬動過之後相鄰檢查不成立，比例還原失效] → 退回目前的行為而不是算出一個錯的比例；相鄰檢查存在的理由就是讓算式在不成立時安靜地不生效。

## Open Questions

(none)
