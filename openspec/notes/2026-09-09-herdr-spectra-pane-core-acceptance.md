# Acceptance: herdr-spectra-pane-core（2026-09-09）

環境：Herdr 0.9.0、Node 24.20.0、macOS。

## 自動化驗證

- `npm test`：12 files, 113 tests passed。
- `npm run check-dist`：exit 0，`dist/pane.js` 與 `dist/open.js` 存在。
- 真實 TTY（expect pty 100x30）執行 `node dist/pane.js`：顯示 Active (1) / Parked (0) / Archived (0)，`herdr-spectra-pane-core (11/21)`，`l` 展開後列出五個 artifact。

## Live Herdr 驗收

| 步驟 | 結果 |
|---|---|
| `herdr plugin link <repo>` | 成功；manifest 需移除 overlay 的 width/height，並加 `platforms` 才無警告 |
| `herdr plugin pane open --plugin spectra-viewer --entrypoint changes` | overlay 開在聚焦 pane 上，內容顯示三群組與 `(19/21)` 進度 |
| `send-keys j` | 游標移到 change 節點 |
| `send-keys a` | overlay 隨即關閉（exit 0），表示 `pane send-text` 回傳 0；文字送往召喚 pane |
| `openInEditorSplit` 對 scratch pane，editor=`true` | `pane split --pane w4:p3 --direction right --cwd <root>` 回傳新 pane w4:p5，接著 `pane run w4:p5 "true '<path>'"` exit 0 |
| `min_herdr_version` | 確認為 0.9.0（`herdr --version`） |

## 與原 spec 的偏差（已同步修正 artifacts）

- `pane split` 沒有 `--json` 旗標，輸出預設即為 JSON。
- `workspace get` 不含 cwd；新增「project root 退回 `pane get <paneId>` 的 cwd」需求。
- overlay placement 不接受 width/height。
- overlay 與 popup 只能開在 active pane 上，`--target-pane` 無效。

## 未在自動化中驗證

- 實際以 `$EDITOR`（vi/nvim）開檔的視覺結果，僅驗證了兩步 CLI 呼叫流程。
- Linux 剪貼簿指令（wl-copy / xclip）。
