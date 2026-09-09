## Context

changes pane 目前在 herdr-plugin.toml 中以 placement `overlay` 宣告。當 invocation context 帶有工作 pane id 時，按下指令鍵會執行 `herdr pane send-text <commandPaneId> <text>`，成功後 plugin 行程以離開碼 0 結束，overlay 因而關閉、焦點回到工作 pane，該 pane 此時已握有尚未送出的指令。正是「會離開」這件事讓 overlay 堪用：一個持續開著的 overlay 會擋住使用者要按 Enter 的那個 pane。

2026-09-09 的討論確立了：使用者希望送出指令後還能繼續瀏覽樹狀檢視，而這件事只有在 pane 不再覆蓋工作 pane 時才值得做。本文件最初列為卡關的兩個未知數，已在同日以 Herdr 0.9.0 實測解答：

1. **split placement 不必經過 manifest。** `herdr plugin pane open --plugin spectra-viewer --entrypoint changes --placement split --direction right` 開出來的版面為 `w4:p1` 位於 `x=0 width=78`、plugin pane 位於 `x=78 width=77`，確實是左右並排。省略 `--target-pane` 也會從當時 focused 的 pane 切開，因此不需要那個參數。
2. **焦點可以交還。** 對 plugin pane 執行 `herdr pane focus --pane <plugin pane id> --direction left` 回傳 `changed: true`、`focused_pane_id` 為工作 pane。

第三個原本要處理的項目也已經不存在：`command-target-pane`（已歸檔）確認 `HERDR_PANE_ID` 是 plugin 自己的 pane、工作 pane 在 `HERDR_PLUGIN_CONTEXT_JSON.focused_pane_id`，並已把 `InvocationContext` 拆成 `paneId`（自己）與 `commandPaneId`（工作 pane）。本 change 直接沿用這兩個欄位，不再新增 `selfPaneId`。

相關工作：`mouse-support`、`viewer-pager`、`single-viewer-pane`、`command-target-pane`、`close-viewer-on-exit` 都已歸檔，先前記錄的檔案衝突風險消失。`close-viewer-on-exit` 讓離開時會關掉 viewer pane；本 change 不改離開路徑，因此該行為不受影響。

## Goals / Non-Goals

**Goals:**

- changes pane 以開啟它的 pane 右側 split 開啟，並在送出指令後保持開啟。
- 送出成功後狀態列顯示 `Sent: <command text>`，鍵盤焦點移到工作 pane，讓 Enter 不需要額外按鍵就能送出指令。
- `q` 與 Escape 仍是關閉 pane 的唯二方式。
- 剪貼簿 fallback 的三條路徑（沒有工作 pane id、送出失敗、複製失敗）維持現有措辭，也維持 pane 開啟。

**Non-Goals:**

- 不處理使用者連送兩個指令、中間沒按 Enter 時工作 pane 輸入列的文字疊加。`Sent:` 訊息是唯一的防護。用 `send-keys` 清空輸入列在 shell 與 Claude Code 的行為不同，因此否決。
- 不改 manifest 的 placement，也不讓 placement 可由使用者設定。
- 不自動送出指令。`send-text` 仍然不帶換行插入。
- 不處理 split 寬度的調整、放大或其他版面管理。
- 不改動掃描、樹狀渲染、viewer split、離開路徑或滑鼠處理。

## Decisions

### The open action requests the split instead of the manifest

open action 執行的指令加上 `--placement split --direction right`；manifest 的 `[[panes]]` 條目維持 `placement = "overlay"`。實測顯示這組參數就足以開出右側 split，而且不必帶 `--target-pane`：Herdr 會從當時 focused 的 pane 切開，那正是叫起 plugin 的 pane。

為什麼不改 manifest：`herdr-plugin-packaging` spec 目前明文要求 manifest 宣告 placement `overlay`，改它會連帶改動 manifest 需求與其測試，而參數路徑同樣達成目的且已實測。manifest 的 placement 從此只是「沒有指定參數時的預設」。

已否決的替代方案：維持 overlay，只是送出後不離開。那會失去模態 overlay 唯一的好處（自動把焦點交還），卻保留它的代價（擋住工作 pane），嚴格來說比現行行為更差。

### Send keeps the pane open and reports in the status bar

在 TUI 的送出處理中，成功分支不再呼叫離開的 callback，而是把狀態訊息設成 `Sent: <command text>`，接著請 adapter 把焦點移到工作 pane。樹狀檢視、游標與展開狀態都不受影響，也不觸發掃描。失敗與無 pane 的分支不變。

### Focus hand-back reuses the context's own pane id

在 Herdr client 新增 adapter 函式 `focusPane(client, opts)`，執行 `pane focus --pane <paneId> --direction left`，回傳與 `sendTextToPane` 相同的 `AdapterResult` 形狀。這裡的 `paneId` 就是 `InvocationContext.paneId`（plugin 自己的 pane），不需要新欄位。方向是與 open action 的 `--direction right` 綁定的常數：plugin pane 在右邊，工作 pane 就在它左邊。

