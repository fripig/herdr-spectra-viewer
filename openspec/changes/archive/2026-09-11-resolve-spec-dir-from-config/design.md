## Context

`src/discovery/scan.ts` 目前以 `path.join(projectRoot, "openspec", "changes")` 組出作用中與已封存變更的來源目錄，`src/pane.tsx` 則以 `<專案根目錄>/openspec` 是否為目錄來判定「此專案是否已初始化」。兩處都把 `openspec` 當成字面常數。

Spectra 3.0.0 的 `spectra init` 會把新專案初始化在 `docs/spectra/`，並在專案根目錄寫出含未註解 `spec_dir: docs/spectra` 的 `.spectra.yaml`。該檔案自身的註解記載了相容規則：新專案初始化在 `docs/spectra`，沒有這個欄位的設定則解析為 `openspec`。

既有約束：

- discovery 層只能使用非同步檔案 API。`test/discovery/no-sync-fs.test.ts` 會掃描 `src/discovery/` 下的每個檔案，禁止 `from "node:fs"` 與任何 `*Sync(` 呼叫，新檔案自動落入這個檢查範圍。
- `yaml` 已是執行期相依（`src/discovery/metadata.ts` 用它解析 `.openspec.yaml`），不需新增套件。
- `ScanSnapshot` 已有 `warnings: string[]` 欄位，掃描期間的非致命問題有既成的呈現路徑。
- 本儲存庫自身的 `.spectra.yaml` 使用較舊的模板，`spec_dir` 那行是註解掉的，因此它本身就是「有設定檔但無該欄位」這條路徑的真實樣本。

## Goals / Non-Goals

**Goals**

- 讓現行 Spectra 建立的新專案（`docs/spectra/` 版面）能被正確掃描與顯示。
- 讓舊 Spectra／OpenSpec 專案（`openspec/` 版面）的行為完全不變。
- 讓解析規則與 Spectra CLI 逐字一致，避免 viewer 與 CLI 對同一專案得出不同結論。
- 把解析邏輯集中在單一位置，讓未來版面再變時只有一個落點。

**Non-Goals**

- 不依據磁碟上存在哪個目錄來推測版面。
- 不同時掃描並合併兩個 spec 目錄。
- 不改變暫存變更的位置，也不改變變更目錄內 `.openspec.yaml` 的檔名。
- 不讀取 `.spectra.yaml` 中 `spec_dir` 以外的任何欄位。

## Decisions

### 解析規則逐字對齊 Spectra CLI，不做磁碟探測

依 `.spectra.yaml` 的欄位決定 spec 目錄，欄位不存在時解析為 `openspec`。不實作「沒有 `spec_dir` 欄位但 `docs/spectra/` 存在就改用它」這類推測。

理由：viewer 只要採用 CLI 沒有的規則，就會出現 CLI 判定未初始化而 viewer 列出變更（或反之）的分歧。這種分歧沒有錯誤訊息、只有「數字對不上」的症狀，在使用者端極難歸因。一致性的價值高於多救回幾個邊緣專案。

考慮過的替代方案：先看設定、設定沒講再探測磁碟。被否決，理由同上。

### 解析失敗一律退回 openspec 並留下警告

`.spectra.yaml` 無法解析為 YAML、頂層不是物件、`spec_dir` 不是字串、字串去除空白後為空、或解析後的路徑落在專案根目錄之外時，一律退回 `openspec`，並產生一則警告字串。

理由：退回讓設定檔打錯字的舊專案仍然可用，而不是讓整個 pane 變磚；警告則保留可發現性。專用錯誤畫面需要 `App.tsx` 新增狀態分支，成本高於它換來的資訊量。

「欄位不存在」與「欄位不合用」必須分開：前者是舊專案的正常狀態，不得產生警告；後者才是設定錯誤。

### 解析函式獨立成 discovery 模組，scanChanges 簽名不變

新增 `src/discovery/spec-dir.ts`，匯出單一非同步函式。`scanChanges(projectRoot)` 的簽名與回傳型別不變，內部自行呼叫解析函式。

理由：有兩個呼叫端（掃描與「是否已初始化」判定），共用一份實作才不會漂移。若改成由 `src/pane.tsx` 解析後往下傳，`AppDeps` 介面與 `test/tui/App.test.tsx` 的所有測試替身都要跟著改，代價遠大於收益。

刪除測試：移除這個模組，掃描與初始化判定就得各自重複同一套 fallback 規則，兩邊會隨時間漂移。這個接縫藏了檔案不存在、YAML 損毀、型別不符、路徑逃逸四種情況與 fallback 決策，不是純轉發。

### 設定檔警告沿用掃描警告清單，狀態列文字改為通用說法

解析產生的警告加入 `ScanSnapshot.warnings`，與逐變更的略過警告共用同一個清單。狀態列原本顯示 `<N> change(s) skipped`，改為 `<N> warning(s)`。

理由：設定檔警告不是「被略過的變更」，沿用原文字會讓使用者在一個變更都沒被略過時看到「1 change(s) skipped」，標示與事實不符。維持單一警告通道比新增欄位便宜，代價只是一段文字改成通用說法，而通用說法對兩種來源都正確。

考慮過的替代方案：在 `ScanSnapshot` 新增獨立的設定警告欄位並分開呈現。語意最精確，但型別、UI 與測試都要多一層，換來的資訊量不值得。也考慮過只寫到標準錯誤而不進 UI，被否決，因為使用者在 pane 內會完全看不到線索。

### 已初始化判定改用解析後的 spec 目錄

