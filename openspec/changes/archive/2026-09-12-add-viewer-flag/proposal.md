## Why

檢視器命令目前只能從兩個地方設定：`SPECTRA_VIEWER` 環境變數，以及 `HERDR_PLUGIN_CONFIG_DIR` 指向目錄裡 `config.json` 的 `viewer` 欄位。兩者都要求使用者先動環境變數或先建一個檔案，對「這次想換個檢視器看一下」這種一次性需求太重。

這個負擔在獨立執行的路徑上特別明顯。viewer 現在能以 npx spectra-viewer 啟動，使用者手上有一個完整的命令列可以打字，卻沒有任何旗標可以用；設定檢視器唯一的辦法是 export 一個名字裡帶著 Herdr 的環境變數，對一個沒裝 Herdr 的使用者來說讀起來莫名其妙。

## What Changes

- 新增 `--viewer <命令列>` 旗標，成為檢視器解析順序的最高優先來源，排在 `SPECTRA_VIEWER` 之前。值的形狀與 `SPECTRA_VIEWER` 相同：一整行命令列，可以帶旗標，路徑由程式附加在最後。
- 新增 `--help` 與 `--version`：印完即結束，不進入 TUI，因此在管線裡也能用。
- 這個程式目前完全沒有命令列參數解析，`process.argv` 只被 entry-point 判斷用到。本變更新增一個純函式的參數解析模組，不引入任何第三方套件。
- 未知旗標與多餘的位置參數會被拒絕：印出使用說明指引後以非零狀態結束，不啟動 TUI。這讓 `--viewer bat --style=plain`（少了引號）這類寫法得到明確錯誤，而不是安靜地只用 `bat`。
- 取不到值的 `--viewer`（後面沒有東西、或值只有空白）印一行警告後跳過該來源，落到下一層，TUI 照常啟動 —— 與現有 `config.json` 無法使用時的行為一致。
- README 的檢視器設定一節補上獨立執行的說明與新旗標。該節目前整段以 Herdr 外掛為前提，會把獨立執行的使用者導向錯誤的做法。

## Capabilities

### New Capabilities

（無 —— 本變更不引入新能力，只擴充兩個既有能力）

### Modified Capabilities

- `changes-pane`：`Open an artifact in the editor` 的檢視器解析順序由三個來源改為四個，最高優先者為命令列旗標。
- `standalone-cli`：新增一條 requirement 描述命令列參數面 —— 接受哪些選項、未知參數如何拒絕、`--help` 與 `--version` 的行為。

## Impact

- Affected specs: `changes-pane`、`standalone-cli`
- Affected code:
  - New:
    - src/cli-args.ts
    - test/cli-args.test.ts
  - Modified:
    - src/pane.tsx
    - test/pager.test.ts
    - test/tui/viewer.test.ts
    - README.md
  - Removed: （無）
- Affected dependencies: 無新增。參數解析以標準函式庫實作。
