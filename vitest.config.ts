/**
 * vitest.config.ts
 *
 * Test runner config. Vitest is the test framework chosen 2026-05-05
 * because it integrates cleanly with Vite's resolver (which Next.js
 * 14 already uses internally for some pipelines), supports the
 * `@/*` path alias from tsconfig.json out of the box via
 * `vite-tsconfig-paths`, and runs ~10× faster than Jest on this
 * codebase's mostly-pure-function modules.
 *
 * Test discovery: anything matching `tests/** /*.test.ts(x)?` plus
 * the legacy fallback of `*.test.ts` colocated next to source. We
 * keep tests in `tests/` rather than alongside source so the build
 * surface stays clean for the Next.js compiler.
 *
 * Environment: `node` for now — none of the current tests need a
 * DOM. When component tests are added, individual files can opt-in
 * to `jsdom` via a `// @vitest-environment jsdom` directive at the
 * top of the test file.
 */

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
    // The build-time assertion in lib/journey/questions.ts throws
    // synchronously when the questionnaire shape drifts. We want to
    // see those failures as red tests, not as silent module-load
    // crashes — Vitest reports thrown module init errors clearly.
  },
});
