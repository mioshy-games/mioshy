# Mioshy Journey - Operator Runbook

> The journey module layers a 28-question relationship questionnaire, a
> rule-based analysis engine, and a 26-week engagement program onto the
> existing mioshy SaaS (games + articles + billing).

## 1. What's new

### Database (Supabase migrations)

| File                                   | Purpose                                                    |
| -------------------------------------- | ---------------------------------------------------------- |
| `026_journey_questionnaire.sql`        | Tables, RLS, RPC, and `admin_users_overview` view          |
| `027_seed_message_templates.sql`       | 15 base templates keyed to `BASE_PLAN` in `engagement.ts`  |

New tables: `journeys`, `journey_responses`, `journey_analysis`,
`message_templates`, `engagement_schedules`, `sent_messages`,
`journey_tasks`, `user_notes`, `activity_logs`.

### Library code

```
lib/journey/
├── types.ts        # Axis, Question, Response, Analysis types
├── questions.ts    # loads journey/questionnaire.json, helpers
├── analysis.ts     # analyze(responses): friendship/conflict/passion/love-lang
└── engagement.ts   # BASE_PLAN + buildSchedulePlan + renderTemplate + sendViaProvider
```

### Content

```
journey/
├── EXTRACTED_INSIGHTS.md    # psychological spine kept/dropped + design rules
├── questionnaire.json       # 28 questions (he/en) × 20 scoring axes
└── README.md                # this file
```

### Public API routes

| Route                        | Method | Purpose                                   |
| ---------------------------- | ------ | ----------------------------------------- |
| `/api/journey/progress`      | GET    | journey state + `subscriptionActive`      |
| `/api/journey/answer`        | POST   | save one answer, advance step             |
| `/api/journey/analyze`       | GET / POST | latest analysis / force recompute     |
| `/api/journey/resume`        | POST   | link anonymous device journey to user id  |

### Admin API routes

| Route                                | Methods       |
| ------------------------------------ | ------------- |
| `/api/admin/users`                   | GET (filters) |
| `/api/admin/users/[id]`              | GET           |
| `/api/admin/notes`                   | POST / PATCH / DELETE |
| `/api/admin/messages/send`           | POST          |
| `/api/admin/tasks`                   | POST / PATCH  |
| `/api/admin/templates`               | GET / POST    |
| `/api/admin/templates/[id]`          | PATCH / DELETE|
| `/api/admin/automation`              | POST (idempotent, `force=true` to rebuild) |
| `/api/engagement/tick`               | GET (cron, shared secret) |

### User-facing UI

| Path                                    | What                                          |
| --------------------------------------- | --------------------------------------------- |
| `/[locale]/journey`                     | 28-question flow with auth gate + paywall     |
| `/[locale]/account`                     | existing - now reflects active subscription   |

### Admin UI

| Path                                    | What                                          |
| --------------------------------------- | --------------------------------------------- |
| `/dashboard/users`                      | journey users list                            |
| `/dashboard/users/[id]`                 | full detail: analysis, answers, notes, send, tasks, automation |
| `/dashboard/templates`                  | list + create form                            |
| `/dashboard/templates/[id]`             | bilingual editor + live preview               |
| `/dashboard/automation`                 | queue counts, upcoming sends, recent failures |

## 2. Environment variables

Add to `.env.local`:

```bash
# Journey / engagement
ENGAGEMENT_CRON_SECRET=<random-long-string>
ENGAGEMENT_DRY_RUN=1     # set to "1" in dev/staging - prints instead of sending

# Message provider - any one of these, depending on which you wire first
RESEND_API_KEY=<key>
TWILIO_ACCOUNT_SID=<sid>
TWILIO_AUTH_TOKEN=<token>
TWILIO_WHATSAPP_FROM=<whatsapp:+1415...>
```

The `sendViaProvider` stub in `lib/journey/engagement.ts` currently only
respects `ENGAGEMENT_DRY_RUN`. Swap it for your real Resend/Twilio call
before going live.

## 3. Deployment steps (once)

1. **Run migrations in order:**
   ```
   supabase db push   # or run 026 + 027 via SQL editor
   ```
2. **Grant admin to yourself:**
   ```sql
   UPDATE auth.users
   SET raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'
   WHERE email = 'you@mioshy.com';
   ```
3. **Deploy Next.js** (`vercel deploy` or equivalent). Set env vars in host.
4. **Wire the cron.** In `vercel.json`:
   ```json
   {
     "crons": [
       { "path": "/api/engagement/tick", "schedule": "*/5 * * * *" }
     ]
   }
   ```
   Add a Vercel middleware or use `headers` on the cron definition to
   inject `x-engagement-secret`. Or run an external scheduler that calls
   `GET /api/engagement/tick` with that header.

