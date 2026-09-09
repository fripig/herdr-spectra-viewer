# 用 Bun／Node 編譯成執行檔？

日期：2026-09-09。討論題目：「如果使用 Bun 編譯出執行檔是否會比較快跟方便安裝」，
後續延伸到「Node 可以編譯成執行檔嗎」。

**結論：維持現狀（Node + tsc + npm ci）。** 打包成單一執行檔在這個 plugin 上，Node 那條路
被相依套件封死，Bun 那條路走得通但沒有速度收益；而換 runtime 的那點收益不值得動到剛穩定
下來的 resize 路徑。

以下數字都是這次在本機（macOS arm64、Node 24.21.0、Bun 1.3.11、Herdr 0.9.0）實測，不是估的。

## 啟動時間

量測點是 `main()` 裡 `mouse.start()` 第一次寫進 stdout，因此已經包含 `resolveProjectRoot`
與 `startupGeometry` 的三次 herdr subprocess（每次約 10 ms，可忽略）。同機交錯跑、取 median：

| 跑法 | 啟動 |
| --- | --- |
| `node dist/pane.js`（現狀） | ~500 ms |
| `bun dist/pane.js` | ~245 ms |
| `bun src/pane.tsx`（不編譯，直接吃 TSX） | ~260 ms |
| `bun build --compile` 產物（59 MB） | ~300–435 ms，冷啟第一次 1211 ms |

差距幾乎全在 module graph 載入：ink + react 的 graph 在 node 要 ~270 ms，在 bun 只要 ~85 ms
（bare runtime 各為 ~50 ms 與 ~10 ms）。

**編譯不會比較快。** 編出來的執行檔比 `bun dist/pane.js` 還慢——59 MB 要 page in 加簽章驗證。
速度收益來自換 runtime，不是來自編譯。

## 安裝

| | 時間 | 產物 |
| --- | --- | --- |
| `npm ci` | 5.4 s | node_modules 74 MB |
| `bun install` | 0.11 s | node_modules 74 MB |
| Bun compiled binary | build 0.6 s | 單檔 59 MB，runtime 不需 node_modules |

**編譯也不會比較好裝。** 這個 repo 沒有 git remote，安裝方式是本機 `herdr plugin link`；
而 `herdr plugin install` 只吃 `owner/repo` 的 GitHub clone，沒有 release asset 支援。
59 MB × 4 平台不能進 git，所以「下載預編譯檔、使用者免 toolchain」這條真正省事的路線
目前拿不到。剩下的只是把 prerequisite 從 Node 換成 Bun，node_modules 在 build 階段照樣要下載。

## Node SEA 為什麼不行

Node 24 的 SEA（Single Executable Applications）本身可用，整套流程實測成功，產物 116 MB：

```
node --experimental-sea-config sea-config.json   → sea-prep.blob
cp $(node -p process.execPath) ./sea-cjs
codesign --remove-signature ./sea-cjs
npx postject ./sea-cjs NODE_SEA_BLOB sea-prep.blob \
  --sentinel-fuse NODE_SEA_FUSE_... --macho-segment-name NODE_SEA
codesign --sign - ./sea-cjs
./sea-cjs → hello sea 1
```

trivial 程式啟動 ~50 ms，對照 `node x.js` 的 ~86 ms。

但 **SEA 只以 CommonJS 執行 main**。拿含 `import` 與 top-level await 的 ESM 入口做同樣的事，
執行期直接失敗：

```
SyntaxError: Cannot use import statement outside a module
    at embedderRunCjs (node:internal/main/embedding:63:7)
```

而 **這個 plugin 轉不成 CJS**。把 `src/pane.tsx` bundle 成單一 CJS 檔時：

```
error: "await" can only be used inside an "async" function
    at node_modules/yoga-layout/dist/src/index.js:13:33
        const Yoga = wrapAssembly(await loadYoga());
```

ink 的 layout engine `yoga-layout` 在 module 頂層用 top-level await 載它的 WASM。TLA 在
CommonJS 裡不存在，任何 bundler 都轉不出來——這是語言層限制，換 esbuild／rollup／webpack
結果相同。（ink 自己的 `reconciler.js:12` 也有一個 TLA，但那個在 `if (process.env.DEV === 'true')`
底下，`--define` 可以消掉；yoga 那個消不掉。）

`pkg` 已封存不維護、同樣只吃 CJS；`nexe` 一樣。Node 這邊沒有繞路。

## Bun compile 若真要做會踩到的三件事

