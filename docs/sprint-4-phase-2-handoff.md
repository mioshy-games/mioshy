# Sprint 4 #3 — Phase 2 Migration Handoff

**Status as of 2026-05-14:** Phase 1 ✅ + Phase 2A ✅ + Phase 2B ✅ +
Phase 2C ✅ (page routes only) + Phase 2D ✅ shipped, but an audit
revealed substantial leftover hardcoded bilingual content across
the same pages. **Itzik chose Option A — full migration**: every
user-visible text must be CMS-editable. Now executing that sweep,
file by file, across multiple sessions.

> **Stop signal**: if you're picking this up mid-flight and the
> previous session asked for a "סבב חדש", continue from
> **"Active migration — full-coverage sweep"** below. The earlier
> sections (Phase 2A-D recipe, mioshy-sex marketing sub-components,
> Phase 2E call) remain accurate context but are no longer the
> active workstream.

Headline totals:
- **23 components/pages** migrated across Phases 2A–2D
- **~380 CMS keys** added to messages/{he,en}.json
- **~350 cms_texts rows** seeded into Supabase (idempotent re-runs safe)

This doc exists because Phase 2's actual size (~800 inline-bilingual
strings across ~30 components and 1 separate JSON file) is multi-
session work — too much for one conversation. The pattern, tooling,
and namespace mapping are all in place.

---

## ⭐ Start here (read this first)

### Who you're working for

The user is **Itzik (`mioshyoffice@gmail.com`)** — admin of Mioshy.
Authenticated as admin in `profiles.role = 'admin'`. Speaks Hebrew
primarily; English communication is fine, Hebrew commit messages
are not used. Direct, fast feedback loop. Trusts you to keep
flow — confirms decisions via short messages.

The CMS lives at `https://<vercel-preview>/admin/content`. Itzik
verifies migrations by opening that route, editing a row, saving,
and refreshing `/he?cb=…` to see the change live within seconds.

### Working environment

- Branch: `feature/admin-cms` — do NOT push to `game` directly.
- Worktree: `/Users/uxellent/mioshy/.claude/worktrees/admin-cms`.
- Package manager: **pnpm** (Vercel CI rejects npm-only lockfiles
  with `ERR_PNPM_OUTDATED_LOCKFILE`).
- DB: dev Supabase at `kphfmbqqafrvuzmiotsz.supabase.co`.
  Credentials live in `/Users/uxellent/mioshy/.env.local` —
  use `node --env-file=…` to load them; never paste keys into code
  or commits.
- Auth gate: `getAdminSession()` from `lib/auth/admin.ts`.
- Vercel deploy: automatic on push to feature branch.
- Logs: `vercel logs <url> -x` for runtime; `vercel inspect <url>
  --logs` for build.

### Your first action

1. Read this entire document (the recipe, the inventory, the
   tooling reference, the Phase 2E decision call).
2. Pick the next component from `Phase 2A — Journey assessment
   flow` table below. Recommended start: `JourneyAssessmentIntro.tsx`
   (smallest, 1 ternary — confirms the recipe still works).
3. Run the 6-step recipe (Step 1 → Step 6).
4. Commit + push after each component, or in small batches.
5. Move to the next component.

### The recipe in one screenshot — `AuthGateModal` as a worked example

This is exactly what changed in commit `3d90f97` for the first
Phase 2A migration. Use it as a template for every remaining
component.

**Before** (`components/journey/AuthGateModal.tsx`, lines 38–64
of the pre-migration version):

```tsx
const t = locale === "he"
  ? {
      title: "שמרו את ההתקדמות שלכם",
      body: "כדי להמשיך - צריך חשבון קטן. שלוש שאלות נשמרו כבר, לא תאבדו כלום.",
      fullName: "שם מלא",
      email: "אימייל",
      phone: "טלפון",
      password: "סיסמה",
      submitRegister: "הרשמה וההמשך",
      submitLogin: "התחברות וההמשך",
      switchToLogin: "כבר יש לי חשבון",
      switchToRegister: "אני חדש/ה כאן",
      err: "משהו השתבש. נסו שוב.",
    }
  : {
      title: "Save your progress",
      body: "To continue we need a quick account. Your first 3 answers are safe - you won't lose anything.",
      fullName: "Full name",
      email: "Email",
      phone: "Phone",
      password: "Password",
      submitRegister: "Register & continue",
      submitLogin: "Log in & continue",
      switchToLogin: "I already have an account",
      switchToRegister: "I'm new here",
      err: "Something went wrong. Please try again.",
    };

// ... later in JSX:
<DialogTitle>{t.title}</DialogTitle>
<Label htmlFor="full_name">{t.fullName}</Label>
// ... 9 more usages of t.XXX
```

