import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    environment: "node",
    passWithNoTests: true,
    // The TUI tests match plain substrings against rendered frames, so the
    // frames must carry no colour escapes even when the surrounding shell
    // exports FORCE_COLOR.
    env: { FORCE_COLOR: "0" },
  },
  esbuild: { jsx: "automatic" },
});
