## Why

Herdr 0.9.0 的 plugin manifest 沒有可以宣告快捷鍵的欄位（action 只接受 id、title、command、contexts、platforms、description），Herdr 也沒有列出 plugin action 的命令面板。README 目前只寫「Open the pane with the spectra-viewer: open action」，卻從頭到尾沒說這個 action 要怎麼觸發。照 README 裝完外掛的人因此手上沒有任何能打開 Spectra changes pane 的路徑，看起來像安裝失敗。

## What Changes

- README 新增一節說明開啟路徑：在任一 Herdr pane 執行 CLI 觸發指令 herdr plugin action invoke spectra-viewer.open。
- 該節附上可直接複製的 keys.command 設定片段（type 為 plugin_action、command 為 spectra-viewer.open），寫進使用者自己的 Herdr config.toml，並說明改完要執行 herdr server reload-config 才生效。
- 該節明講 Herdr 0.9.0 的 manifest 無法內建快捷鍵，鍵位一定由使用者自己綁，讓讀者知道「沒有預設快捷鍵」是規格而不是缺陷。
- Install 一節那句沒有下文的「Open the pane with the spectra-viewer: open action」改為指向新一節。
- herdr-plugin-packaging spec 新增一條需求：README 必須說明 open action 的觸發路徑與快捷鍵綁定方式。

## Non-Goals

- 不修改 herdr-plugin.toml。Herdr 0.9.0 的 manifest schema 沒有鍵位欄位，寫了也不會被讀取。
- 不代使用者寫入 Herdr 的 config.toml。那是使用者自己的設定檔，外掛不該代寫，選定的鍵位也可能撞到既有綁定。
- 不改 pane 或 open action 的執行行為，src/open.ts 傳給 Herdr 的參數維持原樣。
- 不涵蓋 Windows。manifest 只宣告 macos 與 linux 兩個平台。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `herdr-plugin-packaging`: 新增需求，要求 README 記錄 open action 的觸發路徑（CLI 指令與使用者自綁快捷鍵），並說明 manifest 無法宣告快捷鍵這件事。

## Impact

- Affected specs: herdr-plugin-packaging
- Affected code:
  - Modified: README.md
  - New: (none)
  - Removed: (none)