**Step 1 — Identify the 11 unique strings.** Decide on key path:
`journeyAssessment.authGate.<key>` (matches the namespace mapping
in `scripts/seed-cms-texts.mjs`).

**Step 2 — Bulk-add to messages/*.json**:

```bash
cd /Users/uxellent/mioshy/.claude/worktrees/admin-cms
cat <<'JSON' | node scripts/cms-add-keys.mjs
{
  "journeyAssessment.authGate.title":           { "he": "שמרו את ההתקדמות שלכם",                                              "en": "Save your progress" },
  "journeyAssessment.authGate.body":            { "he": "כדי להמשיך - צריך חשבון קטן. שלוש שאלות נשמרו כבר, לא תאבדו כלום.",  "en": "To continue we need a quick account. Your first 3 answers are safe - you won't lose anything." },
  "journeyAssessment.authGate.fullName":        { "he": "שם מלא",                                                              "en": "Full name" },
  "journeyAssessment.authGate.email":           { "he": "אימייל",                                                              "en": "Email" },
  "journeyAssessment.authGate.phone":           { "he": "טלפון",                                                               "en": "Phone" },
  "journeyAssessment.authGate.password":        { "he": "סיסמה",                                                               "en": "Password" },
  "journeyAssessment.authGate.submitRegister":  { "he": "הרשמה וההמשך",                                                        "en": "Register & continue" },
  "journeyAssessment.authGate.submitLogin":     { "he": "התחברות וההמשך",                                                      "en": "Log in & continue" },
  "journeyAssessment.authGate.switchToLogin":   { "he": "כבר יש לי חשבון",                                                      "en": "I already have an account" },
  "journeyAssessment.authGate.switchToRegister":{ "he": "אני חדש/ה כאן",                                                       "en": "I'm new here" },
  "journeyAssessment.authGate.err":             { "he": "משהו השתבש. נסו שוב.",                                                "en": "Something went wrong. Please try again." }
}
JSON
```

Output: `+ journeyAssessment.authGate.title` (11 lines) +
`Done. Added 11, skipped 0`. The keys are now in
`messages/he.json` + `messages/en.json` at the corresponding
nested path. Re-running with the same payload is a safe no-op
(idempotent).

**Step 3 — Rewrite the component**. Drop the `const t = locale ===
"he" ? … : …` block entirely. Add imports + replace each `{t.X}`
with `<CmsText cmsKey="…" />`:

```tsx
"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useCmsText } from "@/hooks/useCmsText";       // ← NEW
import { CmsText } from "@/components/cms/CmsText";    // ← NEW
import type { Locale } from "@/lib/journey/types";

export function AuthGateModal({ open, locale, deviceId, onAuthenticated, onClose }: AuthGateModalProps) {
  // … state unchanged …

  // The error string is used inside a catch block (NOT a DOM child),
  // so it reads via useCmsText().text for a raw-string return.
  const errFallback = useCmsText("journeyAssessment.authGate.err").text;

  const submit = async (e: React.FormEvent) => {
    // … unchanged except `t.err` → `errFallback` in the catch handler.
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent dir={locale === "he" ? "rtl" : "ltr"} className="max-w-md">
        <DialogHeader>
          <DialogTitle><CmsText cmsKey="journeyAssessment.authGate.title" /></DialogTitle>
          <DialogDescription><CmsText cmsKey="journeyAssessment.authGate.body" /></DialogDescription>
        </DialogHeader>
        {/* … all the form fields, each with <CmsText cmsKey="journeyAssessment.authGate.<X>" /> … */}
      </DialogContent>
    </Dialog>
  );
}
```

The full migrated file is at HEAD on `feature/admin-cms` —
`components/journey/AuthGateModal.tsx`. Diff: `git show 3d90f97 --
components/journey/AuthGateModal.tsx`.

**Step 4 — Verify**:

```bash
cd /Users/uxellent/mioshy/.claude/worktrees/admin-cms
npm run build       # or `pnpm build` — both pass through Vercel CI.
```

Expected: `EXIT=0`, output ending in the prerender summary table.
TypeScript errors are blockers — fix them before committing. The
visual parity is automatic because `useCmsText` falls back to
`messages/<locale>.json` for any key that isn't in `cms_texts` yet
(it won't be until you re-seed at the end).

**Step 5 — Commit**:

```bash
git add -A && git commit -m "feat(cms): Phase 2A — <ComponentName> migrated

