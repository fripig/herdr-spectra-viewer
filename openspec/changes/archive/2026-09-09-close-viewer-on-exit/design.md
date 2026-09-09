## Context

viewer pane 由 `openInEditorSplit` 切出來，它的 pane id 目前記在 App 元件裡的一個 `useRef`，只有下一次開檔要先關舊 pane 時會用到。pane 入口（`src/pane.tsx`）負責離開處理：目前只把滑鼠回報關掉，掛在 `process.on("exit")` 與 SIGINT／SIGTERM 上。離開時沒有人知道也沒有人去關那個 viewer pane。

三項已實測的前提：

1. 對 plugin pane 送 `q` 後，plugin pane 消失但 viewer pane 仍在。
2. Herdr 從外部關掉 pane 時，前景進程收到可攔截的 SIGHUP，約 200ms 後被強制終止（trap 實測最後一筆為 `alive+205`）。
3. 對已消失的 pane 下 pane close 會回 `pane_not_found` 但離開碼是 0（前一個 viewer change 已測得）。

前提 2 決定了關閉必須是**同步**的：`process.on("exit")` 只跑得動同步程式碼，SIGHUP 的時間預算也不容許等待非同步回呼。

## Goals / Non-Goals

**Goals:**

- 六條離開路徑（`q`、Escape、送出指令後離開、SIGINT、SIGTERM、SIGHUP）都不留下 viewer pane。
- 關閉失敗不改變離開碼、不顯示訊息、不阻擋離開。

**Non-Goals:**

- 不改開檔行為：仍是 close → split → run，仍然最多一個 viewer pane。
- 不保證 SIGHUP 情境百分之百關成功；200ms 預算內搶不到就放棄。
- 不做存活探測，不解析 pane close 的輸出。
- 不改 viewer 指令、`SPECTRA_VIEWER` 解析、status bar 訊息。

## Decisions

### Lift the remembered viewer pane into shared state

把記住的 viewer pane id 從 App 內部的 `useRef` 改成由 pane 入口建立、透過 `AppDeps` 傳入的一個 `{ current: string | null }` holder。App 開檔後照舊寫入，pane 入口的離開處理則直接讀它。

為什麼不用回呼通知入口：holder 只有一個欄位，兩邊都要最新值，回呼等於再手動同步一份狀態。React ref 的形狀本來就是 holder，改成外部傳入不動元件邏輯。

替代方案：把離開處理搬進元件、用 `useEffect` 清理。否決，因為 SIGINT／SIGTERM／SIGHUP 與 `process.on("exit")` 都在元件生命週期之外。

### Close the viewer synchronously on every exit path

新增一個與 `mouseLifecycle` 同形狀的 `viewerLifecycle(close, ref)`，回傳 `shutdown()`：holder 有值就呼叫一次 close 並把 holder 清成 null，沒值就什麼都不做；close 拋錯一律吞掉。正式環境的 close 用 `execFileSync` 跑 Herdr binary，設 1000ms timeout、stdio 全部 ignore。

掛在 `process.on("exit")` 上就涵蓋所有正常離開：`q`、Escape、送出指令後的 `onExit(0)` 都是走 `process.exit`，`exit` 事件必然觸發。訊號處理維持既有寫法，多註冊 SIGHUP（離開碼 129）。holder 清空讓重複觸發只關一次。

為什麼同步：`process.on("exit")` 不跑非同步工作，SIGHUP 只有約 200ms。既有的非同步 `HerdrClient` 在這裡用不上。

替代方案：讓 App 在 `onExit` 之前 await 一次非同步 close。否決，因為那只涵蓋兩條路徑，訊號路徑仍會留下 pane，等於要維護兩套關閉邏輯。

### Ignore the outcome of the close

close 的離開碼與輸出一律不看：pane 已消失時 Herdr 回 `pane_not_found` 但離開碼 0，而離開流程中也沒有畫面可以顯示錯誤。Binary 路徑不存在時 `execFileSync` 拋錯，同樣吞掉。

## Implementation Contract

**Behavior**

- 開過 artifact 後按 `q` 或 Escape：plugin pane 與 viewer pane 都從 Herdr 的 pane 清單消失，離開碼 0。
- 開過 artifact 後按指令鍵並送出成功：指令進入目標 pane，plugin pane 與 viewer pane 都消失。
- 沒開過 artifact 就離開：不發出任何 pane close。
- viewer 已被使用者自己關掉後才離開：仍會對記住的 id 發一次 close，Herdr 回 not-found，離開碼仍是 0。
- Herdr 從外部關掉 plugin pane（SIGHUP）：在被強制終止前盡力發出 close，成功與否不影響其他行為。

**Interface / data shape**

- `AppDeps` 新增 `viewerPane: { current: string | null }`，取代元件內部的 `useRef`；開檔成功寫入新 pane id，開檔失敗時寫入失敗回報帶回的 pane id 或 `null`（與現行 `ViewerResult` 處理一致）。
- `viewerLifecycle(close: (paneId: string) => void, ref: { current: string | null })` 回傳 `{ shutdown(): void }`。`shutdown` 對非 null 的 `ref.current` 呼叫 `close` 一次，然後把 `ref.current` 設為 `null`；`close` 拋出的例外一律吞掉。
- pane 入口的正式 close 實作：以 `execFileSync` 執行 Herdr binary，argv 為 `["pane", "close", <paneId>]`，timeout 1000ms，stdio ignore；binary 路徑為 null 時不執行任何動作。
- 訊號清單由 SIGINT、SIGTERM 擴充為 SIGINT、SIGTERM、SIGHUP，離開碼分別為 130、143、129。

**Failure modes**

- close 非零離開碼或拋錯：吞掉，不寫 stderr，不改離開碼。
- holder 為 null：不呼叫 close。
- `shutdown` 被呼叫兩次（例如訊號處理後又觸發 `exit` 事件）：只有第一次會呼叫 close。

**Acceptance criteria**

- `npx vitest run` 全綠（既有偶發失敗的 `expands parked with Right` 除外）。
- `test/tui/mouse-lifecycle.test.ts` 新增 `viewerLifecycle` 測試：有值關一次並清空、null 不關、close 拋錯不外傳、連續兩次 shutdown 只關一次。
- `test/tui/App.test.tsx` 斷言開檔成功後 `viewerPane.current` 是新 pane id，開檔前為 null。
- 手動驗證：開 plugin pane、開一個 artifact、送 `q`，`herdr pane list` 中兩個 pane 都不在。

**Scope boundaries**

- In scope：`src/pane.tsx` 的離開處理與訊號清單、`src/tui/App.tsx` 的 viewer pane 記憶來源、對應測試、README 說明。
- Out of scope：開檔的 close → split → run 順序、`SPECTRA_VIEWER` 解析、指令鍵行為、manifest placement。

## Risks / Trade-offs

- [SIGHUP 只有約 200ms，close 可能來不及送達] → 同步 `execFileSync` 直接送出，不做任何等待或重試；搶不到就維持今天的行為（viewer 留著），不會更糟。
- [`execFileSync` 在 `exit` 事件中阻塞行程] → 設 1000ms timeout，超時即放棄。
- [holder 由外部傳入，元件不再擁有自己的狀態] → holder 只在開檔成功／失敗兩處寫入，測試會斷言其值，誤用會被測試擋下。
