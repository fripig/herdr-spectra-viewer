## 1. README 補上開啟路徑

- [x] 1.1 README 新增一節記錄如何觸發 open action，滿足 spec 需求 README documents how the open action is invoked：該節寫出 herdr plugin action invoke spectra-viewer.open 這個從任一 Herdr pane 都能用、且不需改任何設定的觸發指令。驗證：在 README.md 搜尋該指令字串確認存在，並在 Herdr pane 實際執行一次，確認 Spectra changes pane 開起來。
- [x] 1.2 同一節附上可直接複製的 keys.command 綁定範例（type 為 plugin_action、command 為 spectra-viewer.open、key 標示成可替換的示範鍵位），指名這段設定屬於使用者自己的 Herdr config.toml，並寫出 herdr server reload-config 這個讓改動生效的步驟。驗證：內容審查確認設定檔位置、TOML 區塊、示範鍵位可自行替換的說明、reload 指令四項都在；並照文件貼一次設定、按下該鍵，確認 pane 開起來。
- [x] 1.3 同一節寫明 Herdr 0.9.0 的 plugin manifest 無法宣告快捷鍵，所以沒有預設鍵位是格式使然而不是安裝失敗。驗證：內容審查確認這段說明存在，且就在綁定範例旁邊，讀者不必翻到別節才知道原因。
- [x] 1.4 Install 一節那句沒有下文的「Open the pane with the spectra-viewer: open action」改為指向新一節，讀者照著讀不會停在無法執行的指示上。驗證：內容審查確認 README.md 裡不再有任何沒有指向開啟說明的裸 action 指示。

## 2. 驗證與收尾

- [x] 2.1 確認這次文件變更沒有動到任何程式行為：執行 npm test，packaging manifest 與 TUI 測試維持全綠。驗證：vitest 全數通過的實際輸出。
- [x] 2.2 確認 artifacts 與實作一致：執行 spectra validate document-pane-opening-path 與 spectra analyze document-pane-opening-path。驗證：兩個指令都沒有 Critical 或 Warning。
