# Work Order — Journey Assessment: light-theme redesign

**Owner (PM/review):** Itzik · **Executor:** code agent · **Status:** ready to implement → **PREVIEW first, not prod**

## 1. Goal
Restyle the journey questionnaire flow (`/[locale]/journey/assessment`) from the current **dark** theme to a clean, light **SaaS/conversational** theme. Visual reference is the approved mockup. **Content, flow, gating, and scoring do NOT change** — reuse the real questions already wired from the DB.

## 2. Visual reference (open these)
- `docs/journey-questions-sample-v6.html` — the approved design (interactive, RTL, all control types).
- `docs/journey-questions-preview.html` — same design in desktop + mobile frames side-by-side.

The mockup uses 6 sample questions **for illustration only**. In the product, render the **real** questions.

## 3. Real content — use what's already wired, do not hardcode
- Questions already load from `journey_questions` (DB, source of truth) with `journey/questionnaire.json` fallback, via `lib/journey/questions-db.ts`, and are passed into `JourneyClient` as the `questions` prop. **Keep this.** Render whatever comes in — all `short` and `full` questions, every type.
- Likert labels come from the `likertLabels` prop (JSON). Use them for the per-number labels (do NOT hardcode the 5 words from the mockup).
- Ranking categories/subline come from the question `meta` (see `q_priorities`). Use the real `he_subline`/`en_subline`. Itzik updated the HE subline copy to: **"ניתן לגרור ולשנות את הסדר החשוב לך."** — apply this as the ranking hint (update the seed/DB copy for `q_priorities` meta.he_subline, or wherever the subline is sourced).

## 4. New logo
Black logo lives at `public/images/mioshy-b.svg` → URL **`/images/mioshy-b.svg`**. The new theme is light, so `FunnelLogo` must use `/images/mioshy-b.svg` instead of `/mioshy-white.svg` (white). Keep the 150px width / center / home link.

## 5. Design spec (from v6)
**Tokens**
- Background (page): `#fffffc` (near-white, warm).
- Ink (text): `#2E2622`; dark-gray (labels/secondary): `#4a4441`; muted: `#a2917f`; hairline: `#efe7da`.
- Brand gradient (accents only): `linear-gradient(95deg,#6C5CE7 0%,#D6409F 52%,#F79154 100%)`.
- Fonts: **Assistant** (sans) for UI **and the question text**; Frank Ruhl Libre only for the wordmark.
- Vertical rhythm: single `--gap: clamp(38px,7.5vh,78px)` between progress → question → answer.

**Header / logo**
- Logo centered at top on the **light body** (no dark bar). Below the logo add a **~100px gap** (both desktop & mobile) before content: `margin-bottom: clamp(90px,11vh,104px)`.

**Progress**
- "שאלה X מתוך Y" **centered ABOVE** the bar; the bar is full-width, centered, gradient fill. Count reads naturally in Hebrew (not "02 / 06").

**Question text**
- Assistant, weight 600, centered, `font-size: clamp(23px,5vw,30px)`.
- Mobile line width wide (`~32ch`); desktop **double** the line width (`~42ch`).

**Likert (1–5)**
- 5 equal columns, evenly spaced, **no connecting line**.
- Each circle: **black number**, white fill, **hairline 0.4px gradient contour** (padding-box/border-box trick). Selected = full gradient fill + white number.
- **Label centered under each number** (dark-gray): `1 בכלל לא · 2 לעיתים רחוקות · 3 לפעמים · 4 לעיתים קרובות · 5 כמעט תמיד` — but pull the words from `likertLabels`, not hardcoded.
- Click a number → highlight, then **auto-advance** (~300ms). No Continue button.

**Single/forced choice**
- Clean rounded white rows, soft shadow, hairline border. Selected = gradient border + gradient tick with white ✓. Click → auto-advance.

**Reflection (open text)**
- Borderless center-aligned field with a thin bottom rule; focus turns the rule magenta. **Continue button appears** here (no auto-advance).

**Ranking (drag)**
- Numbered white rows with drag handle. **Continue button appears.**
- Mobile: list **centered at 70% width** (leaves side room so a drag doesn't fight page scroll). Desktop: full width.
- Hint copy per §3.

**Footer nav (refined)**
- **"חזרה ›"** subtle text link, pinned **bottom-left**, hidden on question 1. Must be **visible on mobile** (in normal flow after the answer, not pushed below the fold).
- Continue button (only reflection + ranking): elegant **dark pill** (ink), not the heavy gradient. Label "סיום" on the last question.
- **No "דלג" (skip)** button.

**Responsive**
- Verify mobile (~390px) and desktop. Desktop doubles content line/column widths (`min-width:860px` breakpoint in the mockup).

## 6. Files to touch (integration points)
- `components/journey/JourneyClient.tsx` — container: swap dark background → light; logo; progress placement; back-nav; layout/gap. (`JourneyOutroBackdrop` dark radial → remove/replace on funnel screens.)
- `components/journey/QuestionStep.tsx` — restyle likert/single/forced/multi/reflection from dark (`text-white`, dark gradient cards) → light per spec. Likert becomes number+label-under-each with hairline gradient ring.
- `components/journey/PriorityRankingStep.tsx` — light restyle + mobile 70% centered.
- `FunnelLogo` (in JourneyClient) — `/mioshy-b.svg`.
- `ProgressBar` component — count centered above bar.
- `app/[locale]/journey/assessment/page.tsx` — page wrapper/background if it sets a dark bg.
- Ranking subline copy (DB/seed for `q_priorities`).

## 7. Out of scope — DO NOT change
- Question data model, loader, gating, phase (short/full), scoring/axes, analyze pipeline, auth/paywall interstitials, results screen (`AnalysisSummary`) — untouched.
- The intimacy/friendship assessments flow (`components/assessments/*`) — this work order is journey-only.

## 8. Delivery
- Work on a branch off `game`.
- **Deploy to a Vercel PREVIEW and share the preview URL for Itzik's review BEFORE merging to `game` (prod).**
- Risk: UI/copy only (no money/Cardcom/auth/migration) — but per Itzik, **preview review is required** before prod on this one.

## 9. QA checklist (on preview)
- [ ] Real questions render (short + full), all types, HE + EN.
- [ ] Likert: black numbers, 0.4px gradient ring, label under each, auto-advance.
- [ ] Choice: gradient tick ✓, auto-advance.
- [ ] Reflection + ranking: dark Continue pill; "סיום" on last.
- [ ] "חזרה ›" bottom-left, visible on mobile, hidden on Q1. No "דלג".
- [ ] Progress count centered above bar; reads correctly.
- [ ] Logo = black `mioshy-b.svg` on light bg; ~100px gap below.
- [ ] Mobile question width wide; desktop ~2× width; ranking 70% centered on mobile.
- [ ] Answers still save; back-fill on return still works; gating/paywall unchanged.
