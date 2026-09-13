import { defineConfig } from "vitest/config";

export default defineConfig({
  // Pure-function tests only; no DOM/CSS needed.
  css: { postcss: {} },
  test: {
    environment: "node",
    // The whale-alerts worker under services/ has its own vitest project.
    include: ["src/**/*.test.ts"],
  },
});
