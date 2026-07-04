# WhatsApp template — Meta submission fields (touch 3א, v4)

**For:** Itzik to submit today in Meta Business Manager → WhatsApp Manager →
Message Templates → **Create template**. Copy each field exactly. Until Meta
approves this template, the 3א touch is NOT sent (there is no duplicate email
fallback on that day — we skip it), per docs/mailing-schedule-2026-07-03.md §3א.

---

## Fields to enter

| Field | Value |
|---|---|
| **Name** | `trial_intro_reminder_v4` (lowercase + underscores; Meta requires this format) |
| **Category** | **Marketing** |
| **Language** | **Hebrew (he)** |
| **Header** | None |
| **Body** | (below, verbatim) |
| **Footer** | None |
| **Buttons** | One **URL** button (see below) |

### Body (Hebrew, RTL) — paste exactly
```
היי {{1}}, תזכורת קטנה ממיאושי: 7 ימי ניסיון בלי חיוב ומחיר ההיכרות לחודש הראשון עדיין שמורים לכם, עד היום בשעה {{2}}. ההמשך בלחיצה אחת למטה.
```
- Length ≈ 130 / 1024 chars. Two variables. The body does NOT end on a variable
  (Meta rule satisfied — it ends with "למטה.").

### Body variable sample values (Meta requires examples)
- `{{1}}` = `דנה`
- `{{2}}` = `21:00`

Variable meaning (for our send code, not entered in Meta):
- `{{1}}` = first name
- `{{2}}` = the offer-window expiry time (HH:MM), same-day

### Button — URL type
| Sub-field | Value |
|---|---|
| Button type | **Visit website (URL)** |
| Button text | `ממשיכים למיאושי` (15 / 25 chars) |
| URL type | **Static** |
| URL | `https://mioshy.com/he/journey/assessment` |

> The URL is static because our body can't carry the link and the button URL
> doesn't need per-user personalization. If you'd rather track the WhatsApp
> source, use `https://mioshy.com/he/journey/assessment?utm_source=wa&utm_medium=template&utm_campaign=trial_intro_v4` (still static — no `{{n}}` in the URL).

---

## Notes
- **Category MUST be Marketing** (it's a promotional reminder, not a utility
  notification). A Utility submission would be rejected / mis-categorized.
- Sending conditions on our side (once approved): 24h after the short assessment,
  only if not purchased, consent required, and never more than one WhatsApp per
  user per week. The send route stays admin-manual until a Meta-approved template
  + automated path exist.
- After Meta approves, tell me the exact approved template **name** and I'll wire
  the send (variables {{1}} name, {{2}} time) into the window sequence.