N keys under <namespace>.<componentName>.*:
  list each key

<any tricky bits — array-of-bullets, error string, etc.>
"
git push origin feature/admin-cms
```

**Step 6 — Move to next component.** Pick the next file from the
inventory below.

### Build + seed commands cheat-sheet

```bash
# From the worktree root: /Users/uxellent/mioshy/.claude/worktrees/admin-cms

# Quick build check
npm run build > /tmp/build.log 2>&1; echo "EXIT=$?"; tail -5 /tmp/build.log

# Type-only check (faster than full build)
npx tsc --noEmit

# Seed (idempotent — ON CONFLICT DO NOTHING). Run at the end of
# each phase leg, or whenever you want the new keys in cms_texts
# so /admin/content shows them in the editor.
node --env-file=/Users/uxellent/mioshy/.env.local scripts/seed-cms-texts.mjs

# Single deploy status check (don't poll)
vercel ls mioshy 2>&1 | grep -v "^$" | head -6 | tail -2
```

### Verifying a migrated component on the preview

After push, Vercel auto-deploys. Wait ~2 min, then:
1. Open `https://<latest-preview>/<route-that-uses-the-component>?cb=$RANDOM`.
2. Visual parity check — content should look identical to baseline.
3. Optionally edit a key in `/admin/content`, save, refresh `?cb=…`,
   confirm the new value reaches the public site.

### What NOT to do

- ❌ Don't auto-poll on deploys (Itzik's explicit rule: single
  `vercel ls` check, report status, stop).
- ❌ Don't push to `game` directly. Always to `feature/admin-cms`.
- ❌ Don't use `npm install` — use `pnpm install` so the lockfile
  stays in sync with Vercel's expectations.
- ❌ Don't add new external dependencies without flagging them first.
- ❌ Don't extract inline ternaries from `journey/questionnaire.json`
  in this sprint — that needs an architectural call from Itzik
  (see "Phase 2E" section below).

---

## What's done (committed on `feature/admin-cms`)

### Phase 1 (shipped earlier)
| Commit | What |
|---|---|
| `58f979a` | Phase 1 — journey/page.tsx + games/page.tsx migrated via new `lib/cms/getCmsTranslations.ts` server helper |
| `3d90f97` | Phase 2A first migration — `AuthGateModal.tsx` (11 keys) + bulk-add tooling + seed namespace mapping |
| `7c696d4` | Phase 2A — `PaywallGateModal.tsx` (10 keys) |

### Phase 2A — Journey assessment flow + timeline (17 components)
| Commit | Component | Keys |
|---|---|---|
| `d34e59b` | `JourneyAssessmentIntro` | 13 |
| `3abe735` | `JourneyClient` | 5 |
| `5c3dad2` | `QuestionStep` | 4 |
| `ce604ec` | `PriorityRankingStep` | 4 |
| `5c4dbf4` | `InlineAuthStep` | 18 |
| `9e1dddb` | `AssessmentInterstitial` | 10 |
| `1e95c93` | `AnalysisSummary` | 42 |
| `a5c0bc5` | `JourneyCheckoutButton` | 4 |
| `65344d2` | `timeline/TimelineList` | 11 |
| `078cc51` | `timeline/NextUpHero` + `PerItemThread` | 20 + 13 |
| `19b3e1e` | `timeline/ItemDetailClient` + `LessonView` | 36 + 11 |
| `0422b92` | `timeline/CompletionCelebrationModal` + `WhyThisItem` + `UserRecentActivity` + `ItemFeedbackBar` | 10 + 3 + 10 + 14 |
| `588fb78` | CI fix — `VictoryHero` unused-prop ESLint blocker |

