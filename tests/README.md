# Tests

Vitest test suite for the Mioshy codebase. Set up 2026-05-05 to guard
the journey assessment + analysis layer.

## Running

First time only:

```bash
npm install
```

Then any time:

```bash
npm test            # watch mode (re-runs on file change)
npm run test:run    # one-shot run, exits 0/non-zero — use in CI
npm run test:ui     # opens Vitest's web UI on http://localhost:51204
```

## Layout

```
tests/
├── README.md                    ← this file
└── journey/
    ├── questionnaire.test.ts    ← bank shape, 32 Q, gating, domain counts
    ├── focus-month-copy.test.ts ← Itzik-approved CBT copy per priority
    └── priorities.test.ts       ← isValidOrder + isPriorityKey
```

## Strategy

Tests cover **pure-function modules** + **JSON shape assertions** —
nothing that requires a running browser or a Supabase connection.

Reasons:

1. The journey assessment's correctness depends mostly on the
   questionnaire JSON staying in sync with the analysis layer. A
   single mistyped axis or domain count silently produces wrong
   scores. JSON-shape tests catch that.
2. Pure functions (`isValidOrder`, `getFocusMonthCopy`, etc.) take
   ~1ms to test — fast enough to run on every save.
3. End-to-end + component tests are valuable but expensive to set up
   and maintain. They're a separate, larger investment that should
   wait until there's a developer on the team to maintain them.

## What's NOT tested (yet)

- React component behavior (would need `@testing-library/react`).
- API route handlers (would need a Supabase mock layer).
- E2E flows through the assessment (would need Playwright).

If a regression slips past the current tests and the right answer is
"a component test would have caught this" — add the test framework
deps and the test together. Don't add them speculatively.

## What to do when a test fails

1. Read the failure message — Vitest prints what it expected vs. got.
2. If the failure is "the questionnaire shape changed and the test is
   now wrong", update the test to match the new reality (and update
   the corresponding `EXPECTED_DOMAIN_COUNTS` in
   `lib/journey/questions.ts`).
3. If the failure is "I broke something" — fix the source, not the
   test.
