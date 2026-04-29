# Seven Principles — Extracted Insights & Framework

**Sources analyzed:**
- *The Seven Principles for Making Marriage Work* — John Gottman & Nan Silver (PDF, ~543KB text extracted)
- *הסוד לנישואים מאושרים ארוכים* — Itzik Barlev (Hebrew docx)
- *The 10 Commands for Your Relationship* — Itzik Barlev (bilingual docx)

The product (mioshy) is **not** a Gottman clone. Gottman is used as the empirical backbone for diagnostics; the Hebrew source gives the tonal voice (warm, coach-like, "I came from UX, I rebuilt my own marriage"). The unified questionnaire below transforms both into a modern subscription product.

---

## 1. The psychological spine we're keeping

### Gottman's Sound Relationship House (the diagnostic layer)
| Layer | What it measures | Signal in our questionnaire |
|---|---|---|
| Love Maps | Do you know your partner's inner world? | knowledge / curiosity scale |
| Fondness & Admiration | Do you still see the good? | gratitude / pride scale |
| Turn Toward / Bids | Do you respond to small connection attempts? | micro-responsiveness scale |
| Positive Sentiment Override | Do you give benefit of the doubt? | attribution scale |
| Accepting Influence | Do you share power? | collaborative-decision scale |
| Repair Attempts | Can you de-escalate? | repair-success scale |
| Shared Meaning | Do rituals, roles, goals, symbols align? | ritual/goal alignment |

### Gottman's Four Horsemen (the risk layer)
Criticism → Contempt → Defensiveness → Stonewalling. We screen all four to flag couples who need a de-escalation track before passion work.

### Gary Chapman's Five Love Languages (the personalization layer)
Words of Affirmation / Quality Time / Acts of Service / Physical Touch / Gifts. Detected via forced-choice pairs, not Likert (more accurate — Chapman himself uses forced-choice).

### Esther Perel's Eroticism / Distance axis (the passion layer)
Passion dies when couples over-merge. We probe:
- Autonomy vs fusion (can you still see your partner as separate?)
- Anticipation (is there mystery or complete predictability?)
- Play (is there humor, teasing, non-goal-oriented affection?)
- Context (does daily logistics eat every shared minute?)

### Itzik Barlev's framing (the tonal layer)
From *הסוד* and the 10 Commands — the "I" in the relationship, fate, communication, fight-or-flight, persistence, love & respect, forgiveness, creation, play. We use his voice in copy: first-person, coach-not-clinician, growth-oriented, no jargon.

---

## 2. What we deliberately drop

- Gottman's T/F binary scoring (too blunt for mobile/web; users click-through without thinking).
- Gendered language ("husband"/"wife" → "partner"/"בן/בת זוג").
- Religious framing around shared values (broadened to values).
- The entire "solvable vs perpetual problem" framework — too complex for onboarding; we move it into Week-3 content after paywall.
- Anything explicit sexually (mioshy is intimacy-not-erotica — we probe *desire gaps* and *emotional-physical connection*, not technique).

---

## 3. Question design rules (applied to every question)

1. **One axis per question.** No double-barreled ("do you feel heard *and* respected").
2. **Present-tense, last 2 weeks.** Avoids rosy retrospection.
3. **Behavior before feeling.** "How often did your partner text you unprompted?" beats "do you feel thought about?".
4. **Forced-choice for personality (love language).** Likert for frequency/intensity. Reflection (open text) only after paywall for insight-deepening.
5. **Every question has a purpose tag** (love_map / fondness / turn_toward / pso / influence / repair / shared_meaning / four_horsemen / love_language / passion / autonomy / play) and an insight it contributes to.
6. **Hebrew and English are translations of the same intent, not literal.** Hebrew is warmer, more colloquial; English is tighter.

---

## 4. Scoring model (v1)

Each answer produces a tuple `{axis, score}` where score ∈ [-2, +2] for Likert, or `{axis, weight}` for forced-choice.