Phase 2A subtotal: ~228 keys across 17 components + 2 pre-existing
(AuthGate, PaywallGate) = 19 components total in the journey flow.

### Phase 2B — Games slug (2 files)
| Commit | What | Keys |
|---|---|---|
| `ac23137` | `app/[locale]/games/[slug]/page.tsx` + `components/game/TutorialPopup.tsx` | 11 |

### Phase 2C — Mioshy-sex (3 page routes only)
| Commit | What | Keys |
|---|---|---|
| `0595b21` | `app/[locale]/mioshy-sex/page.tsx` + `[slug]/page.tsx` + `[slug]/play/page.tsx` | 7 + 17 + 12 = 36 |

Marketing sub-components imported by these routes
(AdultsMarketingHero, AdultsMarketingSections,
AdultsMarketingSections.variant-personal, AdultsHeroBuy,
AdultsPricingPanel, BetweenUsStorefront, InvitePartnerByEmail,
PairAndPurchasePanel, PairCodeWidget, RedeemCodeButton)
contain ~170 additional ternaries combined — **deferred**.
See "Remaining work" below.

### Phase 2D — /my/* routes (5 pages)
| Commit | What | Keys |
|---|---|---|
| `62644d7` | `app/[locale]/my/page.tsx` | 16 (myHub.*) |
| `eeb50f3` | `app/[locale]/my/games/page.tsx` + `my/journey/together/page.tsx` | 8 + 8 |
| `1766b1e` | `app/[locale]/my/adults/page.tsx` | 12 |
| `f1b0247` | `app/[locale]/my/journey/page.tsx` | 13 |

Phase 2D subtotal: 57 keys across 5 page routes.

### Grand totals (Phases 2A–2D)
- **23 components/pages** migrated  
- **~380 CMS keys** in messages/{he,en}.json  
- **~350 cms_texts rows** seeded into Supabase

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

## Remaining work (Phase 2 follow-ups)

Everything in Phase 2A–2D's original inventory is migrated. What's
left is two pieces that were *intentionally* scoped out of this
sprint:

### A) Mioshy-Sex marketing sub-components

The 3 mioshy-sex page routes (Phase 2C) import a suite of marketing
components that still contain inline-bilingual strings. The page
routes themselves are migrated; these dependents are not:

| File | Ternaries | Notes |
|---|---|---|
| `components/adults/AdultsMarketingHero.tsx` | 20 | Top-of-page hero |
| `components/adults/AdultsMarketingSections.tsx` | 41 | Manifesto, Proof, Catalogue intro, FAQ, Closing CTA in one file |
| `components/adults/AdultsMarketingSections.variant-personal.tsx` | 33 | Variant of the above |
| `components/adults/AdultsHeroBuy.tsx` | 15 | In-hero purchase panel |
| `components/adults/AdultsPricingPanel.tsx` | 11 | Reused pricing block |
| `components/between-us/BetweenUsStorefront.tsx` | 18 | Catalogue grid |
| `components/between-us/InvitePartnerByEmail.tsx` | 11 | Email invite form |
| `components/between-us/PairAndPurchasePanel.tsx` | 8 | Pair-then-buy flow |
| `components/between-us/PairCodeWidget.tsx` | 3 | Code surface |
| `components/between-us/RedeemCodeButton.tsx` | 8 | Code redemption |

Estimated: ~168 ternaries → ~120 keys when extracted. Standard recipe
applies (see "Start here" above); namespaces should be
`mioshySexHero.*`, `mioshySexManifesto.*`, `betweenUs.storefront.*`,
etc. — bucket all under `page: "mioshy-sex"` in the seed namespace map.

### B) `journey/questionnaire.json` (Phase 2E)

Architectural decision deferred — see the original "Phase 2E" section
below.

### Known holdovers (low-priority)

These are aria-labels / image-alt strings inside server-component
sub-functions where the parent's `t()` from `getCmsTranslations`
isn't in scope. Each is a single isHe ternary, accessibility-only,
and a refactor to pass the resolved string through 3+ call sites
wasn't worth it during this sprint:

- `app/[locale]/my/page.tsx` — `EntitledPillar` notification-count
  aria-label.
- `app/[locale]/my/games/page.tsx` — Snakes & Ladders Image `alt`.

