import { defineConfig } from "vitest/config";

// Tests cover the pure modules only — no Logseq build plugin needed.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
