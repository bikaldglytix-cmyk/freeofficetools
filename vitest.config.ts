import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Vitest config for the PDF Editor engine (Phase 2).
 *
 * Tests target the pure, framework-free engine (model, operations, patches,
 * store, persistence, events), so a Node environment is enough and fast. The
 * "@" alias mirrors tsconfig so test imports match app imports exactly.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    environment: "node",
    globals: false,
    include: ["lib/**/*.test.ts"],
  },
});
