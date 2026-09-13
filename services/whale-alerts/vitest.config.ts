import { defineConfig } from "vitest/config";

export default defineConfig({
  // This worker has no CSS. Disable PostCSS so Vite doesn't climb to the parent
  // project's postcss.config.js (which requires tailwindcss, not installed here).
  css: { postcss: {} },
  test: { environment: "node", root: __dirname },
});