If admin demand for editing these surfaces, the fix is to lift the
resolved string to the parent and pass via a new prop.

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

---

## Rich-text behaviour on Phase 2 migrations

**Rule:** if a CMS-managed string ever ends up rendered as a JSX
child (`<h1>{value}</h1>`, `<p>{value}</p>`, etc.), it MUST go
through `<CmsText cmsKey="…">`. Plain `{t("…")}` from
`getCmsTranslations` ignores the `is_rich` flag and will print
admin-entered `<em>` / `<strong>` tags as **literal text** in the
DOM — exactly the bug we shipped on `/journey` and `/games` in
Phase 1 before the 2026-05-13 fix (commit on `feature/admin-cms`).

### When to use which API

| Slot | Use | Why |
|---|---|---|
| JSX text child — `<h1>…</h1>`, `<p>…</p>`, `<span>…</span>` | `<CmsText cmsKey="…" as="h1" className="…">` | Resolves is_rich, renders via dangerouslySetInnerHTML w/ `cms-rich` class for `<em>`/`<strong>` styling |
| Sub-component string prop — `<MyHero title={…}>` | `t("…")` from getCmsTranslations | Sub-component needs the raw string. If sub-component renders to DOM, it has the same bug; rewrite *that* component to take `cmsKey` + use `<CmsText>` internally if rich is needed there. |
| Metadata — `generateMetadata` title/description | `t("…")` | Returns to Next.js as plain string; no HTML rendered. |
| JSON-LD `@graph` names, descriptions, breadcrumb labels | `t("…")` | Search engines render attribute values; HTML in them is meaningless. |
| `alt`, `aria-label`, `title` attributes | `t("…")` | Same — string-typed by the HTML spec, no rich. |
| State value (`setError(…)`, default fallback) | `t("…")` | Rendered later as text; if you want rich, render via `<CmsText>` at the consumer site instead. |

### Page-shell pattern (Phase 1 + Phase 2 pages with rich-aware JSX)

```tsx
// server component
const t = await getCmsTranslations({ locale, namespace, page });
const cmsRows = await loadCmsTextsForPage(page);   // ← ALL rows for this page bucket
return (
  <CmsTextProvider rows={cmsRows}>
    <main>
      <CmsText cmsKey="namespace.h1" as="h1" className="…" />
      <CmsText cmsKey="namespace.lede" as="p" className="…" />
      {[0,1,2].map(i => (
        <CmsText key={i} cmsKey={`namespace.items.${i}.h`} as="h3" />
      ))}
    </main>
  </CmsTextProvider>
);
```

`<CmsText>` (client island) looks up the CMS row by key through
the Provider's context, checks `is_rich`, and renders either a
plain text node or `dangerouslySetInnerHTML` + `cms-rich` class.

### Known holdovers (deliberately left as `t()` for now)

These render text as DOM children but stayed as `t()` because the
JSX consumer is INSIDE a sub-component we don't want to refactor
in this sprint. Admin toggling these to rich would re-introduce
the literal-tag bug.

| Page | Slot | Sub-component |
|---|---|---|
| `/games` hero | `gamesHub.h1`, `gamesHub.lede`, `gamesHub.ctaPrimary` | `<LazyLiveDemoHero title={…} lede={…} ctaPrimary={…}>` — refactor LiveDemoHero to take `cmsKey` props if rich is wanted |
| `/games` final CTA | `gamesHub.ctaPrimary` (line ~981) | Same key reused — fixing the hero refactor fixes both |
| Phase 2 server-side `t()` consumers (`mioshy-sex/*`, `my/*`, `UserRecentActivity`) | Various string-typed slots (props, JSON-LD, error state, aria) | Same advice — if a slot's destination renders to a DOM child, lift the consumer to `<CmsText>`; otherwise these are slots where rich can't render anyway |

### How to detect this regression in code review

Grep for `{t(["` and `{t(\`` inside JSX. Anything wrapped in a
DOM element opening/closing tag pair is a candidate for the bug.
Convert to `<CmsText cmsKey="…" as="…" className="…" />`.

