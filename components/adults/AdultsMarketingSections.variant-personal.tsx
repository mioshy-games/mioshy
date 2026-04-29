/**
 * Marketing sections for /[locale]/adults — rendered above the catalogue grid.
 *
 * Server component (no interactivity). Bilingual copy is inlined for the
 * landing-page framing only; all pricing + tagline pieces that actually drive
 * commerce come from the admin-controlled settings passed in via props.
 */

import {
  Crown,
  Heart,
  Layers,
  MessageCircleHeart,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
  Check,
  Star,
  Infinity as InfinityIcon,
} from "lucide-react";
import { Link } from "@/navigation";
import type { AdultsPricing } from "@/lib/adults/pricing";
import { annualSavings } from "@/lib/adults/pricing";

type Hero = {
  singlePrice: string;
  subPrice: string;
  singleEnabled: boolean;
  subEnabled: boolean;
  buyXGetX: { buy: number; get: number }[];
};

export function AdultsMarketingSections({
  isHe,
  hero,
  pricing,
}: {
  isHe: boolean;
  hero: Hero;
  pricing: AdultsPricing;
}) {
  return (
    <div dir={isHe ? "rtl" : "ltr"} className="relative">
      {/* Pricing surfaces first — answers "how do I buy this?" immediately
          after the hero instead of making users scroll past two framing
          sections to reach the buy decision. */}
      <PricingSection isHe={isHe} hero={hero} pricing={pricing} />
      <InsideSection isHe={isHe} />
      <AudienceSection isHe={isHe} />
      <FaqSection isHe={isHe} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. What's inside
// ─────────────────────────────────────────────────────────────────────────────

function InsideSection({ isHe }: { isHe: boolean }) {
  const items = [
    {
      Icon: Layers,
      titleHe: "3 רמות עוצמה בכל משחק",
      titleEn: "3 intensity levels per game",
      bodyHe:
        "מרגש · מעורר · ללא גבולות — מתחילים בעדין, מחליטים יחד מתי לעלות שלב.",
      bodyEn:
        "Touching · Stirring · No-limits — start soft and decide together when to level up.",
      tone: "from-rose-500/25 to-amber-500/15",
    },
    {
      Icon: MessageCircleHeart,
      titleHe: "שאלות שפותחות שיחה",
      titleEn: "Prompts that open conversation",
      bodyHe:
        "לא רק אינטימיות פיזית — גם תקשורת אמיתית, קשב, וכנות שלא תמיד קל ליצור לבד.",
      bodyEn:
        "More than just physical intimacy — real communication, attention, and honesty that's not easy to reach alone.",
      tone: "from-violet-500/25 to-fuchsia-500/15",
    },
    {
      Icon: Users,
      titleHe: "לשני בני הזוג באותו הרגע",
      titleEn: "Unlocks for both of you at once",
      bodyHe:
        "זיווג חד־פעמי בקוד או במייל, ואז כל מה שרכשתם פתוח לשניכם באופן אוטומטי.",
      bodyEn:
        "Pair once via code or email — everything you own opens for both of you, automatically.",
      tone: "from-sky-500/25 to-violet-500/15",
    },
    {
      Icon: Zap,
      titleHe: "מוכן לשימוש בערב אחד",
      titleEn: "Ready to play tonight",
      bodyHe: "בוחרים משחק, פותחים את הטלפון, ומתחילים. בלי הכנה, בלי רכישות נוספות.",
      bodyEn:
        "Pick a game, open your phone, begin. No prep, no extra purchases.",
      tone: "from-emerald-500/25 to-teal-500/15",
    },
  ];

  return (
    <section id="inside" className="mx-auto max-w-6xl px-4 pt-10 pb-4">
      <header className="text-center">
        <div className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80">
          <Sparkles className="h-3.5 w-3.5 text-rose-200" />
          <span>{isHe ? "מה יש בפנים" : "What's inside"}</span>
        </div>
        <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          {isHe
            ? "חוויה שמעמיקה ככל שאתם מעמיקים"
            : "An experience that deepens as you do"}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-white/75">
          {isHe
            ? "כל משחק הוא עולם קטן — עם קצב משלו, אווירה משלו, והמון חופש לזוג שלכם."
            : "Every game is its own small world — its own pacing, its own mood, and plenty of room for the two of you."}
        </p>
      </header>

      <ul className="mt-10 grid gap-5 sm:grid-cols-2">
        {items.map(({ Icon, titleHe, titleEn, bodyHe, bodyEn, tone }) => (
          <li
            key={titleEn}
            className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] p-6 backdrop-blur-md transition hover:border-white/25 hover:bg-white/[0.06]"
          >
            <div
              aria-hidden
              className={`pointer-events-none absolute -end-10 -top-10 h-36 w-36 rounded-full bg-gradient-to-br ${tone} blur-3xl opacity-60`}
            />
            <div className="relative flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                <Icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {isHe ? titleHe : titleEn}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/75">
                  {isHe ? bodyHe : bodyEn}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Who it's for
// ─────────────────────────────────────────────────────────────────────────────

function AudienceSection({ isHe }: { isHe: boolean }) {
  const rows = [
    {
      titleHe: "זוגות שרוצים לצאת מהשגרה",
      titleEn: "Couples tired of the routine",
      bodyHe:
        "לא מחליפים בני זוג — משנים איך אתם פוגשים אחד את השני בערב שקט אחרי יום עמוס.",
      bodyEn:
        "You're not changing partners — you're changing how you meet each other after a long day.",
    },
    {
      titleHe: "זוגות שאוהבים לדבר",
      titleEn: "Couples who like to talk",
      bodyHe:
        "אם שיחות עמוקות הן אחד הדברים הכי טובים אצלכם — יש לכם כאן קרקע עשירה.",
      bodyEn:
        "If deep conversations are one of your best things — there's rich soil here.",
    },
    {
      titleHe: "זוגות שרוצים להעז — אבל בצורה חכמה",
      titleEn: "Couples who want to be bold — but thoughtfully",
      bodyHe:
        "הרמות מאפשרות לזוז בקצב שלכם, ולהסכים יחד על כל צעד. בלי לחץ, בלי סבבים מביכים.",
      bodyEn:
        "The levels let you move at your pace and agree on every step. No pressure, no awkward rounds.",
    },
  ];

  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <header className="mx-auto max-w-2xl text-center">
        <div className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80">
          <Heart className="h-3.5 w-3.5 text-rose-200" />
          <span>{isHe ? "למי זה מתאים" : "Who it's for"}</span>
        </div>
        <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          {isHe
            ? "בנוי לזוגות שכבר יש ביניהם אמון"
            : "Built for couples who already trust each other"}
        </h2>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {rows.map((r) => (
          <div
            key={r.titleEn}
            className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-6 backdrop-blur"
          >
            <h3 className="text-base font-semibold text-white">
              {isHe ? r.titleHe : r.titleEn}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-white/70">
              {isHe ? r.bodyHe : r.bodyEn}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Pricing deep-dive
// ─────────────────────────────────────────────────────────────────────────────

function PricingSection({
  isHe,
  hero,
  pricing,
}: {
  isHe: boolean;
  hero: Hero;
  pricing: AdultsPricing;
}) {
  const singlePerks = [
    isHe ? "גישה מלאה למשחק שבחרתם" : "Full access to the game you pick",
    isHe
      ? "לשני בני הזוג — בלי רכישה כפולה"
      : "For both partners — no double purchase",
    isHe ? "לכל החיים, בלי מינוי" : "Forever, with no subscription",
  ];
  const monthlyPerks = [
    isHe
      ? "תוכן חדש מדי שבוע — מאמרים, וידאו ותרגילי זוגיות"
      : "Weekly curated drops — articles, video, couples exercises",
    isHe
      ? "פיתוח עם צוות של פסיכולוגים, מטפלות מין ויועצי זוגיות"
      : "Developed with psychologists, sex therapists, and couples counselors",
    isHe ? "גישה מלאה לקטלוג המשחקים" : "Full access to the adults catalogue",
    isHe ? "ביטול בכל עת" : "Cancel anytime",
  ];
  const annualPerks = [
    isHe
      ? "כל מה שכלול במינוי החודשי — כל השנה"
      : "Everything in Monthly — all year long",
    isHe
      ? "בונוס: משחק אחד מהקטלוג הראשי (גלגל/סולמות) נפתח ל-30 יום"
      : "Bonus: one Games-pillar game (Wheel / Snakes) unlocked for 30 days",
    isHe
      ? "החלפת המשחק הבונוס בסוף כל תקופה"
      : "Swap the bonus game at the end of each 30-day slot",
    isHe ? "גישה מוקדמת למשחקים חדשים" : "Early access to new game releases",
  ];

  const savings = annualSavings(pricing);

  // Count enabled tiers to decide the grid layout (2 vs 3 columns).
  const enabledCount = [
    pricing.single.enabled,
    pricing.monthly.enabled,
    pricing.annual.enabled,
  ].filter(Boolean).length;

  const gridCols =
    enabledCount >= 3
      ? "lg:grid-cols-3"
      : enabledCount === 2
        ? "lg:grid-cols-2"
        : "lg:grid-cols-1";

  return (
    <section id="pricing" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-14">
      <header className="mx-auto max-w-2xl text-center">
        <div className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-100">
          <Star className="h-3.5 w-3.5" />
          <span>{isHe ? "מחיר הוגן" : "Honest pricing"}</span>
        </div>
        <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          {isHe ? "בוחרים את מה שמתאים לכם" : "Pick what fits you"}
        </h2>
        {enabledCount > 1 && (
          <p className="mx-auto mt-3 max-w-xl text-white/75">
            {isHe
              ? enabledCount >= 3
                ? "שלושה מסלולים — משחק אחד, מינוי חודשי עם תוכן חדש, או שנתי עם בונוס ממוצרי הליבה."
                : "שני מסלולים — בחרו את מה שמתאים לכם."
              : enabledCount >= 3
                ? "Three ways in — a single game, a monthly drop with fresh content, or the annual plan."
                : "Two options — pick what fits you best."}
          </p>
        )}
      </header>

      <div className={`mt-10 grid gap-6 ${gridCols}`}>
        {pricing.single.enabled ? (
          <PlanCard
            badge={isHe ? "חד־פעמי" : "One-time"}
            title={isHe ? "משחק בודד" : "Single game"}
            price={pricing.single.displayPrice}
            periodLabel=""
            subtitle={isHe ? "לשני בני הזוג, לצמיתות" : "Both partners, forever"}
            perks={singlePerks}
            ctaHref="#catalogue"
            ctaLabel={isHe ? "אל הקטלוג" : "Choose a game"}
            tone="slate"
          />
        ) : null}
        {pricing.monthly.enabled ? (
          <PlanCard
            badge={isHe ? "מינוי חודשי" : "Monthly"}
            title={isHe ? "חברות חודשית" : "Monthly membership"}
            price={pricing.monthly.displayPrice}
            periodLabel={pricing.monthly.periodLabel}
            subtitle={
              isHe
                ? "תוכן מקצועי חדש כל שבוע + קטלוג מלא"
                : "Fresh expert content weekly + full catalogue"
            }
            perks={monthlyPerks}
            ctaHref="#catalogue"
            ctaLabel={isHe ? "התחלה חודשית" : "Start monthly"}
            tone="rose"
          />
        ) : null}
        {pricing.annual.enabled ? (
          <PlanCard
            badge={isHe ? "המומלץ · הכי משתלם" : "Best value"}
            title={isHe ? "חברות שנתית" : "Annual membership"}
            price={pricing.annual.displayPrice}
            periodLabel={pricing.annual.periodLabel}
            subtitle={
              savings
                ? isHe
                  ? `חוסכים ${savings} לעומת חודשי · כולל בונוס`
                  : `Save ${savings} vs. monthly · includes bonus game`
                : isHe
                  ? "כל התוכן החודשי + בונוס ממשחקי הליבה"
                  : "Everything monthly + a bonus core-game slot"
            }
            perks={annualPerks}
            ctaHref="#catalogue"
            ctaLabel={isHe ? "אל המסלול השנתי" : "Go annual"}
            tone="gold"
            featured
          />
        ) : null}
      </div>

      {hero.buyXGetX.length > 0 ? (
        <div className="mx-auto mt-6 flex max-w-4xl flex-wrap items-center justify-center gap-2 rounded-3xl border border-amber-300/30 bg-amber-400/10 px-4 py-4 text-center text-sm text-amber-100">
          <Sparkles className="h-4 w-4" />
          <span className="font-semibold">
            {isHe ? "מבצעי חבילה פעילים:" : "Active bundles:"}
          </span>
          <span className="text-white/90">
            {hero.buyXGetX
              .map((t) =>
                isHe ? `קנה ${t.buy} קבל ${t.get}` : `Buy ${t.buy} Get ${t.get}`,
              )
              .join(" · ")}
          </span>
        </div>
      ) : null}
    </section>
  );
}

function PlanCard({
  badge,
  title,
  price,
  periodLabel,
  subtitle,
  perks,
  ctaHref,
  ctaLabel,
  tone,
  featured,
}: {
  badge: string;
  title: string;
  price: string;
  periodLabel: string;
  subtitle: string;
  perks: string[];
  ctaHref: string;
  ctaLabel: string;
  tone: "slate" | "rose" | "gold";
  featured?: boolean;
}) {
  const ring = featured
    ? "border-amber-300/50 ring-2 ring-amber-400/40"
    : tone === "rose"
      ? "border-rose-300/40"
      : "border-white/15";
  const bg =
    tone === "gold"
      ? "bg-gradient-to-br from-amber-500/25 via-rose-500/20 to-fuchsia-600/15"
      : tone === "rose"
        ? "bg-gradient-to-br from-rose-600/20 via-red-600/15 to-amber-500/10"
        : "bg-white/[0.04]";
  const cta = featured
    ? "bg-gradient-to-r from-amber-400 via-rose-500 to-fuchsia-500 text-white shadow-lg shadow-amber-500/30 hover:brightness-110"
    : tone === "rose"
      ? "bg-white/15 text-white hover:bg-white/25 border border-white/20"
      : "border border-white/25 text-white hover:bg-white/10";

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border p-8 backdrop-blur-md ${ring} ${bg}`}
    >
      {featured ? (
        <div className="absolute end-5 top-5 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-rose-500 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white shadow">
          <Crown className="h-3 w-3" />
          {badge}
        </div>
      ) : (
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">
          {badge}
        </div>
      )}

      <h3 className="mt-2 font-heading text-2xl font-bold">{title}</h3>
      <div className="mt-4 flex items-end gap-1">
        <span className="text-4xl font-extrabold tracking-tight">{price}</span>
        {periodLabel ? (
          <span className="pb-1 text-base font-medium text-white/70">
            {periodLabel}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-white/70">{subtitle}</p>

      <ul className="mt-6 space-y-2.5 text-sm">
        {perks.map((p) => (
          <li key={p} className="flex items-start gap-2 text-white/85">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            <span>{p}</span>
          </li>
        ))}
      </ul>

      <Link
        href={ctaHref}
        className={`mt-8 inline-flex min-h-[48px] w-full items-center justify-center rounded-full px-6 text-sm font-semibold transition ${cta}`}
      >
        {ctaLabel}
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. FAQ
// ─────────────────────────────────────────────────────────────────────────────

function FaqSection({ isHe }: { isHe: boolean }) {
  const rows = [
    {
      qHe: "האם זה מתאים גם אם אנחנו ביחד שנים?",
      qEn: "Does this still work after years together?",
      aHe:
        "כן — דווקא אז. זוגיות ארוכה מרוויחה מאפשרות לגלות דברים חדשים יחד, בלי להרגיש שצריך לבנות הכל מאפס.",
      aEn:
        "Yes — especially then. Long relationships thrive on small chances to discover something new together, without starting over.",
    },
    {
      qHe: "האם התוכן נראה גם לשותף/ה שלי?",
      qEn: "Does my partner see the same content?",
      aHe:
        "אחרי שתתאמו חשבון או תזמינו אחד את השני, כל מה שאחד מכם ירכוש יופיע אוטומטית גם אצל השני. הפרטיות והאינטימיות שמורות לכם בלבד.",
      aEn:
        "Once you're paired (by code or email invite), anything either of you buys shows up for the other automatically. The privacy stays between just the two of you.",
    },
    {
      qHe: "מתי נכנס תוכן חדש?",
      qEn: "How often is new content added?",
      aHe:
        "משחקים חדשים מתווספים בקביעות. מינויים מקבלים בחירה ראשונה בכל גל חדש.",
      aEn:
        "New games are added regularly. Members get first pick on every wave.",
    },
    {
      qHe: "האם אני יכול/ה לבטל מינוי?",
      qEn: "Can I cancel the membership?",
      aHe: "כמובן — בכל עת, באזור האישי. כל מה שרכשתם נשאר שלכם לתמיד.",
      aEn:
        "Absolutely — anytime, from your account. Everything you've unlocked stays yours for good.",
    },
  ];

  return (
    <section className="mx-auto max-w-4xl px-4 pb-16">
      <header className="mx-auto max-w-2xl text-center">
        <div className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-200" />
          <span>{isHe ? "שאלות נפוצות" : "Common questions"}</span>
        </div>
        <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          {isHe ? "דברים שחשוב שתדעו" : "A few things worth knowing"}
        </h2>
      </header>

      <div className="mt-8 space-y-3">
        {rows.map((r) => (
          <details
            key={r.qEn}
            className="group rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur transition hover:border-white/25"
          >
            <summary className="flex cursor-pointer items-start justify-between gap-4 text-base font-semibold text-white/95 [&::-webkit-details-marker]:hidden">
              <span>{isHe ? r.qHe : r.qEn}</span>
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm transition group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-white/75">
              {isHe ? r.aHe : r.aEn}
            </p>
          </details>
        ))}
      </div>

      <div className="mt-10 rounded-3xl border border-white/10 bg-gradient-to-br from-rose-500/15 via-red-500/10 to-amber-500/10 p-7 text-center backdrop-blur">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/85">
          <InfinityIcon className="h-3.5 w-3.5" />
          <span>{isHe ? "מוכנים?" : "Ready?"}</span>
        </div>
        <h3 className="mt-3 font-heading text-2xl font-bold">
          {isHe ? "תנו לערב שלכם התחלה חדשה" : "Give tonight a new beginning"}
        </h3>
        <Link
          href="#catalogue"
          className="mt-5 inline-flex min-h-[48px] items-center justify-center rounded-full bg-white px-7 text-sm font-semibold text-rose-700 shadow-lg transition hover:bg-rose-50"
        >
          {isHe ? "אל הקטלוג" : "Browse the catalogue"}
        </Link>
      </div>
    </section>
  );
}
