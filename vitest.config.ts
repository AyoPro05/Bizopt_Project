import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["./tests/setup.ts"],
    alias: {
      "@": path.resolve(__dirname, "./"),
      "@bizopt/core": path.resolve(__dirname, "./packages/core/src/index.ts"),
      "@bizopt/core/*": path.resolve(__dirname, "./packages/core/src/*"),
    },
  },
});