**Axes** (14):
```
love_map, fondness, turn_toward, pso, influence, repair, shared_meaning,
four_horsemen_criticism, four_horsemen_contempt, four_horsemen_defensive, four_horsemen_stonewall,
love_language_words, love_language_time, love_language_service, love_language_touch, love_language_gifts,
passion_autonomy, passion_anticipation, passion_play, passion_context
```

**Derived insights per user:**
- `friendship_score` = avg(love_map, fondness, turn_toward, pso) × 100 ∈ [0,100]
- `conflict_health` = 100 − sum(four_horsemen_*) × 25, floored at 0
- `primary_love_language` = argmax(love_language_*)
- `secondary_love_language` = arg2nd
- `passion_risk` = 100 − avg(passion_*) × 100
- `top_gap` = axis with most negative z-score vs population baseline

**Gate logic (per spec):**
- After Q3 → if not registered, open auth modal (Register/Login). Answers already given are held in `device_id`-scoped `journey_responses` and linked on register.
- After Q6 → if no active subscription, open paywall. User cannot answer Q7+ until `subscriptions.status = 'active'`.
- After payment → resume exactly where they left off using `current_step` on the `journeys` row.

---

## 5. Engagement engine (post-paywall, recurring)

Once subscribed, the user enters a **26-week program** generated from their analysis:

| Week | Theme | Trigger |
|---|---|---|
| 0 | Onboarding: personalized insight summary | 0h after payment |
| 1 | Love Map deep-dive (top knowledge gap) | +3d |
| 2 | Fondness daily reps (7-day "I appreciate…" exercise, adapted from Gottman Ex.1 Ch.5) | +10d |
| 3 | Turn Toward: identify 3 recent missed bids | +17d |
| 4 | Primary love language action plan | +24d |
| 5 | Conflict repair phrases (if conflict_health < 60) | +31d |
| 6 | Passion: autonomy + anticipation rituals | +38d |
| … | … | weekly cadence; each week = 2 emails + 1 SMS nudge + 1 task |

All content is stored in `message_templates`; the scheduler in `engagement_schedules` enqueues concrete `messages` rows at the right time per user. **Sending stops only when `subscriptions.status != 'active'`** — which is set when (a) user hits Cancel in `/account`, (b) Cardcom reports failed renewal + grace period expires, or (c) admin manually cancels.

---

## 6. What the admin sees (panel design rationale)

Admins are coaches + operators. They need:
- Users list (filters: plan, engagement health, last-activity, flagged horsemen) — for triage.
- User detail: timeline of answers → analysis → messages sent → tasks assigned → notes. This is the **single source of truth** for a coach before a 1:1.
- Templates: CRUD on email/SMS/task copy, bilingual. Variable injection: `{{first_name}}`, `{{primary_love_language}}`, `{{top_gap}}`, etc.
- Automation scheduler: drag a template onto a timeline offset (`+3d after payment`, `every Monday 08:00`, `when four_horsemen_contempt ≥ 2`).
- Activity log: immutable audit trail of sends, assignments, and admin actions.
- Manual send: a coach can override automation and send a personal message from any template, editable before send.

---

## 7. File inventory produced in this pass

- `journey/EXTRACTED_INSIGHTS.md` — this file
- `journey/questionnaire.json` — 28 questions, he+en, scoring tuples
- `supabase/migrations/026_journey_questionnaire.sql` — full schema
- `lib/journey/{types,questions,analysis,engagement}.ts` — core logic
- `app/api/journey/**` — progress/answer/analyze/resume endpoints
- `app/api/admin/**` — users/notes/messages/templates/tasks endpoints
- `app/api/engagement/tick/route.ts` — cron worker
- `app/[locale]/journey/**` — user-facing questionnaire UI
- `app/dashboard/users/**` + `app/dashboard/templates/**` + `app/dashboard/automation/**` — admin UI
- `journey/README.md` — runbook: env vars, migration, cron, next steps
