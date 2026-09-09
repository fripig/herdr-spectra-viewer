## Why

開啟 artifact 用的 viewer 目前只能從 `SPECTRA_VIEWER` 環境變數指定。plugin pane 是 Herdr server 直接 spawn 的行程，繼承的是 server 啟動時的環境，不是互動 shell，所以使用者寫在 shell profile 的設定不一定傳得到；而且那是一個全域變數，不是「這個 plugin 的設定」。Herdr 已經替每個 plugin 準備好一個設定目錄並透過 `HERDR_PLUGIN_CONFIG_DIR` 告知，本 plugin 目前完全沒有使用它。

## What Changes

- viewer 的解析從兩層變成三層：`SPECTRA_VIEWER` 環境變數 > plugin 設定檔的 `viewer` 字串 > `less`。
- 新增讀取 `HERDR_PLUGIN_CONFIG_DIR` 目錄下 `config.json` 的邏輯，只取其中的 `viewer` 字串欄位。
- 設定檔不存在、不是合法 JSON、缺少 `viewer` 欄位、或該欄位不是非空字串時，一律當作沒有設定，退回下一層來源；解析失敗會透過既有的 warn 機制回報，不中斷開啟流程。
- `HERDR_PLUGIN_CONFIG_DIR` 未設定時（例如不是由 Herdr 啟動）跳過設定檔這一層。
- README 的 Viewing an artifact 一節補上設定檔的位置、格式與優先序。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `changes-pane`: `Open an artifact in the editor` requirement 目前明文規定 viewer 只由 `SPECTRA_VIEWER` 與 `less` 兩層決定，需改寫為三層來源與各層的失效退回條件。

## Impact

- Affected specs: changes-pane
- Affected code:
  - New: src/config.ts
  - Modified: src/pane.tsx
  - Modified: test/tui/viewer.test.ts
  - Modified: README.md
  - Removed: (none)
