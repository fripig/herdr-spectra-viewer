## Why

這個 viewer 的掃描與 TUI 兩層共 1448 行完全不依賴 Herdr——`src/discovery/` 連 herdr 這個字都沒出現過，`src/tui/App.tsx` 對 Herdr 的 import 全是 type-only，執行期耦合只集中在 `src/pane.tsx` 的組裝碼與 `src/herdr/` 的 366 行 adapter。它已經能在任何終端獨立跑（實測 `node dist/pane.js` 可正常列出變更），但沒有任何封裝讓人裝得到：`package.json` 標著 `"private": true`、沒有 `bin`、`dist/` 在 gitignore 裡。

更嚴重的是，現有的 entry-point 判斷讓任何經由符號連結的安裝方式**靜默失效**。`src/pane.tsx` 拿 `process.argv[1]` 直接和 `import.meta.url` 比對，但 npm 建立的 `node_modules/.bin/` 項目是符號連結：`argv[1]` 是連結本身的路徑，`import.meta.url` 是解析後的真實路徑，兩者永不相等，於是 `main()` 不執行、行程正常結束、終端上什麼都沒有。這不是未來的問題，現在 `npm link` 就已經是這個結果。

## What Changes

- 修正兩個進入點的 entry-point 判斷，改為比對解析符號連結後的真實路徑，讓經由 `node_modules/.bin/` 或 `npm link` 執行時 `main()` 會真的跑起來。`src/open.ts` 的判斷同時改掉字串拼接 `file://` 的寫法——它沒有做 percent-encoding，路徑含空白或 `#` 就會比對失敗。
- 讓 pane 進入點成為可直接執行的指令：原始碼首行加上 interpreter 指示行，編譯後保留在產出檔第一行。
- `package.json` 改為可發佈：套件名改為 `spectra-viewer`、移除 `private`、宣告 `bin`（`spectra-viewer` 與短名 `sv`）、`files` 只收 `dist`、發佈前建置。套件名與其中一個 `bin` 名稱必須相同，否則 `npx spectra-viewer` 找不到指令可執行。
- 新增一條不經 Herdr 的檢視路徑：沒有 Herdr 時，按 `e` 直接在當前終端啟動分頁器顯示 artifact，離開後回到 TUI。目前這個情境只會顯示 `Could not open viewer`。
- Herdr 外掛的行為完全不變：manifest、`[[build]]`、pane 與 action 的啟動方式、有 Herdr 時的右側 split pane 檢視都照舊。

## Capabilities

### New Capabilities

- `standalone-cli`: 這個 viewer 作為獨立命令列程式的發佈與執行——套件封裝與 `bin` 宣告、經由符號連結執行時的進入點判斷、以及沒有 Herdr 時在當前終端檢視 artifact 的路徑。

### Modified Capabilities

- `changes-pane`: `Open an artifact in the editor` 目前無條件規定「透過 Herdr adapter 開一個右側 split pane」。改為依執行環境分流：有 Herdr 時維持現行行為不變，沒有 Herdr 時走 `standalone-cli` 定義的分頁器路徑。

## Impact

- Affected specs: `standalone-cli`（新增）、`changes-pane`（修改）
- Affected code:
  - New: `src/pager.ts`, `test/pager.test.ts`
  - Modified: `package.json`, `src/pane.tsx`, `src/open.ts`, `test/herdr/open.test.ts`, `test/tui/App.test.tsx`, `README.md`
  - Removed: （無）
- 依賴：不新增任何執行期依賴，分頁器以 Node 內建的行程啟動 API 執行。
- 發佈通道：多一條 npm registry 的發佈路徑，`herdr-plugin-packaging` 的 manifest 與建置流程不受影響，因為沒有任何 requirement 綁定 npm 套件名。
