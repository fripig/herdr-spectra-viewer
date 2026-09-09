# Discussion: 建立 herdr spectra-viewer plugin（2026-09-08）

參考來源：
- herdr plugin 文件 https://herdr.dev/docs/plugins/（pane = 跑在 terminal 裡的 TUI；整個 `herdr` CLI 就是 API）
- 移植對象：[idea-spectra-viewer 的 openspec/specs](https://github.com/fripig/idea-spectra-viewer/tree/main/openspec/specs)（change-discovery 7 條、changes-tool-window 12 條）

## Decision

建立 herdr plugin `spectra-viewer`，以 Node.js + Ink 實作 pane TUI，分兩個 change 交付。

## Architecture

```
spectra-viewer/
├─ herdr-plugin.toml
│    [[build]]   npm ci && npm run build
│    [[panes]]   id="changes"  placement="overlay"  command=["node","dist/pane.js"]
│    [[actions]] id="open"     contexts=["workspace","pane"]
└─ src/
   ├─ discovery/   change-discovery spec，純函式，無 herdr 依賴
   ├─ herdr/       唯一 herdr adapter（$HERDR_BIN_PATH: pane send-text / split / run）
   └─ tui/         Ink 元件
```

## Decisions

| 決策 | 選擇 | 理由 |
|---|---|---|
| Runtime | Node.js + Ink | herdr 官方範例用 Node；Kotlin 掃描邏輯移植成本最低 |
| Project root | invocation context 的 workspace cwd | herdr 每個 worktree 是一個 workspace |
| 送指令目標 | `herdr pane send-text $HERDR_PANE_ID`，不送 Enter，關閉 overlay | overlay 蓋在召喚 pane 上，等同 IDE 的選中 terminal tab；無 HERDR_PANE_ID 退回剪貼簿 |
| 開啟 artifact | TUI 內唯讀預覽；`e` 鍵 `pane split` + `pane run "$EDITOR path"` | 不依賴 $EDITOR 也能看內容 |
| 範圍 | Change 1 核心、Change 2 操作 | 各自可獨立驗收 |

## Scope

- Change 1（核心）：change-discovery 全部 7 條 + 樹狀分組、任務進度、載入/空狀態、重新掃描、預覽、送指令/複製指令。
- Change 2（操作）：排序、名稱篩選、作者篩選、顯示 proposer、複製 change 名稱。

## 需改寫的需求

- 「Scan off the EDT」→ 掃描不阻塞 TUI render，掃描中顯示 loading。
- 「Terminal plugin disabled」三個情境 → 合併為「invocation context 無 HERDR_PANE_ID」。
- Context menu submenu → 快捷鍵（a apply / i ingest / d discuss / r archive / c commit），維持工作流順序，不含 /spectra-propose。
- 「送指令不重新掃描」保留；overlay 重新開啟時建議重掃（程序每次重啟）。

## Interface depth check

- Seam：`src/herdr/` 是唯一與 herdr 溝通的邊界，單層 adapter。
- Depth：隱藏找目標 pane、剪貼簿 fallback、split+run 兩步開檔。
- Deletion test：刪掉它，送指令與開編輯器會壞；discovery 與 TUI 可獨立測試。

## 留給 propose 決定

- `min_herdr_version` 數值
- 預覽是否做 Markdown 著色
- plugin 的 GitHub repo 名稱
