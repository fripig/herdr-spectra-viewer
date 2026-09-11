## Why

Spectra 3.0.0 的 `spectra init` 已經把新專案初始化在 `docs/spectra/`，並在專案根目錄的 `.spectra.yaml` 寫入未註解的 `spec_dir: docs/spectra`。本外掛的掃描層把 `openspec` 寫成字面常數，因此**任何用現行 Spectra 建立的新專案，開啟 pane 後都會顯示「This project is not initialised for Spectra」**，即使該專案已有變更。

`.spectra.yaml` 自身的註解把相容規則講得很明確：新專案初始化在 `docs/spectra`，沒有這個欄位的設定則解析為 `openspec`。兩種版面必須同時支援 —— 新專案靠設定檔，舊 Spectra／OpenSpec 專案靠 fallback。

## What Changes

- discovery 層新增一個解析步驟：讀取專案根目錄的 `.spectra.yaml`，決定 spec 目錄的位置。
  - 有 `spec_dir` 且為非空字串 → 使用它（相對於專案根目錄解析）。
  - 檔案不存在，或存在但沒有 `spec_dir` 欄位 → 解析為 `openspec`，且不發出警告（這是舊專案的正常狀態）。
  - 檔案無法解析為 YAML、`spec_dir` 型別不對，或值解析後落在專案根目錄之外 → 解析為 `openspec`，並在掃描結果的警告清單中留下一行。
- 作用中與已封存變更的來源路徑改為跟隨解析結果：`<spec 目錄>/changes/` 與 `<spec 目錄>/changes/archive/`。
- 「此專案是否已初始化」的判斷改為檢查解析後的 spec 目錄是否存在，不再檢查字面的 `openspec` 目錄；未初始化訊息不得再寫死 `openspec` 這個名稱。
- 暫存變更的來源路徑不變，仍是已解析 git 目錄下的 `spectra-app/changes/`。
- 每個變更目錄內的 `.openspec.yaml` metadata 檔名不變。
- 掃描結果的警告清單同時承載設定檔警告，狀態列文字從 `<N> change(s) skipped` 改為通用的 `<N> warning(s)`，因為設定檔警告並非「被略過的變更」。
- `change-discovery` 規格中把 `openspec/changes/` 當作字面常數描述的需求文字一併更新，改以「解析後的 spec 目錄」表述，並新增解析規則本身的需求；`changes-pane` 規格中釘死未初始化訊息與狀態列文字的需求一併更新。

不新增執行期相依：專案已經依賴 `yaml` 套件，且 discovery 層只使用非同步檔案 API。

## Non-Goals (optional)

- **不自行探測磁碟版面。** 不實作「沒有 `spec_dir` 欄位但 `docs/spectra/` 存在就改用它」這類推測式 fallback。viewer 一旦採用 CLI 沒有的解析規則，就會出現 CLI 判定未初始化、viewer 卻列出變更（或反之）的分歧，這種分歧難以察覺也難以除錯。解析規則必須與 Spectra CLI 逐字一致。
- **不同時掃描兩個目錄合併顯示。** 一個專案只有一個 spec 目錄。
- **不變更暫存變更的位置**，也不變更變更目錄內的 metadata 檔名。
- **不支援重新載入設定以外的設定項。** 本次只讀 `.spectra.yaml` 的 `spec_dir`，`locale`、`tdd` 等欄位不在範圍內。
- **不處理其他編輯器的 viewer。** `idea-spectra-viewer` 有相同的硬編問題，由該儲存庫自己的變更提案處理。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `change-discovery`: 變更來源目錄的定位方式從字面的 `openspec/` 改為由 `.spectra.yaml` 的 `spec_dir` 決定，並新增解析與 fallback 規則的需求。
- `changes-pane`: 未初始化狀態的判定基準從「專案根目錄有無 `openspec` 目錄」改為「解析後的 spec 目錄是否存在」，訊息文字不再寫死目錄名稱；狀態列的警告計數文字改為通用說法。

## Impact

- Affected specs: `change-discovery`、`changes-pane`
- Affected code:
  - New:
    - `src/discovery/spec-dir.ts`
    - `test/discovery/spec-dir.test.ts`
  - Modified:
    - `src/discovery/scan.ts`
    - `src/discovery/index.ts`
    - `src/pane.tsx`
    - `src/tui/App.tsx`
    - `src/tui/StatusBar.tsx`
    - `test/discovery/scan.test.ts`
    - `test/tui/App.test.tsx`
  - Removed:（無）
- 相依套件：無新增。解析沿用既有的 `yaml` 相依，並遵守 discovery 層僅使用非同步檔案 API 的既有約束。
- 相容性：既有專案（無 `.spectra.yaml`、或該檔未設定 `spec_dir`）的行為完全不變。
