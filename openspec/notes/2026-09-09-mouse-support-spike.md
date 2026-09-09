# mouse-support spike: does Ink's useInput deliver SGR mouse reports intact?

Date: 2026-09-09. Herdr 0.9.0, Node 24.20.0, Ink 5.2.1, split pane `w4:pF`.

Method: a throwaway Ink program (`.spectra/spike/ink-mouse-spike.mjs`, not committed) enabled
`ESC[?1000h ESC[?1006h`, logged every `useInput` call and every raw stdin chunk to a file, and the
sequences below were fed into the pane with `herdr pane send-text`.

| Bytes sent            | raw stdin chunk   | `useInput` input | `key.escape` |
| --------------------- | ----------------- | ---------------- | ------------ |
| `ESC[<0;17;18M`       | `ESC[<0;17;18M`   | `[<0;17;18M`     | false        |
| `ESC[<0;17;18m`       | `ESC[<0;17;18m`   | `[<0;17;18m`     | false        |
| `ESC[<64;10;21M`      | `ESC[<64;10;21M`  | `[<64;10;21M`    | false        |
| `ESC[<0;17` (partial) | `ESC[<0;17`       | `[<0;17`         | false        |
| `ESC` alone           | `ESC`             | `` (empty)       | true         |
| `q`                   | `q`               | `q`              | false        |

Outcome: **useInput intact**. Ink strips the leading ESC but hands the rest of the report to the
handler in one call, and does not flag it as Escape. A lone ESC is still reported as Escape with an
empty input, so the existing quit path is unaffected. No raw stdin listener is needed.

Chosen path: `parseMouse` accepts reports with or without the leading ESC. The `useInput` handler
calls it first and returns early when the input looks like a mouse report (starts with `[<`), whether
or not it parsed to an event, so a partial report never reaches the Escape or command-key branches.