`src/pane.tsx` 傳給 `App` 的判定函式改為解析後再檢查該目錄是否存在；`src/tui/App.tsx` 的未初始化訊息不得再寫死 `openspec` 這個名稱。

理由：這是使用者實際看到的症狀所在。掃描路徑修好而判定沒修，新專案仍會停在「未初始化」畫面，掃描結果根本沒機會顯示。

### 規格文字改以解析後的 spec 目錄表述

`change-discovery` 規格現有需求把 `openspec/changes/` 寫成字面常數。實作改動後這段文字會與程式碼直接矛盾，且 `spectra verify` 會抓到，因此同一變更內一併更新，並新增解析規則本身的需求與情境。

## Implementation Contract

**解析函式的可觀察行為**

輸入為專案根目錄的絕對路徑。輸出包含兩項：解析後 spec 目錄的絕對路徑，以及一則警告字串或「無警告」。

| 情況 | spec 目錄 | 警告 |
| --- | --- | --- |
| `.spectra.yaml` 不存在或無法讀取 | `<根目錄>/openspec` | 無 |
| 檔案存在、頂層為物件、無 `spec_dir` 鍵 | `<根目錄>/openspec` | 無 |
| `spec_dir` 為非空字串且解析後仍位於根目錄內 | `<根目錄>/<spec_dir>` | 無 |
| 檔案內容無法解析為 YAML | `<根目錄>/openspec` | 有 |
| 頂層不是物件 | `<根目錄>/openspec` | 無 |
| `spec_dir` 存在但不是字串 | `<根目錄>/openspec` | 有 |
| `spec_dir` 為空字串或僅含空白 | `<根目錄>/openspec` | 有 |
| `spec_dir` 為絕對路徑，或解析後逃出根目錄 | `<根目錄>/openspec` | 有 |

警告字串須同時指出設定檔位置與退回行為，例如點名 `.spectra.yaml` 並說明已改用 `openspec`。

**掃描行為**

`scanChanges` 先解析 spec 目錄，再以其組出作用中來源 `<spec 目錄>/changes/` 與已封存來源 `<spec 目錄>/changes/archive/`。解析產生的警告加入 `ScanSnapshot.warnings`，與既有的逐變更警告並列。暫存來源維持由已解析 git 目錄決定，不受影響。

狀態列在警告清單非空時顯示 `<N> warning(s)`，N 為清單長度，涵蓋設定警告與逐變更略過警告兩種來源。

三個群組在來源目錄不存在時仍各自為空且不拋出例外，與現行行為相同。

**初始化判定行為**

判定函式解析 spec 目錄後，檢查該路徑是否為目錄；是則視為已初始化。解析過程產生的警告在這條路徑上不重複呈現，警告只由掃描結果承載。

未初始化訊息須改寫為不含字面 `openspec` 的文字。

**範圍界線**

- 在範圍內：`src/discovery/spec-dir.ts`、`src/discovery/scan.ts` 的來源路徑組法、`src/discovery/index.ts` 的匯出、`src/pane.tsx` 的初始化判定、`src/tui/App.tsx` 的未初始化訊息與其相依介面命名、`src/tui/StatusBar.tsx` 的警告計數文字、以及對應測試。
- 不在範圍內：暫存變更的解析、`.openspec.yaml` 的讀取、排序與篩選、指令選單、其他編輯器的 viewer。

**驗收條件**

- `npm test` 全數通過，其中 `test/discovery/spec-dir.test.ts` 覆蓋上表每一列。
- `test/discovery/scan.test.ts` 新增一個案例：專案根目錄含 `spec_dir` 指向非預設目錄的設定檔時，作用中與已封存變更自該目錄下被掃出。
- `test/discovery/scan.test.ts` 既有案例在不新增設定檔的情況下維持通過，證明舊版面行為未變。
- `test/tui/App.test.tsx` 中未初始化案例改以新訊息斷言，且該訊息不含 `openspec` 字樣。
- `test/tui/App.test.tsx` 中狀態列警告計數案例改以 `2 warning(s)` 斷言。
- `test/discovery/no-sync-fs.test.ts` 涵蓋新檔案並通過，證明未引入同步檔案 API。
- `npm run typecheck` 無錯誤。

## Risks / Trade-offs

- **設定檔在兩次讀取之間被改動，導致初始化判定與掃描看到不同版面** → 兩者都在同一次重新整理內先後執行，時間窗極短；即使不一致，下一次重新整理即自我修正，且兩條路徑的 fallback 規則相同，最差情況是短暫顯示未初始化。
- **設定檔壞掉時使用者只看到一行警告，可能被忽略** → 這是刻意的取捨：讓舊專案維持可用優先於強制中斷。警告文字點名 `.spectra.yaml` 與退回行為，足以引導使用者自行查看。
- **狀態列文字改動影響既有使用者的閱讀習慣** → 只有一段字串變更，且新說法對原本的略過情境同樣正確，不會產生誤導。
- **每次掃描多一次小檔案讀取** → 單一小檔的非同步讀取，相對於既有的整棵變更樹掃描可以忽略。
- **Spectra 未來再改版面預設** → 解析集中在單一模組，屆時只有一個落點需要調整。

## Migration Plan

無資料遷移，也無設定遷移。使用者不需要做任何事：既有專案沿用 fallback 規則，行為不變；新專案在外掛更新後即可被掃描。回退方式為還原這次變更，不留下任何持久化狀態。

## Open Questions

無。解析規則已由 `.spectra.yaml` 模板的註解與實際 `spectra init` 輸出確認。
