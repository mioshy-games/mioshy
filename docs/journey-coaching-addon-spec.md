# מסע זוגיות — ליווי כתוסף בתשלום (Coaching add-on) — Stage 1

> ספק (spec) לשלב 1. נכתב מול מצב הקוד בפועל ב-`game` נכון ל-2026-06-30.
> ענף עבודה: `feat/journey-coaching-addon` (נוצר מ-`game`).
> **Gate שאושר:** `feat/stage3-dynamic-pricing` מוזג במלואו ל-`game` (0 commits מקדימים) — מותר להתחיל.
> **רגיש לכסף.** Cardcom → **preview לפני merge; אסור להשלים חיוב אמיתי ב-preview.**
> סטטוס: ממתין לאישור Itzik על ההחלטות הפתוחות לפני כתיבת קוד.

---

## 0. תקציר המוצר

- מנוי journey **אחד** (לא tier נוסף). הליווי (צ'אט מומחה זוגי) = **תוסף בתשלום** על אותו מנוי.
- שלב 1 משחרר: (א) **בחירת עם/בלי ליווי בשלב הרכישה**, (ב) **נעילת הצ'אט** למי שאין לו ליווי.
- **בלי** שדרוג / פרורייטה / החלפה — כל אלה שלב 2 ("בקרוב").
- המחירים עצמם **לא מקודדים** — Itzik מגדיר באדמין (content + עלות ליווי per-cadence). `coaching_cost` default 0.

### מודל מחירים (2 רכיבים לכל cadence)
כל cadence ב-journey מחזיק שני רכיבים:
1. **content** — ה-`price_ils`/`price_usd` הקיים (לא נוגעים בו).
2. **עלות ליווי** — עמודה חדשה (`coaching_cost_ils`/`coaching_cost_usd`), default 0.

- בלי ליווי = `content`.
- עם ליווי = `content + coaching_cost`.
- מבצע על הליווי: מציג **מחיר-אחרי-מבצע** + **מקורי בקו** (struck-through).

### עקרון תאימות־לאחור (חשוב)
- `subscriptions.coaching` default **true**; מנויי journey קיימים → backfill ל-true.
- `coaching_cost` default **0**.
- ⇒ בהשקה (לפני ש-Itzik מזין עלות ליווי): כולם מחויבים `content + 0 = content`, כולם רואים צ'אט — **זהה למצב היום**. אין שינוי התנהגות עד שמזינים `coaching_cost > 0`.

---

## 1. שינויי DB — SQL להרצה ידנית

> אין runner; DDL לא דרך PostgREST. הריצו ידנית מול ה-DB (preview קודם).
> ה-Supabase client לא-typed → `tsc` **לא** יתפוס אי-התאמת סכמה. חובה לאמת מול ה-DB החי אחרי ההרצה (ראו §10).
> קובץ מיגרציה מוצע (להוספה לרפו אחרי אישור): `supabase/migrations/149_journey_coaching_addon.sql`.

```sql
-- 149_journey_coaching_addon.sql
-- Stage 1: coaching as a paid add-on to journey. Run as ONE transaction. Preview first.
begin;

-- 1) subscriptions.coaching --------------------------------------------------
alter table public.subscriptions
  add column if not exists coaching boolean not null default true;

-- backfill existing journey subscriptions explicitly (default already true,
-- kept explicit for clarity and in case the column default ever changes).
update public.subscriptions
   set coaching = true
 where product = 'journey'
   and coaching is distinct from true;

-- 2) subscription_prices coaching cost (journey-only meaningful; default 0) ---
alter table public.subscription_prices
  add column if not exists coaching_cost_ils numeric(10,2) not null default 0
    check (coaching_cost_ils >= 0),
  add column if not exists coaching_cost_usd numeric(10,2) not null default 0
    check (coaching_cost_usd >= 0);
-- DO NOT touch: unique (product, cadence) / the invariants constraint trigger /
-- the "default-must-be-enabled" constraint. They stay exactly as-is.

-- 3) subscription_promos coaching targeting dimension ------------------------
alter table public.subscription_promos
  add column if not exists coaching_scope text not null default 'all'
    check (coaching_scope in ('with','without','all'));
-- 'all'     = applies regardless of coaching choice (back-compat default)
-- 'with'    = only the "with coaching" option
-- 'without' = only the "without coaching" option

commit;
```

### עדכון RPC `save_subscription_prices`
(להוסיף לאותה מיגרציה / מיגרציה צמודה. `coalesce(...,0)` שומר על payloads ישנים שלא שולחים את השדות.)

```sql
create or replace function public.save_subscription_prices(p_rows jsonb, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
begin
  if not public.is_admin() then
    raise exception 'save_subscription_prices: not authorized';
  end if;

  -- Pass 1: clear defaults for referenced products.
  update public.subscription_prices
     set is_default = false
   where product in (
     select distinct (elem->>'product') from jsonb_array_elements(p_rows) elem
   );

  -- Pass 2: upsert by (product, cadence) — now incl. coaching cost.
  for r in select * from jsonb_array_elements(p_rows)
  loop
    insert into public.subscription_prices
      (product, cadence, price_ils, price_usd,
       coaching_cost_ils, coaching_cost_usd,
       enabled, is_default, updated_at, updated_by)
    values (
      r->>'product',
      r->>'cadence',
      (r->>'price_ils')::numeric,
      (r->>'price_usd')::numeric,
      coalesce((r->>'coaching_cost_ils')::numeric, 0),
      coalesce((r->>'coaching_cost_usd')::numeric, 0),
      (r->>'enabled')::boolean,
      (r->>'is_default')::boolean,
      now(),
      p_actor
    )
    on conflict (product, cadence) do update set
      price_ils         = excluded.price_ils,
      price_usd         = excluded.price_usd,
      coaching_cost_ils = excluded.coaching_cost_ils,
      coaching_cost_usd = excluded.coaching_cost_usd,
      enabled           = excluded.enabled,
      is_default        = excluded.is_default,
      updated_at        = now(),
      updated_by        = p_actor;
  end loop;
end;
$$;
```
> אזהרה: ה-`do update` כותב `coaching_cost = excluded`. לכן טופס האדמין **חייב** לשלוח תמיד את שני שדות עלות הליווי (גם 0), אחרת שמירה תאפס עלות קיימת. (נטופל ב-§8.)

---

## 2. Entitlements — `journeyCoaching`

קובץ: `lib/entitlements/getUserEntitlements.ts`

- בשאילתת ה-subscriptions (כיום בוחרת `product, status, current_period_end, journey_grace_until, journey_blocked_at`) — **להוסיף `coaching`**.
- להוסיף לטיפוס `UserEntitlements`:
  ```ts
  /** Stage 1 — coaching add-on flag of the active/grace journey subscription. */
  journeyCoaching: boolean;
  ```
- חישוב: `journeyCoaching = true` רק אם קיים מנוי journey **active או grace** עם `coaching = true`. אם אין מנוי journey → `false`.
- `journey` (הבוליאני) **נשאר true** לשני המצבים (active+grace) — ללא שינוי.
- ירושת בני-זוג: מאחר שה-query כבר עובר ל-`user_id` של ה-owner עבור partner, `journeyCoaching` יורש אוטומטית — לוודא שזה נשמר.
- test-user bypass: לתת `journeyCoaching = true` (כמו שאר ה-pillars).

---

## 3. נעילת הצ'אט (gate על `journeyCoaching`)

**עיקרון:** הפרק נשאר **מלא** (תוכן, lesson, feedback). רק **הצ'אט / תגובות המומחה** ננעלים מאחורי overlay.
**בלי רכישה ובלי Cardcom** — לחיצה על הנעול = "בקרוב". קופי הזמנה: **"הוסיפו מומחה זוגי למנוי"**.

### Render (gate על `journeyCoaching`)
לסרוק את **כל משטחי הצ'אט/תגובות המומחה**, לא רק עמוד הפריט:
- `app/[locale]/(shell)/journey/timeline/[scheduledId]/page.tsx` — ה-`<section>` שעוטף את `PerItemThread` (סביב שורות 294–305). אם `!journeyCoaching` → לעטוף ב-overlay נעול במקום לרנדר composer פעיל. ה-entitlements כבר זמינים בעמוד.
- `components/journey/timeline/PerItemThread.tsx` — מצב נעול: היסטוריה מוצללת/חסומה + composer לא-פעיל + overlay.
- **General channel** + כל תצוגת תגובות מומחה אחרת (`journey_messages` / `author_kind="expert"`) ב-`/my`/`/my/journey` — לאתר ולגזור על אותו flag. (פעולות השרת ב-`app/actions/journey-messages.ts`: `postGeneralChannelMessage`, `postExpertReplyToChannel` — לאתר את ה-UI הצורך אותן ולנעול גם אותו.)

### Overlay
לעשות reuse לדפוסי הנעילה הקיימים:
- אייקון `Lock` (lucide) + `opacity-55 saturate-75` (כמו `TimelineList.tsx`), או overlay מלא בנוסח `PaywallGateModal.tsx`.
- טקסט: "הוסיפו מומחה זוגי למנוי" + כפתור/לחיצה → טוסט/דיאלוג "בקרוב" (ללא ניווט לרכישה, ללא Cardcom).

### Server-side guard (defense-in-depth)
ב-`app/actions/journey-messages.ts`, לפני בדיקת `isUnlocked`:
- `postPerItemMessage` ו-`postGeneralChannelMessage` — אם ל-viewer אין `journeyCoaching` → להחזיר `{ ok:false, error:"coaching_required" }`.
- (תגובות מומחה — `postExpertReplyToItem`/`postExpertReplyToChannel` — נשארות מאחורי `requireExpert`; אין צורך בשינוי חיוב, אך לוודא שאין מסלול שמייצר thread פעיל למשתמש ללא ליווי.)

---

## 4. UI הרכישה (`AnalysisSummary` / paywall)

קובץ: `components/journey/AnalysisSummary.tsx` (cadence picker בשורות ~147–153, checkout builder ~287–327, תצוגת מחיר ~568–675).

- **כרטיס בחירה** (בנוסף ל-cadence picker הקיים):
  - **בלי ליווי** — `content`.
  - **עם ליווי** — `content + coaching_cost`. כשיש מבצע ממוקד למצב הזה: מחיר-אחרי-מבצע + **מקורי בקו**.
- ברירת מחדל לבחירה: ראו החלטה פתוחה #2.
- בחירה → גוף ה-checkout: `{ plan: <cadence>, product:"journey", coaching: <bool>, ... }`.
- **מקור נתונים יחיד:** להרחיב את `CadenceOption` (הנטען בשרת מ-`subscription_prices`) לכלול `coaching_cost_ils/usd`, ואת `activePromo` summary לשקף `coaching_scope`. החישוב של "עם ליווי / בלי ליווי / מבצע" יושב ב-**מודול משותף** (ראו §7) שגם ה-checkout משתמש בו — כך ש**המוצג == הנגבה**.

---

## 5. `checkout/create` — החיוב היחיד שמטמיעים (רכישה ראשונה)

קובץ: `app/api/billing/checkout/create/route.ts`

- לקבל בגוף הבקשה `coaching: boolean` (אופציונלי; ברירת מחדל — החלטה פתוחה #2).
- מחיר: `coaching ? content + coaching_cost : content` (per cadence, per currency) — **דרך המודול המשותף של §7** (לא חישוב כפול).
- להחיל מבצע לפי המיקוד (`coaching_scope`) — ראו §6.
- לחייב (Cardcom LowProfile, כמו היום) ולשמור:
  - `subscriptions.coaching = <bool>`,
  - `plan_amount = ` ה-bundle התקופתי המלא (`content (+coaching_cost)`),
  - `intro_amount`/`intro_charges_remaining` מהמבצע (כמו היום),
  - `promo_id`/`original_amount` כמו היום.

---

## 6. חידוש (Renewal cron)

קובץ: `app/api/billing/renewals/run/route.ts` (היום מחייב `intro_amount` בעוד יש intro, אחרת `plan_amount` — snapshot מהרכישה).

> ⚠️ **זו ההחלטה הרגישה ביותר לכסף — ראו החלטה פתוחה #1.**
> **המלצה (snapshot):** ב-`checkout/create` כבר שומרים `plan_amount` = ה-bundle התקופתי המלא לפי הבחירה. לכן החידוש **לא צריך שינוי** — הוא ממילא מחייב `plan_amount`, וזה "לפי הבוליאני" כי הבוליאני קבע את `plan_amount` ברכישה. מנויים קיימים (`plan_amount = content`, `coaching=true`, `coaching_cost=0`) — **ללא שינוי**. בלי פרורייטה.
> **חלופה (recompute חי):** ה-cron קורא `coaching` + `coaching_cost` חי ומחשב `content (+coaching_cost)`. סיכון: עריכת מחיר באדמין תשנה רטרואקטיבית חידושים של מנויים קיימים (לא כך המערכת עובדת היום). **לא מומלץ** לשלב 1.

---

## 7. מקור־אמת יחיד למחיר (money guarantee)

ליצור מודול משותף (מוצע: `lib/billing/journey-coaching-pricing.ts`, או הרחבת `lib/billing/pricing-queries.ts`) עם פונקציה אחת:

```ts
resolveJourneyAmount({ cadence, coaching, isIsraeli, promo }) =>
  { amount, originalAmount, currency, coinId }   // amount = post-promo; original = pre-promo (for the struck line)
```

- ה-**paywall data loader** וה-**checkout/create** קוראים לאותה פונקציה.
- כלל: **המוצג למשתמש == הסכום שמגיע ל-Cardcom**. בלי שני נתיבי חישוב.
- (ה-`JourneyPricingProvider` של Stage-3 הוא לשיווק בלבד — לא חלק מ-paywall; להשאיר כפי שהוא אלא אם נדרש לעדכן את ה-Stage-3 copy בנפרד.)

---

## 8. אדמין

- **מחירים** (`components/dashboard/pricing/PricingForm.tsx`, action `app/dashboard/actions/subscription-prices.ts`, page `app/dashboard/settings/pricing/page.tsx`):
  - להוסיף שדות "עלות ליווי" (`coaching_cost_ils`/`coaching_cost_usd`) לצד ה-content price, **per-cadence**, עבור **journey בלבד** (games — להשאיר 0 / להסתיר את השדה).
  - לעדכן את ה-zod schema + ה-payload כך שיישלחו **תמיד** (גם 0) — בגלל ה-`do update` ב-RPC (§1).
- **מבצעים** (`components/dashboard/marketing/PromoDialog.tsx`, action `app/dashboard/actions/subscription-promos.ts`, page `app/dashboard/marketing/discounts/page.tsx`, לוגיקה `lib/billing/promos.ts`):
  - להוסיף בורר **מיקוד ליווי** (`coaching_scope`: עם / בלי / שניהם), לצד `product`+`cadence` הקיימים.
  - להרחיב את `selectActivePromo`/`promoApplies*` בדימוש coaching (כמו שכבר קיים ל-cadence). תצוגה+חיוב לפי המיקוד.
  - מינימום (אפשר אחרון): מבצע על מחיר הליווי "כמו היום" — המבצע מחיל הנחה על הסכום הנגבה (bundle) ומסונן לפי `coaching_scope`. (ראו החלטה פתוחה #3 על "הנחה על ה-bundle כולו" מול "על רכיב הליווי בלבד".)

---

## 9. מחוץ לסקופ / "בקרוב" (שלב 2 — לא לגעת)

כל נתיב חיוב **מעבר לרכישה הראשונה**:
- שדרוג בלי→עם ליווי (פרורייטה + token),
- הורדה עם→בלי,
- `games → journey` עם בחירת ליווי,
- החלפת `coaching` באדמין על מנוי קיים (כחיוב).

וגם: **עמוד השיווק + השאלון** — לא בסקופ שלב 1.

---

## 10. צעדי Verify ל-preview (בלי חיוב אמיתי)

> **אסור להשלים תשלום אמיתי ב-Cardcom על preview.** עוצרים בעמוד ה-LowProfile / בודקים את ה-`amount` שנשלח, או משתמשים ב-`NEXT_PUBLIC_BILLING_TEST_PRICE` / טרמינל test של Cardcom.

1. **DB:** להריץ את SQL §1 על ה-DB של preview. לאמת חי:
   `select column_name from information_schema.columns where table_name in ('subscriptions','subscription_prices','subscription_promos') and column_name in ('coaching','coaching_cost_ils','coaching_cost_usd','coaching_scope');`
2. **אדמין מחירים:** להזין `coaching_cost_ils` ל-journey (למשל monthly=30) ולשמור; לוודא שנשמר ושעריכה חוזרת לא מאפסת content.
3. **Entitlements/נעילה:** test-user עם journey active+`coaching=true` → צ'אט פתוח. לעדכן ידנית `coaching=false` על המנוי → הפרק מלא, הצ'אט נעול (overlay), לחיצה = "בקרוב", **אין** Cardcom.
4. **Paywall:** לפתוח `AnalysisSummary` → שני כרטיסים. "עם ליווי" = content+30; כשיש promo ממוקד — מחיר-אחרי + מקורי בקו. "בלי ליווי" = content.
5. **המוצג==הנגבה:** לבחור "עם ליווי", ב-DevTools/Network לבדוק שגוף `/api/billing/checkout/create` כולל `coaching:true`, ושסכום ה-`openLowProfile`/checkout_session **שווה** למוצג. **לא** לסיים תשלום.
6. **מבצע ממוקד:** ליצור promo `coaching_scope='with'` → לוודא שמוחל רק על כרטיס "עם ליווי".
7. **חידוש (snapshot):** לוודא ש-`plan_amount` שנשמר ברכישה = ה-bundle הנכון; מנוי קיים (coaching=true, cost=0) → סכום חידוש ללא שינוי.
8. **gates:** `pnpm tsc --noEmit` = 0. ESLint = 0 — **לא** דרך `pnpm build` בתוך worktree (מדלג בשקט); להריץ ישירות `eslint --no-eslintrc --config .eslintrc.json` (ראו memory: local-build-eslint-blind-spot).

---

## 11. החלטות (אושרו ע"י Itzik, 2026-06-30)

1. **חידוש — ✅ snapshot.** `checkout/create` שומר `plan_amount` = ה-bundle המלא לפי הבחירה (אחרי מבצע); ה-cron ממשיך כמו היום **ללא שינוי**. שינוי מחיר באדמין משפיע רק על רכישות חדשות, לא על מנויים קיימים — בדיוק כמו היום.
2. **ברירת מחדל `coaching` ב-checkout/create — ✅ true.** מעקה ברזל: **העלאת `coaching_cost` מעל 0 מותרת רק אחרי שכל משטח שקורא ל-checkout/create עבור journey שולח `coaching` מפורש (או יש לו בורר).** בשלב 1 `coaching_cost` נשאר 0 והתנהגות זהה להיום. רשימת החשיפה — §13.
3. **מבצע ממוקד-ליווי — ✅ על הסכום הנגבה (content+coaching), מסונן ב-`coaching_scope`,** בדיוק כמנוע ה-promos היום (מקור יחיד). (מבצע 222→97 = הנחה על ה-bundle.)

---

## 13. מעקה ברזל — משטחים שקוראים היום ל-`checkout/create` עבור journey

> חובה לוודא שכל המשטחים האלה שולחים `coaching` מפורש (או יש להם בורר) **לפני** העלאת `coaching_cost > 0`.
> כל עוד `coaching_cost = 0` — הכל זהה להיום (`content + 0`).

| # | קובץ | product | plan | בורר ליווי בשלב 1? | חשיפה |
|---|---|---|---|---|---|
| 1 | `components/journey/AnalysisSummary.tsx:291` | `"journey"` | `checkoutPlan` | ✅ כן (הבורר) | בטוח |
| 2 | `components/assessments/AssessmentSummary.tsx:148` | `"journey"` | `checkoutPlan` | ❌ | חשיפה |
| 3 | `components/journey/JourneyCheckoutButton.tsx:64` | `"journey"` | `"weekly"` | ❌ | חשיפה |
| 4 | `components/journey/PaywallGateModal.tsx:43` | *(חסר → default `journey`)* | `"monthly"` | ❌ | חשיפה |
| 5 | `components/SubscriptionModal.tsx:554` | *(חסר → default `journey`)* | `plan` | ❌ | חשיפה |
| 6 | `components/pricing/PricingCheckout.tsx:114` | `product` (כש=`journey`) | `"weekly"` | ❌ | חשיפה (כש journey) |
| — | `app/actions/between-us-couple.ts:224` | `"adults"` (one_time) | — | — | לא journey — לא רלוונטי |

**מסקנה:** בשלב 1 הבורר רק ב-`AnalysisSummary`. #2–#6 ממשיכים עם default `coaching=true`. לפני money-change (coaching_cost>0) — להוסיף בורר/`coaching` מפורש לכל #2–#6, או להחליט פר-משטח (with/without) במפורש.

---

## 12. רשימת קבצים (סקופ ערוך מדויק)

| תחום | קובץ |
|---|---|
| DB SQL ידני | (חדש) `supabase/migrations/149_journey_coaching_addon.sql` |
| Entitlements | `lib/entitlements/getUserEntitlements.ts` |
| נעילת צ'אט | `app/[locale]/(shell)/journey/timeline/[scheduledId]/page.tsx`, `components/journey/timeline/PerItemThread.tsx`, `app/actions/journey-messages.ts` (+ משטחי general-channel/expert שיאותרו בסריקה) |
| Paywall | `components/journey/AnalysisSummary.tsx` (+ ה-loader שמזין `journeyCadences`/`activePromo`) |
| מחיר מקור-יחיד | (חדש/הרחבה) `lib/billing/journey-coaching-pricing.ts` או `lib/billing/pricing-queries.ts` |
| checkout | `app/api/billing/checkout/create/route.ts` |
| renewal | `app/api/billing/renewals/run/route.ts` (ללא שינוי תחת snapshot) |
| promos | `lib/billing/promos.ts`, `lib/billing/promo-validations.ts` |
| אדמין מחירים | `app/dashboard/settings/pricing/page.tsx`, `components/dashboard/pricing/PricingForm.tsx`, `app/dashboard/actions/subscription-prices.ts` |
| אדמין מבצעים | `app/dashboard/marketing/discounts/page.tsx`, `components/dashboard/marketing/PromoDialog.tsx`, `app/dashboard/actions/subscription-promos.ts` |

> memory: לערוך רק קבצים בסקופ הנ"ל; אם נשארות הופעות בקבצים לא-מנויים — לדווח, לא לתקן לבד.
