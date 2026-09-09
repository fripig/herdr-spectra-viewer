## Context

`resolveViewer` 目前只看 `SPECTRA_VIEWER`，沒有時退回 `less`。plugin pane 由 Herdr server 直接 spawn `node dist/pane.js`，沒有經過 shell，因此拿到的是 server 行程的環境；使用者寫在互動 shell 設定檔裡的 export 不保證傳得到。

Herdr 會在啟動 plugin pane 時提供 `HERDR_PLUGIN_CONFIG_DIR`，本機實測其值為 `~/.config/herdr/plugins/config/spectra-viewer`，目錄由 Herdr 自動建立，目前是空的。plugin 尚未讀取這個目錄下的任何檔案。

專案的 runtime 相依只有 ink 與 React，沒有任何設定檔解析器；`src/herdr/context.ts` 已建立處理外部輸入的既有慣例：注入 `warn` callback、解析失敗就回報一行並退回預設值，不讓錯誤中斷流程。

## Goals / Non-Goals

**Goals:**

- 讓使用者不動 shell 環境、不改程式預設，就能指定開啟 artifact 用的 viewer。
- 設定的位置屬於這個 plugin，而不是全域環境。
- 設定檔缺席或壞掉時，行為與今天完全相同。

**Non-Goals:**

- 不改 `DEFAULT_VIEWER`，最終退路仍是 `less`。
- 不把設定檔擴充成 viewer 以外的用途，這次只讀 `viewer` 一個欄位。
- 不引入 TOML 或 YAML 解析器。
- 不讀 `HERDR_PLUGIN_STATE_DIR`；狀態與設定是兩回事。
- 不處理設定檔的熱重載，值在啟動時讀一次。

## Decisions

**設定檔用 JSON，檔名 `config.json`。** Node 內建 `JSON.parse`，不必為了一個字串新增相依。TOML 雖然與 Herdr 自己的 `config.toml` 一致，但需要新的套件；純文字檔（整個檔案就是 viewer 字串）雖然最短，卻沒有留下第二個設定項的空間，而且無法區分「空檔案」與「刻意設成空字串」。

**欄位名用 `viewer`，值是命令列字串。** 與 `SPECTRA_VIEWER` 同一個概念、同樣的內容形式，兩者可以互換填寫，使用者不需要學第二套寫法。

**優先序是環境變數 > 設定檔 > `less`。** 環境變數是單次啟動可覆蓋的東西，設定檔是持續生效的偏好；讓前者贏，才能在不動設定檔的情況下臨時換一個 viewer 試。

**讀不到就安靜退回，只有「檔案存在但內容不合法」才回報。** 檔案不存在是預設狀態而非錯誤，不該產生噪音。JSON 壞掉或 `viewer` 不是非空字串則是使用者打錯字，值得一行提示 —— 沿用 `readInvocationContext` 的 `warn` callback 慣例，由呼叫端決定寫到哪裡。

**讀取放在新檔 `src/config.ts`。** `src/pane.tsx` 是行程進入點，已經同時負責幾何計算、mouse 生命週期與 viewer 解析；設定檔讀取是一段有自己失效路徑、需要獨立測試的邏輯，放進去只會讓進入點更難測。

## Implementation Contract

**Behavior**

啟動 plugin pane 時，viewer 命令依序取第一個有效來源：

1. `SPECTRA_VIEWER` 環境變數，去除前後空白後仍非空。
2. `HERDR_PLUGIN_CONFIG_DIR` 指向的目錄下 `config.json` 中的 `viewer` 欄位，去除前後空白後仍非空。
3. 字串 `less`。

`EDITOR` 仍然不被參考。

**Interface / data shape**

設定檔路徑為 `HERDR_PLUGIN_CONFIG_DIR` 與 `config.json` 組成。內容為 JSON 物件，本次只讀 `viewer` 一個欄位：

    { "viewer": "frogmouth" }

新模組匯出一個函式，輸入為環境變數集合、一個同步讀檔函式與一個 `warn` callback，輸出為 `string | null`：找到有效字串時回傳去除空白後的值，其餘情況回傳 `null`。讀檔函式與 `warn` 皆可注入，測試不觸碰真實檔案系統。

`resolveViewer` 改為接受設定檔那一層的結果，維持 `string` 回傳型別與現有呼叫端形狀。

**Failure modes**

| 情況 | 行為 |
| --- | --- |
| `HERDR_PLUGIN_CONFIG_DIR` 未設定或為空字串 | 跳過設定檔層，不回報 |
| 設定檔不存在（讀檔擲錯） | 跳過設定檔層，不回報 |
| 檔案內容不是合法 JSON | 回報一行，跳過設定檔層 |
| JSON 頂層不是物件（陣列、字串、null） | 回報一行，跳過設定檔層 |
| 沒有 `viewer` 欄位 | 跳過設定檔層，不回報 |
| `viewer` 不是字串，或去除空白後為空 | 回報一行，跳過設定檔層 |

任何一種失效都不得阻止 pane 啟動，也不得改變行程結束碼。

**Acceptance criteria**

- `test/tui/viewer.test.ts` 以表格涵蓋三層來源的每一種組合，包含環境變數與設定檔同時存在時環境變數勝出。
- 新增的設定讀取測試涵蓋上表六種失效情況，並斷言哪幾種會呼叫 `warn`、哪幾種不會。
- `npm test` 全綠。
- 在 `~/.config/herdr/plugins/config/spectra-viewer/config.json` 寫入 `{ "viewer": "frogmouth" }`、且 shell 沒有 `SPECTRA_VIEWER` 的情況下開啟 plugin pane 並按 Enter，viewer pane 跑的是 frogmouth。

**Scope boundaries**

在範圍內：viewer 這一個設定值的來源解析、其失效路徑、對應測試、README 的說明、`changes-pane` 的 delta spec。

不在範圍內：`DEFAULT_VIEWER` 的值、其他設定項、設定檔的寫入或產生、`herdr-plugin.toml`、`open` action 的行為。

## Risks / Trade-offs

[設定檔指向一個沒安裝的命令，viewer pane 會閃一下就消失且不留錯誤訊息] → 這是既有行為，README 已記載；本次在說明設定檔的段落再次點名，並建議先在終端機直接跑一次該命令確認可用。

[多一個設定來源，使用者可能搞不清楚為什麼設定沒生效] → 優先序寫進 README 與 spec，且環境變數勝出這件事有專屬測試案例釘住。

[設定值在啟動時讀一次，改了設定檔要重開 pane 才生效] → 可接受：viewer 不是會在一次工作階段中反覆調整的東西，熱重載的複雜度不值得。

## Open Questions

(none)