```bash
grep -nE '>\s*\{t\(["`]' app/\[locale\]/<route>/page.tsx
```

A clean migrated page has zero hits.

---

## Active migration — full-coverage sweep (started 2026-05-14)

### Why this exists

The "Phase 2 complete" claim from 2026-05-13 turned out to be
**partial**. An audit (71 files scanned across the Phase 2 scope
dirs) found **57 inline-bilingual ternaries with HE content on
`app/[locale]/games/page.tsx` alone**, plus 36 hardcoded HE
strings in JSX. Other pages had similar leftovers. The drop-in
`getCmsTranslations` swap only migrated strings that were already
keyed in next-intl JSON — anything written as inline
`{isHe ? "…" : "…"}` was untouched.

**Decision (2026-05-14):** Option A — every user-visible string
must be CMS-editable. Multi-session sweep, page by page.

### Audit baseline

Per-file ternary + HE-in-JSX counts at session start. Re-run the
audit script before declaring this workstream complete.

```bash
python3 -c '
import os, re, glob
SCOPE = [
  "app/[[]locale[]]/games", "app/[[]locale[]]/journey",
  "app/[[]locale[]]/mioshy-sex", "app/[[]locale[]]/my",
  "components/journey", "components/games", "components/game",
  "components/adults", "components/between-us",
]
TERN_HE  = re.compile(r"(?:locale\s*===\s*[\"\x27]he[\"\x27]|isHe)\s*\?\s*[\"\x27`].*[א-ת]")
TERN_ANY = re.compile(r"(?:locale\s*===\s*[\"\x27]he[\"\x27]|isHe)\s*\?")
JSX_HE   = re.compile(r">[^<>]*?[א-ת][^<>]*?<")
def strip(s):
  s = re.sub(r"/\*[\s\S]*?\*/", "", s)
  return re.sub(r"//[^\n]*", "", s)
for sd in SCOPE:
  for p in sorted(glob.glob(sd+"/**/*.tsx", recursive=True)):
    with open(p) as f: src = strip(f.read())
    ta=len(TERN_ANY.findall(src)); th=len(TERN_HE.findall(src)); j=len(JSX_HE.findall(src))
    if ta or j: print(f"{p}: {ta}/{th}/{j}")
