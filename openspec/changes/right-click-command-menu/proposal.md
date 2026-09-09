## Why

送出 `/spectra-*` 指令目前只有一條路：把游標移到那個 change 上，再按 `d` / `a` / `i` / `r` / `c`。使用滑鼠瀏覽樹的人得在中途切回鍵盤，而且五個字母代表哪個指令只寫在狀態列的一行提示裡，記不住就得先讀狀態列再按鍵。

右鍵目前是完全空的輸入：實測 Herdr 0.9.0 已經會把右鍵以 SGR `button 2` 送進 pane，但 `src/tui/mouse.ts` 的解析器把它丟掉。把右鍵接起來就能讓「選一個 change、選一個指令」變成純滑鼠的兩步操作，指令清單也直接畫在畫面上而不是靠記憶。

## What Changes

- 滑鼠報文解析新增一種事件：SGR `button 2` 加 `M` 解析成右鍵按下，其餘未知 button 仍然丟棄。
- 在樹的某一列上按右鍵：先把游標移到該列（與左鍵一致），再於點擊位置開啟一個浮動指令選單。
- 浮動選單列出既有的五個指令 `d discuss`、`a apply`、`i ingest`、`r archive`、`c commit`，順序與狀態列相同。選單以 Ink 的絕對定位畫在樹之上，會覆蓋底下的字而不是把樹擠開。
- 選單靠近 pane 右緣或下緣時往內夾（clamp），整個選單框永遠留在 pane 內。
- 選單可用滑鼠點選，也可用 `↑` `↓` / `j` `k` 移動加 Enter 選定；Escape 或點在選單外關閉，兩者都不送出任何東西。
- 選定後走既有的送指令路徑，`Sent:`、`Sent, but could not focus pane`、`Copied:`、`Herdr send failed, copied instead`、`Copy failed:` 五種結果與按鍵操作完全相同。
- 在群組節點上按右鍵不開選單，狀態列顯示既有的 `Select a change first`。
- 新增第四種 input mode `menu`，與既有的 `tree` / `filter` / `authors` 並列。選單開啟時 `q` 與 Escape 都不會結束 process。
- 狀態列在選單模式顯示自己的一行提示，與 filter、authors 模式相同的排版規則。

## Non-Goals

- 不新增 `/spectra-propose`。它建立新的 change 而不是操作既有的 change，既有需求已明文排除它，選單沿用同一份清單。
- 不做多層選單、不做子選單、不做選單內搜尋。五個項目一層就夠。
- 不改變既有五個字母鍵的行為，也不移除它們。選單是第二條路徑，不是替代品。
- 不在選單模式支援直接按 `d` / `a` / `i` / `r` / `c` 選定項目。選單只認方向鍵與 Enter，避免同一個字母在兩種模式下有兩種意義。
- 不處理修飾鍵。實測 Alt+右鍵仍然回報 `button 2`，SGR 報文沒有把修飾鍵編進 button 欄位，所以沒有可分辨的輸入。
- 不改動 Herdr 設定。實測不需要 `ui.right_click_passthrough_modifier`。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `changes-pane`: 新增右鍵指令選單需求；並修改滑鼠報文解析（接受 button 2）、pane 輸入模式（第四種模式與其 `q` / Escape 行為）、點擊樹（既有行為收斂為左鍵）、狀態列提示排版（modal 提示行涵蓋選單模式）四個既有需求。

## Impact

- Affected specs: `changes-pane`
- Affected code:
  - New:
    - src/tui/command-menu.ts
    - src/tui/CommandMenu.tsx
    - test/tui/command-menu.test.ts
  - Modified:
    - src/tui/mouse.ts
    - src/tui/App.tsx
    - src/tui/keymap.ts
    - test/tui/mouse.test.ts
    - test/tui/App.test.tsx
    - README.md
  - Removed: (none)
