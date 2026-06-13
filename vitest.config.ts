import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["runs/**", "dist/**", "node_modules/**"]
  }
});