'
```

### Skip rules (per Itzik 2026-05-14, Option A)

- `dir={isHe ? "rtl" : "ltr"}` — direction, not content
- Icon swaps (`Arrow = isHe ? ArrowLeft : ArrowRight`)
- Data-field access (`isHe ? row.he : row.en` / `game.title_he`)
- Everything else **must** be in CMS

### Method per file

1. Confirm `<CmsTextProvider rows={cmsRows}>` is mounted (server
   component loads `loadCmsTextsForPage(page)` first).
2. Read the file in chunks; identify every translatable string.
3. Bulk-add keys via `scripts/cms-add-keys.mjs` (one batch per file
   or per logical section).
4. Replace JSX children with `<CmsText cmsKey="…" as="…" />`.
   For string-prop slots (alt, `LazyLiveDemoHero title={…}`), use
   `t("…")` from `getCmsTranslations`. Refactoring sub-components
   to accept cmsKey props is out of scope unless explicitly
   requested.
5. `pnpm build` after each file.
6. Commit + push **per file** (or small 2-3 file batch if they're
   tightly related).
7. If the context window is getting tight: STOP cleanly. Update
   this doc with what landed + what remains. Ask Itzik for a
   fresh session. **Do not push partial work mid-file.**

### Status — file by file

#### `app/[locale]/games/page.tsx` (worst file, 77/57/36 at start) — ✅ **DONE**

| Batch | Keys | Sections | Commit | Status |
|---|---|---|---|---|
| 1 | 21 | authed catalog view (192-313) · whyMeta stats · trust labels · LazyLiveDemoHero non-CMS props · Why-section eyebrow/hook | `b5f6604` | ✅ |
| 2 | 6 | `benefits[]` array: 3 items × {title, body} | `50b3303` | ✅ |
| 3 | 12 | `personas[]` array: 3 items × {tag, title, body, quote} (quote marks bundled into the quote value) | `e7835e3` | ✅ |
| 4 | 5 | "By the numbers" pull-quote — structural split with `<Counter suffix="+">` + `<em>` inline, CMS for prefix/middle/connector/suffix + eyebrow | `336d53b` | ✅ |
| 5 | 3 | trial line + kicker + "Start playing" CTA | `daba449` | ✅ |
| 6+7 | 0 (reused) | Marketing catalogue header + snakes marketing card | `05348c9` | ✅ |
| 8 | 4 | Personas section header (eyebrow + 2-line h2 + lede) | `6a7b190` | ✅ |
| 9 + final cleanup | 6 | "Why it works" eyebrow + 2-line h2 + lede + closing italic + SEO `metaKeywords` (CSV-style, runtime split) | `7d5bc1e` | ✅ |

**games/page.tsx final: ~57 keys, tern-w-HE = 0, HE-in-JSX = 0.**

#### Other files — sweep status

| File | Initial cnt | Status | Commit | Keys |
|---|---:|---|---|---:|
| `app/[locale]/journey/page.tsx` | 19/24 | ✅ | `3b9aa0d` | 31 |
| `app/[locale]/journey/timeline/page.tsx` | 23/17 | ✅ retrofit CMS infra + migrate | `387a362` | 21 |
| `app/[locale]/journey/timeline/[scheduledId]/page.tsx` | 6/5 | ✅ retrofit CMS infra + migrate | `6250ad9` | 6 |
| `app/[locale]/mioshy-sex/page.tsx` | 2/0 | ✅ metadata fallbacks via existing keys | `756e421` | 0 (reused) |
| `app/[locale]/mioshy-sex/[slug]/page.tsx` | 0/0 | ✅ universalBenefit/Target arrays | `756e421` | 4 |
| `app/[locale]/mioshy-sex/[slug]/play/page.tsx` | 2/1 | ✅ + RolePanel cleanup | `756e421` | 2 |
| `app/[locale]/my/page.tsx` | 19/11 | ✅ + EntitledPillar/PillarMarketing prop refactor | `f1ff106` | 25 |
| `app/[locale]/my/adults/page.tsx` | 8/6 | ✅ | `f1ff106` | 9 |
| `app/[locale]/my/games/page.tsx` | 4/2 | ✅ | `f1ff106` | 3 |
| `app/[locale]/my/journey/page.tsx` | 9/6 | ✅ | `f1ff106` | 8 |
| `app/[locale]/my/journey/together/page.tsx` | 4/5 | ✅ | `f1ff106` | 6 |
| `components/games/GamesMarketingHero.tsx` | 1/1 | ✅ (dead code, but audit-clean) | `1f70cc4` | 1 |
| `components/game/GameTypeSelector.tsx` | 2/0 | ✅ Card sub-component refactored to use CMS keys | `1f70cc4` | 6 |
| `components/game/snakes/CoinFlip.tsx` | 0/2 | ✅ (HE-only → CMS, EN provided in seed) | `f6551e5` | 6 |
| `components/game/snakes/GameLog.tsx` | 0/1 | ✅ | `f6551e5` | 1 |
| `components/game/snakes/QuestionModal.tsx` | 3/2 | TODO | — | — |
| `components/game/snakes/PlayerSetup.tsx` | 5/4 | TODO | — | — |
| `components/game/snakes/SnakesGameBoard.tsx` | 11/5 | TODO — includes pass-the-phone toast template w/ `${user_name}` interpolation, win-overlay copy | — | — |
| `components/game/snakes/GameLobby.tsx` | 13/22 | TODO — largest snakes file, includes color names (סגול/כחול/...), host/me badges, room-code share copy, character/avatar picker labels | — | — |
| `components/adults/AdultsHeroBuy.tsx` | 17/14 | TODO (Issue 2) | — | — |
| `components/adults/AdultsMarketingHero.tsx` | 18/10 | TODO (Issue 2) | — | — |
| `components/adults/AdultsMarketingSections.tsx` | 44/28 | TODO (Issue 2 — biggest single component) | — | — |
| `components/adults/AdultsMarketingSections.variant-personal.tsx` | 38/17 | TODO (Issue 2 variant) | — | — |
| `components/adults/AdultsPricingPanel.tsx` | 21/13 | TODO (Issue 2) | — | — |
| `components/between-us/BetweenUsStorefront.tsx` | 15/8 | TODO (Issue 2) | — | — |
| `components/between-us/InvitePartnerByEmail.tsx` | 12/9 | TODO (Issue 2) | — | — |
| `components/between-us/PairAndPurchasePanel.tsx` | 13/12 | TODO (Issue 2) | — | — |
| `components/between-us/PairCodeWidget.tsx` | 3/1 | TODO (Issue 2 — smallest) | — | — |
| `components/between-us/RedeemCodeButton.tsx` | 9/5 | TODO (Issue 2) | — | — |

**Sweep progress as of 2026-05-14 session 2:**
- 15 files ✅ done (193 keys committed across 12 commits)
- 14 files remaining: 4 snakes + 10 Issue 2 components.
- Estimated ~280–330 additional keys for the remaining 14 files.

### Patterns learned this sweep (apply to next session)

1. **Page that already imports `getCmsTranslations` but is missing `loadCmsTextsForPage` + `<CmsTextProvider>`** → wrap both render branches in `<CmsTextProvider rows={cmsRows}>`. The journey/timeline pages needed this full retrofit because they predated the Phase 1 CMS infra.
2. **Sub-components that take `isHe` + `xxxHe` + `xxxEn` prop pairs** → refactor to a single resolved `xxx: string` prop, resolve via `t()` in the parent. Applied to: `RolePanel`, `EntitledPillar`, `PillarMarketing`, `ProgressSummary`, `GameTypeSelector.Card`, `TrustAnchor`. Drops the inline `isHe ? labelHe : labelEn` selection inside.
3. **String templates with placeholders** → CMS value carries `{name}` / `{count}` / `{date}` literal, runtime calls `.replace("{name}", v)`. Used for: notification aria, asymmetry message, monthly-consumed banner, priority hint, activity assessment detail, sr-only progress.
4. **SEO `keywords` array** → collapse to a single CSV CMS value, split + trim at runtime in `generateMetadata`. Pattern in `gamesHub.metaKeywords`, `journeyHub.metaKeywords`.
5. **Locale-specific punctuation (quote marks ״ / curly quotes)** → bundle into the CMS value itself rather than leaving an `isHe` ternary for the glyph. The `<Counter suffix="+">` case is similar — normalise both locales to one inline JSX shape, push the localised text into CMS.
6. **HE-only components** (CoinFlip, GameLog) → provide reasonable EN translations when adding the key. Better than leaving them HE-only in the database; admin can always retune.
7. **Per-file commit + push** rule held throughout. `pnpm build` after every file. `npm` lockfile is poison.

### Next session — start here

1. Read this section.
2. `cd /Users/uxellent/mioshy/.claude/worktrees/admin-cms && git pull`.
3. Continue with **snakes components** in this order (smallest → largest):
   - `QuestionModal.tsx` (3/2)
   - `PlayerSetup.tsx` (5/4)
   - `SnakesGameBoard.tsx` (11/5) — handle pass-the-phone & win-overlay templates
   - `GameLobby.tsx` (13/22) — biggest snakes file, color names + character picker
4. Then **between-us components** (smallest → largest):
   - `PairCodeWidget.tsx` (3/1)
   - `RedeemCodeButton.tsx` (9/5)
   - `InvitePartnerByEmail.tsx` (12/9)
   - `PairAndPurchasePanel.tsx` (13/12)
   - `BetweenUsStorefront.tsx` (15/8)
5. Then **adults components** (smallest → largest):
   - `AdultsHeroBuy.tsx` (17/14)
   - `AdultsMarketingHero.tsx` (18/10)
   - `AdultsPricingPanel.tsx` (21/13)
   - `AdultsMarketingSections.variant-personal.tsx` (38/17)
   - `AdultsMarketingSections.tsx` (44/28) — biggest single sub-component
6. After every file: `pnpm build` (must pass), then commit + push per the per-file rule.
7. When complete: re-run the audit script across the full scope, confirm `tern-w-HE = 0 AND HE-in-JSX = 0` everywhere, run `node --env-file=.env.local scripts/seed-cms-texts.mjs`, push, deliver final preview URL.
8. **Don't forget**: patch `scripts/seed-cms-texts.mjs` section-fragmentation rule (see `07e2414`'s SQL). Follow-up commit, not part of the migration sweep.

### Latest preview URL (this session)

`https://mioshy-git-feature-admin-cms-itzikbab-gmailcoms-projects.vercel.app` — auto-tracks `feature/admin-cms` HEAD. Append `?cb=$RANDOM` to bust the route cache.