焦點呼叫失敗時 pane 保持開啟，狀態列顯示 `Sent, but could not focus pane`。指令其實已經送出成功，所以這只是資訊，不是退回剪貼簿。

已否決的替代方案：`pane focus --current --direction left`。傳明確的 id 已經實測可行，而且讓 adapter 保持決定性、好寫單元測試。

## Implementation Contract

**Behaviour**

- 從 `open` action 或快速鍵開啟時，pane 位於呼叫端 pane 的右側 split，兩者並排。樹狀檢視渲染與今日相同。
- 游標在 change `add-search` 上、且 `commandPaneId` 為 `p1`、`paneId` 為 `p7` 時按 `a`：執行 `pane send-text p1 "/spectra-apply add-search"`，接著 `pane focus --pane p7 --direction left`。plugin pane 保持開啟，狀態列顯示 `Sent: /spectra-apply add-search`，焦點在 `p1`。
- 若焦點呼叫回報失敗或 `paneId` 為 null：狀態列顯示 `Sent, but could not focus pane`，pane 保持開啟。
- 若 `send-text` 回報失敗：行為不變，走剪貼簿 fallback、pane 保持開啟、顯示 `Herdr send failed, copied instead`。
- 沒有 `commandPaneId` 時：行為不變，寫剪貼簿、pane 保持開啟、顯示 `Copied: <text>`。
- `q` 與 Escape 以離開碼 0 離開，並照 `close-viewer-on-exit` 的規則關掉記住的 viewer pane。沒有其他按鍵會離開。

**Interfaces**

- open action 的 argv：`["plugin", "pane", "open", "--plugin", <pluginId>, "--entrypoint", "changes", "--placement", "split", "--direction", "right"]`。
- Herdr client 的 `focusPane(client: HerdrClient, opts: { paneId: string }): Promise<AdapterResult>`；argv 為 `["pane", "focus", "--pane", paneId, "--direction", "left"]`；離開碼 0 回 `{ ok: true }`，否則回 `{ ok: false, reason }` 並在 reason 中指出離開碼，絕不拋出例外。
- `AppDeps` 新增同簽章的 `focusPane`，讓測試注入假物件。
- `InvocationContext` 不變。

**Failure modes**

- 焦點失敗一律呈現在狀態列，絕不拋出例外。
- `paneId` 為 null 時與焦點失敗同等處理，且不呼叫 adapter。
- 不新增任何離開路徑。App 的 `exited` 防護維持原樣。

**Acceptance criteria**

- `test/herdr/open.test.ts` 驗證 open action 的確切 argv 含 `--placement split --direction right`。
- `test/herdr/client.test.ts` 驗證 `focusPane` 的確切 argv、離開碼 0 的成功結果、離開碼 2 的失敗結果，以及 binary 路徑為 null 時不 spawn 直接失敗。
- `test/tui/App.test.tsx` 驗證送出成功後不呼叫 `onExit`、`focusPane` 以 `paneId` 被呼叫一次、狀態列顯示 `Sent: /spectra-apply add-search`；焦點失敗與 `paneId` 為 null 兩種情況都顯示 `Sent, but could not focus pane`；無 pane 與送出失敗兩條路徑不呼叫 `focusPane`；既有那則「sends … and exits」測試改寫成新契約。
- `npx vitest run` 與 `npm run build` 通過。
- 手動：`herdr plugin link` 後開啟 pane，在某個 change 上按 `a`，觀察 split 保持開啟、狀態列顯示 `Sent: …`、工作 pane 已有文字且已取得焦點，按 Enter 直接送出；再按 `q` 觀察 split 關閉。

**Scope boundaries**

- In scope：open action 參數、`focusPane` adapter 與其匯出、送出處理的成功分支、狀態訊息、README 說明，以及各自的測試。
- Out of scope：manifest、invocation context 欄位、viewer split 與其離開時的關閉、掃描、tree model、滑鼠處理、Non-Goals 列出的一切。

## Risks / Trade-offs

- [連送兩次造成工作 pane 文字疊加] → 接受。`Sent:` 訊息會告訴使用者有一個指令正等著按 Enter。
- [split 會從工作 pane 搶走寬度] → 目前接受；寬度管理列為 non-goal。`changes-pane` spec 只處理窄高度、不處理窄寬度，所以極窄的終端會截斷長名稱。
- [焦點方向寫死 left，若日後 open action 改成 `--direction down` 會失效] → 兩者都在本 change 的 scope 內，測試同時驗證兩處 argv，改一邊會讓另一邊的測試失敗。
- [manifest 與實際 placement 不一致，讀 manifest 的人會誤會] → README 會寫明 placement 由 open action 指定；manifest 的值只在沒帶參數時生效。

## Migration Plan

沒有資料或 manifest 變更。重新 build 並重開 pane 就會得到 split placement 與常駐行為。回滾方式是還原 open action 參數與送出處理。

## Open Questions

無。原本的兩個探測問題已於 2026-09-09 實測解答，結果記錄在 Context。