1. ink 靜態 import `react-devtools-core`。`bun build --compile --external react-devtools-core`
   編得過，但執行時立刻 `Cannot find package 'react-devtools-core'`，即使 `DEV !== 'true'`、
   那段 `await import` 根本不該執行。要改用 `Bun.build()` 的 JS API 掛 plugin 把它 resolve
   到 stub 才跑得起來（實測可行，畫面正確）。CLI 一行搞不定。
2. 兩個 entrypoint（`src/pane.tsx`、`src/open.ts`）→ 兩支 binary 118 MB，或合併成一支再用
   argv 分派。
3. `herdr-plugin.toml` 的 `command` 要改，59 MB 產物不能進 git。

## 沒有驗證、會改變結論的前提

- **Bun 下的 `process.stdout.on("resize")` / SIGWINCH 是否照發。** `pane-initial-geometry`
  之後的所有尺寸修正完全靠它。這點沒實測過，只能在真的 Herdr pane 裡跑才有結論。
- Bun 下的 `process.stdout.columns/rows`、raw mode、mouse escape 行為。
- 測試仍跑在 Node（vitest），換 runtime 會出現「測試環境 ≠ 執行環境」的落差。

若哪天這個 plugin 要 push 到 GitHub 給別人安裝，或 Herdr 支援 release asset 下載，
「方便安裝」那半邊的算式要整個重算。

## 延伸：改用 Rust 重寫會小很多嗎？

會，而且是這幾條路裡唯一兩個承諾都兌現得了的。但這次沒有動，理由在最後一段。

**大小**（Rust 那格是估算，其餘為實測）：

| | 大小 |
| --- | --- |
| Node SEA | 116 MB |
| Bun compile | 59 MB |
| Rust TUI plugin | 估 1.5–4 MB |
| 對照：`herdr` 本體 | 20 MB |

`herdr` 那 20 MB 是本機實測的錨點——那是一整套 terminal multiplexer（pty 管理、plugin 系統、
workspace、CLI）。這個 plugin 的功能面小它一到兩個數量級，release + `strip` + `lto` 之後
落在 1.5–4 MB 是合理預期。另外 node_modules 那 74 MB 完全消失。

本機沒有安裝 cargo，所以上表 Rust 那格沒有實測；要精確數字需先裝 rustup 再編一個
ratatui 骨架來量。

**啟動**：現況 ~500 ms、換 Bun ~245 ms、Rust 估個位數到十幾 ms（只剩三次 herdr subprocess
的 ~30 ms）。

**為什麼只有 Rust 解得開安裝那道題**：`herdr plugin install` 只吃 GitHub clone、沒有 release
asset，所以無法發預編譯檔。59 MB × 4 平台 = 236 MB 不可能進 git；但 3 MB × 4 平台 = 12 MB
可以直接 commit，build step 放一支 `sh` 腳本用 `uname` 挑檔案，使用者端完全不需要任何
toolchain。這是目前唯一真能做到「方便安裝」的路線。

**代價**：`src/` 1715 行、`test/` 2130 行，約 3800 行重寫，而且不是翻譯語法：

- 佈局引擎換掉。ink 用 yoga flexbox，ratatui 是 constraint-based。`hint-layout.ts` 的依寬度
  折行、tree 捲動視窗、`mouse.ts` 的終端座標換算全要重寫並重新驗證。
- 305 個測試重寫。ratatui 的 `TestBackend` 能力對得上 ink-testing-library，但不是一對一搬移。
- `pane-initial-geometry` 要再做一次：向 Herdr 查 pane 幾何、`min(viewport_rows, rect.height - 2)`、
  查不到靜默退回。
- Spectra 掃描重寫（YAML + markdown）。注意 `serde_yaml` 已停止維護，需改用 `serde_yaml_ng`
  或 `saphyr`。
- 開發迴圈變慢：tsc 秒級 → cargo 首次分鐘級、增量十幾秒。

**決策**：記錄下來，現在不動。收益的大頭是「安裝變簡單」，而這個 plugin 目前沒有 git remote、
只有自己在用，那份收益等於零；剩下的 490 ms 撐不起 3800 行重寫。

**若未來要公開給別人安裝，Rust 重寫是唯一真能解決安裝問題的路線**，屆時應重新評估。要接續
評估的話，下一步是（1）確認 herdr plugin 的 build step 能用 `uname` 挑平台 binary、且
commit 進 repo 的 binary 不會被 `herdr plugin install` 弄壞，（2）裝 rustup 編一個 ratatui
骨架量真實大小與啟動時間。