## 4. How a user flows through

1. Lands on `/[locale]/journey` → gets a `device_id` cookie, a `journeys` row with `user_id=NULL` is created.
2. Answers q01, q02, q03 (free - `gating.auth_after_index = 2`).
3. `AuthGateModal` opens. On signup, `/api/journey/resume` calls the `link_journey_to_user` RPC to attach the anonymous journey to the new `auth.users.id`.
4. Answers q04, q05, q06 (registered tier).
5. `PaywallGateModal` opens (`gating.paywall_after_index = 5`). Cardcom checkout → on success, `subscriptions.status = 'active'` → middleware on `/api/journey/answer` allows further submissions.
6. Finishes q07–q28. On completion, `analyze()` runs, writes to `journey_analysis`.
7. Admin (or a `POST /api/admin/automation`) builds `engagement_schedules` for the user.
8. `/api/engagement/tick` cron picks up due rows, renders, sends, records `sent_messages`.

## 5. How the analysis engine scores

Every question has axes with weights (some negative). `analyze` normalizes
each Likert (1..5) to 0..1, sums weighted contributions per axis, then:

- **friendship_score (0..100)**: avg of `love_map`, `fondness`, `turn_toward`, `positive_sentiment`, `shared_meaning`.
- **conflict_health (0..100)**: `100 − 100 × avg(horsemen axes)`.
- **passion_risk (0..100)**: 1 − avg of `autonomy`, `anticipation`, `play`.
- **primary_love_language**: argmax over the 5 Chapman axes from the forced-choice question.
- **top_gap**: lowest axis among friendship + passion families → guides recommendations.
- **four_horsemen_flag**: true if any horsemen axis > 0.5 after normalization.

Summary is deterministic bilingual prose. No LLM in the hot path.

## 6. How the 26-week plan is built

`BASE_PLAN` in `engagement.ts` is a list of `{template_key, offset_days, reason, condition?}`.
`buildSchedulePlan(analysis, startAt)` filters conditionals (e.g. w05 only if
`conflict_health < 60 || four_horsemen_flag`), maps `offset_days` to absolute
`scheduled_for` timestamps, and returns the list. The admin API POST then
resolves each `template_key` → `template_id` via `message_templates.key` and
inserts into `engagement_schedules`.

Idempotent: won't double-schedule unless `force=true`.

## 7. Common tasks

**Add a new template.** `/dashboard/templates` → create → editor → save. To
have it sent automatically as part of the 26-week program, also add a
`{ template_key, offset_days, reason }` entry to `BASE_PLAN`.

**Preview before sending.** In the template editor, demo variables render in
both locales. For a real-user preview, open the admin user detail page →
Send Message → pick template → the subject/body fields populate with the
real rendered content for that user.

**Stop a user from receiving more messages.** `UPDATE engagement_schedules
SET status='skipped' WHERE user_id=... AND status='pending'`. Or cancel
subscription - the cron checks `shouldSendForSubscription(sub.status)` on
each send and will skip non-active plans.

**Retry a failed schedule.** `UPDATE engagement_schedules SET status='pending',
scheduled_for=now(), error=NULL WHERE id=...`.

**Change language preference.** The cron currently hardcodes `locale = "he"`
with a TODO. When you add per-user preferred language (e.g. on the `profiles`
table or `auth.users.raw_user_meta_data`), read it in the cron before
rendering.

## 8. Troubleshooting

| Symptom                                     | First thing to check                                              |
| ------------------------------------------- | ----------------------------------------------------------------- |
| POST /api/admin/automation returns `no_templates_matched` | Migration 027 not run, or `BASE_PLAN` keys ≠ seeded keys. |
| Cron returns 403                            | `ENGAGEMENT_CRON_SECRET` env missing or `x-engagement-secret` not matching. |
| User stuck at paywall                       | No `subscriptions` row with `status='active'` or Cardcom webhook didn't fire. |
| "already_scheduled" on automation POST      | User already has rows in `engagement_schedules`. Use `force:true` to rebuild. |
| Messages showing `{{first_name}}` literally | `journey_analysis` row missing - run POST `/api/journey/analyze`. |

## 9. Files not to touch without care

- `lib/journey/analysis.ts` - changes invalidate historical analyses stored in DB. Bump `analysis_version`.
- `supabase/migrations/026_*.sql` - already applied in prod; write new migrations instead.
- `journey/questionnaire.json` - changing IDs breaks old responses. Add new questions with new IDs; don't rename.
