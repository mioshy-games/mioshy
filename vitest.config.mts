/**
 * vitest.config.mts
 *
 * Test runner config. `.mts` (ESM) so the ESM-only Vite plugins load without the
 * esbuild "cannot require an ESM file" error the old `.ts` config hit
 * (vite-tsconfig-paths is ESM-only; a CJS-loaded `.ts` config could not require
 * it, which blocked EVERY test from running).
 *
 * The `@/*` path alias (tsconfig: "@/*" → "./*") is defined DIRECTLY here via
 * resolve.alias rather than through `vite-tsconfig-paths`: that plugin both
 * triggered the ESM-require crash and then failed to resolve the alias, so a
 * plain alias is simpler and dependency-free.
 *
 * Test discovery: test files under tests/ (see `include` below). Environment:
 * `node` (current tests are pure functions; a file can opt into jsdom via
 * `// @vitest-environment jsdom`).
 */

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url)).replace(/\/$/, "");

export default defineConfig({
  plugins: [react()],
  resolve: {
    // "@/lib/…" → "<projectRoot>/lib/…"  (mirrors tsconfig "@/*": ["./*"]).
    alias: [{ find: /^@\/(.*)$/, replacement: `${projectRoot}/$1` }],
  },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
