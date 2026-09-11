## 1. 解析模組

- [x] 1.1 在 `src/discovery/spec-dir.ts` 實作 spec 目錄解析，交付 `Requirement: Resolve the spec directory from project configuration` 的核心契約：讀取專案根目錄的 `.spectra.yaml`，`spec_dir` 為非空字串時回傳該值相對專案根目錄解析後的絕對路徑，檔案不存在或無該鍵時回傳 `<根目錄>/openspec` 且不帶警告。依照決策「解析函式獨立成 discovery 模組，scanChanges 簽名不變」，函式同時回傳解析路徑與「一則警告或無警告」，並只使用非同步檔案 API。驗證：新增 `test/discovery/spec-dir.test.ts` 覆蓋這三種情況，`npm test` 通過，且 `test/discovery/no-sync-fs.test.ts` 對新檔案通過。
- [x] 1.2 讓解析在設定檔無法使用時退回並發出警告，交付決策「解析失敗一律退回 openspec 並留下警告」：內容無法解析為 YAML、`spec_dir` 不是字串、去除空白後為空字串、為絕對路徑、或解析後逃出專案根目錄時，回傳 `<根目錄>/openspec` 並附一則點名 `.spectra.yaml` 與退回行為的警告字串；頂層不是 mapping 時退回但不警告。驗證：`test/discovery/spec-dir.test.ts` 逐列覆蓋 design.md 解析結果表中所有「有警告」與「無警告」列，`npm test` 通過。
- [x] 1.3 確立不做磁碟探測的行為，交付決策「解析規則逐字對齊 Spectra CLI，不做磁碟探測」：專案同時存在 `docs/spectra/` 目錄與一份沒有 `spec_dir` 鍵的 `.spectra.yaml` 時，解析結果仍為 `<根目錄>/openspec`，解析過程不得檢查任何候選目錄是否存在。驗證：`test/discovery/spec-dir.test.ts` 新增此案例並通過。
- [x] 1.4 從 `src/discovery/index.ts` 匯出解析函式與其回傳型別，讓 pane 層不必深入模組內部路徑即可取用。驗證：`npm run typecheck` 無錯誤，且 `src/pane.tsx` 能自 discovery 模組入口匯入該函式。

## 2. 掃描整合

- [x] 2.1 讓 `scanChanges` 依解析結果定位變更來源，交付 `Requirement: Scan changes from all three Spectra sources` 的修訂行為：作用中變更取自解析後 spec 目錄下的 `changes/`（排除 `archive`），已封存變更取自其下的 `changes/archive/`，暫存變更維持取自已解析 git 目錄下的 `spectra-app/changes/`，函式簽名與回傳型別不變。驗證：`test/discovery/scan.test.ts` 新增一個案例，專案根目錄含 `spec_dir` 指向 `docs/spectra` 的設定檔時，作用中與已封存變更自該目錄下被掃出；既有案例在不新增設定檔的情況下維持通過，`npm test` 全數通過。
- [x] 2.2 讓設定檔警告進入掃描結果，交付決策「設定檔警告沿用掃描警告清單，狀態列文字改為通用說法」的資料面：解析產生的警告加入 `ScanSnapshot.warnings`，與逐變更的略過警告並列，且解析失敗不得讓掃描拋出例外。驗證：`test/discovery/scan.test.ts` 新增案例斷言設定檔壞掉時掃描仍回傳三個群組且 `warnings` 恰含一則提及 `.spectra.yaml` 的訊息，`npm test` 通過。
- [x] 2.3 確認設定了非預設 spec 目錄時舊目錄被忽略：專案設定 `spec_dir: docs/spectra` 且 `openspec/changes/` 下另有變更時，作用中群組只含新目錄下的變更。驗證：`test/discovery/scan.test.ts` 對應案例通過。

## 3. Pane 呈現

- [x] 3.1 讓未初始化判定改看解析後的目錄，交付決策「已初始化判定改用解析後的 spec 目錄」與 `Requirement: Indicate loading, empty, and warning states` 的判定面：`src/pane.tsx` 傳給 `App` 的判定函式先解析 spec 目錄再檢查其是否為目錄，不再檢查字面的 `openspec`。驗證：在一個以現行 `spectra init` 建立的暫時專案上執行 `node dist/pane.js` 時顯示變更樹而非未初始化訊息，且 `npm test` 通過。
- [x] 3.2 改寫未初始化訊息，使其不含任何固定目錄名稱，文字為 `This project is not initialised for Spectra (no spec directory).`。驗證：`test/tui/App.test.tsx` 的未初始化案例以新訊息斷言，並斷言該訊息不含 `openspec` 字樣；`src/` 與 `test/` 下搜尋不到 `no openspec directory` 字串（主 spec 由 delta 在 archive 時套用，已封存變更為歷史紀錄，兩者皆不在此任務範圍）。
- [x] 3.3 將狀態列警告計數改為通用說法，交付決策「設定檔警告沿用掃描警告清單，狀態列文字改為通用說法」的呈現面：`src/tui/StatusBar.tsx` 在警告數大於零時顯示 `<N> warning(s)`，取代 `<N> change(s) skipped`。驗證：`test/tui/App.test.tsx` 的警告計數案例改以 `2 warning(s)` 斷言並通過。

## 4. 驗證與規格一致性

- [x] 4.1 交付決策「規格文字改以解析後的 spec 目錄表述」的一致性檢查：確認本變更的 delta 規格與實作行為相符，`change-discovery` 與 `changes-pane` 兩份 delta 中的每個情境都有對應的通過測試。驗證：`spectra validate resolve-spec-dir-from-config` 與 `spectra analyze resolve-spec-dir-from-config` 皆無 Critical 或 Warning 等級的問題。
- [x] 4.2 交付整體回歸把關：型別檢查與完整測試套件在本變更後皆為綠燈，且建置產物仍包含兩個進入點。驗證：`npm run typecheck`、`npm test`、`npm run check-dist` 三者皆成功。
