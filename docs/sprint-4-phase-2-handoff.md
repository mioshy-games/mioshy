# Sprint 4 #3 — Phase 2 Migration Handoff

**Status as of 2026-05-13 PM:** Phase 1 ✅ shipped (commit `58f979a`).
Phase 2A: 2 of ~30 components migrated (`AuthGateModal`,
`PaywallGateModal`). The rest is straight-line repetition of the
recipe below.

This doc exists because Phase 2's actual size (~800 inline-bilingual
strings across ~30 components and 1 separate JSON file) is multi-
session work — too much for one conversation. The pattern, tooling,
and namespace mapping are all in place; a fresh agent session can
pick up at "next component" without re-deriving any of the setup.

## What's done (committed on `feature/admin-cms`)

| Commit | What |
|---|---|
| `58f979a` | Phase 1 — journey/page.tsx + games/page.tsx migrated via new `lib/cms/getCmsTranslations.ts` server helper |
| `3d90f97` | Phase 2A first migration — `AuthGateModal.tsx` (11 keys) + bulk-add tooling + seed namespace mapping |
| `7c696d4` | Phase 2A — `PaywallGateModal.tsx` (10 keys) |

Total keys added to messages/*.json so far in Phase 2: **21**.
Total components migrated: **2 of ~30**.

## The recipe (for any remaining component)

### Step 1 — Identify the bilingual strings

Most journey/games/mioshy-sex/my components use one of two patterns:

```tsx
// Pattern A: locale-keyed dictionary at top of component
const t = locale === "he"
  ? { title: "…", body: "…", … }
  : { title: "…", body: "…", … };

// Pattern B: inline ternaries scattered across JSX
<h2>{locale === "he" ? "כותרת" : "Title"}</h2>
```

For each unique string, choose a CMS key like
`<namespace>.<component>.<purpose>` (see Step 2). Arrays of items
become individual keys (`bullet1`, `bullet2`, …) — gives the admin
per-item editing in the CMS UI.

### Step 2 — Pick the namespace

The seed script's `NAMESPACE_TO_PAGE` table (in
`scripts/seed-cms-texts.mjs`) maps the first dotted segment of every
key to the `page` column. Use these prefixes:

| Component group | Namespace prefix | page bucket |
|---|---|---|
| Journey assessment flow (modals, steps, analysis) | `journeyAssessment.<component>.<key>` | `journey` |
| Journey timeline (timeline/* components) | `journeyTimeline.<component>.<key>` | `journey` |
| Games slug page | `gamesSlug.<key>` | `games` |
| Mioshy-Sex landing | `mioshySexPage.<key>` | `mioshy-sex` |
| Mioshy-Sex slug page | `mioshySexSlug.<key>` | `mioshy-sex` |
| Mioshy-Sex play page | `mioshySexPlay.<key>` | `mioshy-sex` |
| My/hub (/my) | `myHub.<key>` | `my` |
| /my/adults | `myAdults.<key>` | `my` |
| /my/games | `myGames.<key>` | `my` |
| /my/journey | `myJourney.<key>` | `my` |
| /my/journey/together | `myJourneyTogether.<key>` | `my` |

All of these are already in `NAMESPACE_TO_PAGE` (commit `3d90f97`).

### Step 3 — Add the keys to messages/*.json

Use the helper that landed in commit `3d90f97`:

```bash
cat <<'JSON' | node scripts/cms-add-keys.mjs
{
  "namespace.componentName.someKey": { "he": "טקסט עברית", "en": "English text" },
  "namespace.componentName.otherKey": { "he": "…", "en": "…" }
}
JSON
```

The script is idempotent — re-running with overlapping keys is safe
(skips existing). The keys land in `messages/he.json` and
`messages/en.json` at the corresponding nested path.

### Step 4 — Rewrite the component

Replace every consumer:

```tsx
// BEFORE — inline ternary or t-dictionary
<h2>{t.title}</h2>
<Label htmlFor="x">{t.fullName}</Label>
const errFallback = t.err;

// AFTER — every DOM consumer through <CmsText>
import { useCmsText } from "@/hooks/useCmsText";
import { CmsText } from "@/components/cms/CmsText";

<h2><CmsText cmsKey="namespace.componentName.title" /></h2>
<Label htmlFor="x"><CmsText cmsKey="namespace.componentName.fullName" /></Label>

// Non-DOM string consumers — useCmsText().text
const errFallback = useCmsText("namespace.componentName.err").text;
```

Drop the `const t = locale === "he" ? … : …` block entirely.

### Step 5 — Verify

`pnpm build` should still pass — visual parity is guaranteed by the
hook's JSON fallback (any key without a CMS row reads from
messages/*.json via next-intl, identical to pre-migration).

### Step 6 — Commit

```
feat(cms): Phase 2A — <ComponentName> migrated

N keys under <namespace>.<component>.*:
  list…

<short note about any tricky bits>
```

## The remaining inventory

Counts come from `grep -c 'locale === "he"\|isHe ?'` on the migrated
worktree at HEAD `7c696d4`. Each number is roughly "inline ternaries
in that file"; the actual key count after extraction is usually
1.5–2× higher because each ternary often contains a dictionary or
mid-sentence string that needs splitting.

### Phase 2A — Journey assessment flow

| File | Ternaries | Notes |
|---|---|---|
| `components/journey/JourneyClient.tsx` | 9 | Main orchestrator. Has a `headerText.warmup` value that doesn't appear to be rendered — flag for cleanup. Has a `${percent}%` interpolation — split into "{percent}%" + suffix key. |
| `components/journey/QuestionStep.tsx` | 9 | Per-question UI. |
| `components/journey/PriorityRankingStep.tsx` | 8 | Drag-and-drop ranking. |
| `components/journey/InlineAuthStep.tsx` | 3 + array | Post-questionnaire signup. **18 keys** when expanded (3 badges + 3 error variants + loading label). |
| `components/journey/AssessmentInterstitial.tsx` | 3 + 2 t() | Mid-flow reflections. Note: 2 existing t() calls — but for which namespace? Verify. |
| `components/journey/JourneyAssessmentIntro.tsx` | 1 | Tiny — likely 1 key. |
| `components/journey/AnalysisSummary.tsx` | 9 | Post-flow report. |
| `components/journey/JourneyCheckoutButton.tsx` | 6 | CTA component. |
| `components/journey/AuthGateModal.tsx` | ✅ DONE (11 keys) |
| `components/journey/PaywallGateModal.tsx` | ✅ DONE (10 keys) |
| `components/journey/AssessmentDiagProbe.tsx` | 0 | No t/locale. Skip. |
| `components/journey/JourneyAmbience.tsx` | 0 | No t/locale. Skip. |
| `components/journey/ProgressBar.tsx` | 0 | No t/locale. Skip. |

Estimated remaining keys for Phase 2A: ~60 (8 components × avg 8 keys).

### Phase 2A timeline sub-flow

| File | Ternaries |
|---|---|
| `components/journey/timeline/TimelineList.tsx` | 17 |
| `components/journey/timeline/NextUpHero.tsx` | 18 |
| `components/journey/timeline/ItemDetailClient.tsx` | 31 (+ 3 existing t()) |
| `components/journey/timeline/PerItemThread.tsx` | 14 (+ 1 t()) |
| `components/journey/timeline/LessonView.tsx` | 11 |
| `components/journey/timeline/CompletionCelebrationModal.tsx` | 3 |
| `components/journey/timeline/WhyThisItem.tsx` | 2 |
| `components/journey/timeline/UserRecentActivity.tsx` | 5 |
| `components/journey/timeline/ItemFeedbackBar.tsx` | 9 |

Estimated: ~110 keys.

### Phase 2B — Games

| File | Ternaries |
|---|---|
| `app/[locale]/games/[slug]/page.tsx` | 5 |
| (game-internal components if any) | check `components/games/` |

Estimated: ~10 keys.

### Phase 2C — Mioshy-Sex (3 routes)

| File | Ternaries |
|---|---|
| `app/[locale]/mioshy-sex/page.tsx` | 26 |
| `app/[locale]/mioshy-sex/[slug]/page.tsx` | 36 |
| `app/[locale]/mioshy-sex/[slug]/play/page.tsx` | 26 |

Estimated: ~90 keys.

### Phase 2D — My/* (5 routes)

| File | Ternaries |
|---|---|
| `app/[locale]/my/page.tsx` | 67 |
| `app/[locale]/my/adults/page.tsx` | 38 |
| `app/[locale]/my/games/page.tsx` | 19 |
| `app/[locale]/my/journey/page.tsx` | 64 |
| `app/[locale]/my/journey/together/page.tsx` | 21 |

Estimated: ~210 keys.

### Phase 2E — `journey/questionnaire.json` (architectural call needed)

32 questions × 2 langs × ~6 fields each = ~384 strings.

**This one isn't mechanical extraction** — `lib/journey/questions.ts`
imports the JSON synchronously at module load:

```ts
import rawQuestionnaire from "@/journey/questionnaire.json";
```

Consumers (`QuestionStep`, `JourneyClient`) read questions via
sync helpers like `getQuestion(id)` and `promptFor(q, locale)`.

To put the questionnaire in CMS, you either:

1. **Keep sync access**: seed CMS with a one-time migration (085),
   but the rendering stays JSON-driven. Admin edits in CMS are
   informational — they don't reach `/he/journey/assessment` until
   the JSON is regenerated and deployed. Effectively a backup
   editor. **Low value.**
2. **Make access async**: rewrite `lib/journey/questions.ts` to load
   from `cms_texts` via the existing loader. Every consumer changes
   from `getQuestion(id)` to `await getQuestion(id)`. Components
   that depended on synchronous question data (e.g. `useMemo` that
   slices QUESTIONS at render time) need refactoring to async.
   **High value, high effort — ~1 day of focused work.**
3. **Hybrid**: pre-load all questions server-side once, pass to
   client via props/context, keep client-side access sync. Modest
   effort. **Best ROI.**

Recommendation: hold Phase 2E until after Phase 2A-D ships and the
CMS has been used for a week — at which point the team can make an
informed call on whether questionnaire-editing-via-CMS is worth the
refactor.

## Tooling reference

| Path | Purpose |
|---|---|
| `lib/cms/getCmsTranslations.ts` | Server-side drop-in for `getTranslations` (used by journey/page.tsx, games/page.tsx). |
| `lib/cms/sanitize.ts` | Regex-only allow-list for em/strong/br/p/ul/li/s. Mode-aware (plain/rich). |
| `lib/cms/render.ts` | `normalizeRichText` — collapses `<br></br>` to `<br />`. |
| `lib/cms/server.ts` | `loadCmsTextsForPage(page)` + `loadAllCmsTexts()`. |
| `components/cms/CmsText.tsx` | Universal renderer. `isRich`-aware (dangerouslySetInnerHTML vs text node). Composes `cms-rich` class for brand styling. |
| `hooks/useCmsText.ts` | Reads CMS row from context, falls back to next-intl JSON. Returns `{text, isRich, style}`. |
| `scripts/cms-add-keys.mjs` | Bulk-adds keys to messages/{he,en}.json from stdin JSON. |
| `scripts/seed-cms-texts.mjs` | Idempotent SELECT-into-cms_texts. Run at end of each Phase 2 leg. |

## Final step (after each phase leg lands)

Run the seed once at the end to bulk-INSERT the new keys into
cms_texts:

```bash
node --env-file=.env.local scripts/seed-cms-texts.mjs
```

Re-runs are safe — UPSERT with `ON CONFLICT (key) DO NOTHING`.
