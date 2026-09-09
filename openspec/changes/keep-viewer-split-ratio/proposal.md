## Problem

在 changes pane 裡把 viewer split 的寬度拉成自己要的比例之後，只要再開一個 artifact，兩個 pane 的寬度就回到各半。實測於 155 欄視窗：開第一個 artifact 後 changes pane 39 欄、viewer pane 38 欄；手動把邊界拉到 changes pane 27 欄、viewer pane 50 欄；換一個 artifact 後回到 39 / 38。想維持比例就得每換一次檔案重拉一次。

## Root Cause

開檔的流程是 close 掉前一個 viewer pane、split 出新的、再在裡面跑 viewer。`src/herdr/client.ts` 的 `openInEditorSplit` 組出的 split 參數只有目標 pane、方向與工作目錄，沒有比例，於是 Herdr 用它自己的預設值把新 split 切成一半一半。使用者拉出來的比例是存在被 close 掉的那個 split 上的，close 之後就沒有了。

## Proposed Solution

在 close 前先問 Herdr 一次目前的版面，從 changes pane 與前一個 viewer pane 的寬度算出比例，再把這個比例交給接下來的 split。

Herdr 的 split 命令接受一個比例參數，語義是「原 pane 保留的比例」：以上面那組數字實測，帶 0.35 切出來的版面是 changes pane 27 欄、viewer pane 50 欄，與拉動前逐欄相同。要還原的值因此是 changes pane 寬度除以兩個 pane 寬度之和。

問不到版面、兩個 pane 在版面裡找不到、或算出來的比例落在不合理的範圍時，就照現在的方式不帶比例，由 Herdr 決定。

## Non-Goals

- 不記住比例。使用者自己結束 viewer（例如按下該 viewer 的離開鍵）之後再開下一個 artifact 時，畫面上已經沒有 viewer pane 可以量，這種情況維持現狀回到預設比例。
- 不改 close 先於 split 的呼叫順序。
- 不處理往下切的 split：viewer 一律切在右邊，只有寬度需要還原。
- 不改變 viewer 命令的解析、狀態列文字，或找不到檔案與 split 失敗時的行為。

## Success Criteria

- 在 155 欄視窗裡開一個 artifact、把邊界拉到 changes pane 27 欄 / viewer pane 50 欄、再開另一個 artifact，兩個 pane 仍是 27 / 50。
- 第一次開 artifact（沒有前一個 viewer pane）時，送出的 split 不帶比例，版面與今天相同。
- Herdr 回報版面失敗時，開檔仍然成功，只是比例回到預設。
- `npm test` 全綠。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `changes-pane`: `Open an artifact in the editor` requirement 目前只規定 close、split、run 的呼叫順序，沒有規定新 split 的寬度比例，需補上比例的來源、計算方式與各種取不到時的退回條件。

## Impact

- Affected specs: changes-pane
- Affected code:
  - Modified: src/herdr/client.ts
  - Modified: test/herdr/client.test.ts
  - New: (none)
  - Removed: (none)
