/**
 * Marketing sections for /[locale]/adults - Mioshy's flagship "after-dark"
 * product surface.
 *
 * VISUAL DIRECTION
 * ────────────────
 * This page is intentionally NOT a clone of /games or /journey:
 *   - dark all the way through (no cream wrapper)
 *   - cinematic typography (huge serif headlines, italic accent words)
 *   - editorial blockquotes instead of card grids
 *   - hard-proof stats as gigantic numbers
 *   - tone is bold, sensual, after-dark - not "magazine pastel"
 *
 * Tone: bold, erotic, sexual, dark - but never crude. The copy keeps
 * a confident, expert-curated voice (we sell taste, not shock).
 *
 * Each section is exported individually so the page can compose them in
 * the desired order around the dynamic catalogue grid.
 */

import {
  ArrowRight,
  Check,
  Crown,
  Sparkles,
  Star,
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

// ─────────────────────────────────────────────────────────────────────────────
// 1. MANIFESTO — what these games actually are. Editorial single-column block.
// ─────────────-───────────────────────────────────────────────────────────────

export function AdultsManifestoSection({ isHe }: { isHe: boolean }) {
  return (
    <section
      id="manifesto"
      className="relative overflow-hidden px-4 py-12 sm:py-[90px]"
    >
      <div className="relative mx-auto max-w-3xl">
        {/* Eyebrow — bumped to 13px on mobile (was 11px, unreadable). */}
        <div className="text-center">
          <span className="inline-flex items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[0.22em] text-[#8B2638] sm:text-[11px] sm:tracking-[0.32em]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#B83C4D] shadow-[0_0_8px_rgba(184,60,77,0.3)]" />
            {isHe ? "מה זה באמת" : "What this really is"}
          </span>
        </div>

        {/* Headline — capped at 30px on mobile so the long Hebrew
            italic doesn't break each word onto its own line. */}
        <h2
          className="mt-4 text-balance text-center text-[30px] leading-[1.1] tracking-[-0.02em] text-[#170E14] sm:mt-7 sm:text-5xl sm:leading-[1.05] lg:text-[56px]"
          style={{ fontFamily: "'Frank Ruhl Libre', serif", fontWeight: 600 }}
        >
          {isHe ? (
            <>
              לא עוד משחק.{" "}
              <span
                className="text-[#B83C4D]"
                style={{ fontStyle: "italic", fontWeight: 500 }}
              >
                ערב שלא רוצים שייגמר.
              </span>
            </>
          ) : (
            <>
              Not another game.{" "}
              <span
                className="text-[#B83C4D]"
                style={{ fontStyle: "italic", fontWeight: 500 }}
              >
                An evening you won&apos;t want to end.
              </span>
            </>
          )}
        </h2>

        {/* Body — three editorial paragraphs with vertical accent rule.
            Mobile: tighter top margin + tighter inter-paragraph margins
            so the manifesto reads as one block, not three loose ones. */}
        <div className="relative mt-6 ps-6 sm:mt-12 sm:ps-10">
          <span
            aria-hidden
            className="absolute inset-y-2 start-0 w-px bg-gradient-to-b from-[#B83C4D]/0 via-[#B83C4D]/50 to-[#B83C4D]/0"
          />

          <p className="text-[20px] leading-[1.55] text-[#170E14] sm:text-[20px] sm:leading-[1.7] md:text-[22px]">
            {isHe
              ? "המומחים של מיאושי בנו עבורכם משחקי מיניות בשלבים — כל שלב הוא פעולה מינית מסוימת שאתם מבצעים יחד. חלק מהמשחקים משלבים צעצועי מין. חלק לא. ההחלטה איתכם."
              : "Mioshy's experts have built you sexual games in stages — each stage is a specific sexual act you perform together. Some games incorporate sex toys. Some don't. The choice is yours."}
          </p>

          <p className="mt-4 text-[18px] leading-[1.6] text-[#4A3A45] sm:mt-7 sm:text-[18px] sm:leading-[1.75] md:text-[19px]">
            {isHe
              ? "כולם מכוונים למטרה אחת — חוויה מינית בלתי-נשכחת. המשחקים מיניים. אירוטיים. מעוררים. ובנויים בכוונה כך, שלא תרצו להפסיק לשחק."
              : "All of them point to one goal — an unforgettable sexual experience. The games are sexual. Erotic. Arousing. And built — on purpose — so you won't want to stop playing."}
          </p>

          <p
            className="mt-4 text-[20px] leading-[1.55] text-[#8B2638] sm:mt-7 sm:text-[18px] sm:leading-[1.7]"
            style={{ fontFamily: "'Frank Ruhl Libre', serif", fontStyle: "italic" }}
          >
            {isHe
              ? "— זה לא משחק שמשחקים פעם וזורקים. זה לילה שחוזרים עליו."
              : "— this isn't a game you play once and discard. It's a night you come back to."}
          </p>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. PROOF — gigantic stats. Single most credibility-loaded section on page.
// ─────────-───────────────────────────────────────────────────────────────────

export function AdultsProofSection({ isHe }: { isHe: boolean }) {
  return (
    <section
      id="proof"
      className="relative overflow-hidden px-4 py-10 sm:py-[80px]"
    >
      {/* Top hairline divider */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#B83C4D]/25 to-transparent"
      />

      <div className="relative mx-auto max-w-5xl">
        {/* Eyebrow — bumped to 13px on mobile. */}
        <div className="text-center">
          <span className="inline-flex items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[0.22em] text-[#8B2638] sm:text-[11px] sm:tracking-[0.32em]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#B83C4D] shadow-[0_0_8px_rgba(184,60,77,0.3)]" />
            {isHe ? "המספרים מדברים" : "The numbers speak"}
          </span>
        </div>

        <h2
          className="mt-3 text-balance text-center text-[28px] leading-[1.15] tracking-[-0.02em] text-[#170E14] sm:mt-6 sm:text-[36px] sm:leading-[1.1] md:text-[44px]"
          style={{ fontFamily: "'Frank Ruhl Libre', serif", fontWeight: 600 }}
        >
          {isHe ? "אחרי משחק אחד — " : "After the first game — "}
          <span
            className="text-[#B83C4D]"
            style={{ fontStyle: "italic", fontWeight: 500 }}
          >
            {isHe ? "רוצים עוד." : "they want more."}
          </span>
        </h2>

        {/* Two stat cards — tighter top margin on mobile so the
            "headline → cards" stack feels like one breath. */}
        <div className="mt-6 grid gap-4 sm:mt-14 sm:gap-6 sm:grid-cols-2">
          {/* Stat 1 — 80% */}
          <div className="rounded-3xl border border-[#EAE0E3] bg-[#FBF5F2] px-10 py-12 text-center shadow-sm">
            <span
              className="block text-[100px] leading-none tracking-[-0.03em] text-[#170E14]"
              style={{ fontFamily: "'Frank Ruhl Libre', serif", fontWeight: 700 }}
            >
              80<span className="text-[0.5em] text-[#B83C4D]">%</span>
            </span>
            <div className="mx-auto mt-4 h-px w-20 bg-[#B83C4D]/30" />
            <p
              className="mx-auto mt-6 max-w-xs text-[20px] leading-[1.5] text-[#4A3A45] sm:text-[17px] sm:leading-[1.55]"
              style={{ fontFamily: "'Frank Ruhl Libre', serif", fontWeight: 500 }}
            >
              {isHe
                ? "מהזוגות שרכשו משחק אחד, חזרו לרכוש משחק שני."
                : "of couples who bought one game came back for a second."}
            </p>
          </div>

          {/* Stat 2 — 50% */}
          <div className="rounded-3xl border border-[#EAE0E3] bg-[#FBF5F2] px-10 py-12 text-center shadow-sm">
            <span
              className="block text-[100px] leading-none tracking-[-0.03em] text-[#170E14]"
              style={{ fontFamily: "'Frank Ruhl Libre', serif", fontWeight: 700 }}
            >
              50<span className="text-[0.5em] text-[#B83C4D]">%</span>
            </span>
            <div className="mx-auto mt-4 h-px w-20 bg-[#B83C4D]/30" />
            <p
              className="mx-auto mt-6 max-w-xs text-[20px] leading-[1.5] text-[#4A3A45] sm:text-[17px] sm:leading-[1.55]"
              style={{ fontFamily: "'Frank Ruhl Libre', serif", fontWeight: 500 }}
            >
              {isHe
                ? "מהלקוחות הקיימים רכשו את כל הקטלוג."
                : "of returning customers ended up owning the whole catalogue."}
            </p>
          </div>
        </div>

        {/* Closing note */}
        <p
          className="mx-auto mt-10 max-w-xl text-center text-[20px] leading-[1.5] text-[#8B2638]/85 sm:text-[15px] sm:leading-normal sm:text-[#8B2638]/70"
          style={{ fontFamily: "'Frank Ruhl Libre', serif", fontStyle: "italic" }}
        >
          {isHe
            ? "— הסטטיסטיקות הן מהזוגות שלנו. לא ממכירות, לא מתסקירים."
            : "— numbers are from our couples. Not from sales decks, not from reviews."}
        </p>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// (removed) "INSIDE EACH GAME — three intensity levels" — section pulled per
// product decision; no replacement.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// 4. PRICING — dark plan cards, in keeping with the after-dark mood.
// ───────────-─────────────────────────────────────────────────────────────────

export function AdultsPricingSection({
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
    isHe ? "שלוש רמות עוצמה בתוך אותו משחק" : "All three intensity levels included",
    isHe ? "נשאר שלכם לצמיתות" : "Yours forever — no subscription",
  ];
  const monthlyPerks = [
    isHe ? "שני בני הזוג תחת מינוי אחד" : "Both partners on one plan",
    isHe ? "כל אחד פותח משחק בחודש — שניים ביחד" : "Each unlocks one game / month — two together",
    isHe ? "השותף/ה מצטרף/ת אוטומטית במייל הזמנה" : "Partner joins automatically by email invite",
    isHe ? "גישה לכל הקטלוג" : "Full catalogue access",
    isHe ? "ביטול בכל עת" : "Cancel anytime",
  ];
  const annualPerks = [
    isHe ? "כל מה שכלול במינוי הזוגי — כל השנה" : "Everything in the couple plan — all year",
    isHe ? "24 משחקים לשניכם בשנה" : "24 games together per year",
    isHe ? "בונוס: משחק מהקטלוג הראשי ל-30 יום" : "Bonus: one core-catalogue game for 30 days",
    isHe ? "גישה מוקדמת למשחקים חדשים" : "Early access to new releases",
  ];

  const savings = annualSavings(pricing);

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
    <section id="pricing" className="relative px-4 py-[110px] scroll-mt-24">
      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.32em] text-rose-200/80">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.7)]" />
            {isHe ? "מחיר ישיר" : "Honest pricing"}
          </span>
          <h2
            className="mt-7 text-[36px] leading-[1.05] tracking-[-0.02em] text-white sm:text-[44px] lg:text-[52px]"
            style={{ fontFamily: "'Frank Ruhl Libre', serif", fontWeight: 600 }}
          >
            {isHe ? "בוחרים את מה שמתאים." : "Pick what fits."}
          </h2>
          {enabledCount > 1 && (
            <p className="mx-auto mt-5 max-w-xl text-[17px] leading-[1.6] text-white/65">
              {isHe
                ? "רכישה אישית לערב אחד, מינוי זוגי חודשי, או מינוי שנתי עם בונוס. בלי מלכודות, בלי חוזה."
                : "One-time for one night, a monthly couple plan, or annual with a bonus. No traps, no contract."}
            </p>
          )}
        </div>

        <div className={`mt-14 grid gap-6 ${gridCols}`}>
          {pricing.single.enabled ? (
            <DarkPlanCard
              badge={isHe ? "חד־פעמי" : "One-time"}
              title={isHe ? "משחק אחד" : "Single game"}
              price={pricing.single.displayPrice}
              periodLabel=""
              subtitle={isHe ? "לכם אישית, לצמיתות" : "Yours personally, forever"}
              perks={singlePerks}
              ctaHref="#catalogue"
              ctaLabel={isHe ? "אל הקטלוג" : "Choose a game"}
              tone="ghost"
            />
          ) : null}
          {pricing.monthly.enabled ? (
            <DarkPlanCard
              badge={isHe ? "מינוי זוגי" : "Couple plan"}
              title={isHe ? "חברות זוגית" : "Couple membership"}
              price={pricing.monthly.displayPrice}
              periodLabel={pricing.monthly.periodLabel}
              subtitle={
                isHe
                  ? "כל אחד פותח משחק בחודש — שניים ביחד"
                  : "Each unlocks one a month — two together"
              }
              perks={monthlyPerks}
              ctaHref="#catalogue"
              ctaLabel={isHe ? "הצטרפות זוגית" : "Join as a couple"}
              tone="rose"
            />
          ) : null}
          {pricing.annual.enabled ? (
            <DarkPlanCard
              badge={isHe ? "המומלץ · הכי משתלם" : "Best value"}
              title={isHe ? "חברות זוגית שנתית" : "Annual couple plan"}
              price={pricing.annual.displayPrice}
              periodLabel={pricing.annual.periodLabel}
              subtitle={
                savings
                  ? isHe
                    ? `חוסכים ${savings} לעומת חודשי · כולל בונוס`
                    : `Save ${savings} vs. monthly · bonus included`
                  : isHe
                    ? "כל ההטבות + בונוס ממשחקי הליבה"
                    : "All benefits + a bonus core-catalogue slot"
              }
              perks={annualPerks}
              ctaHref="#catalogue"
              ctaLabel={isHe ? "הצטרפות שנתית" : "Join annually"}
              tone="featured"
              featured
            />
          ) : null}
        </div>

        {hero.buyXGetX.length > 0 ? (
          <div className="mx-auto mt-8 flex max-w-4xl flex-wrap items-center justify-center gap-2 rounded-3xl border border-amber-300/30 bg-amber-400/[0.06] px-5 py-4 text-center text-sm text-amber-100 backdrop-blur">
            <Sparkles className="h-4 w-4" />
            <span className="font-semibold">
              {isHe ? "מבצעי חבילה פעילים:" : "Active bundles:"}
            </span>
            <span className="text-white/85">
              {hero.buyXGetX
                .map((t) =>
                  isHe ? `קנה ${t.buy} קבל ${t.get}` : `Buy ${t.buy} Get ${t.get}`,
                )
                .join(" · ")}
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DarkPlanCard({
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
  tone: "ghost" | "rose" | "featured";
  featured?: boolean;
}) {
  const ring = featured
    ? "border-rose-300/50 ring-2 ring-rose-400/30"
    : tone === "rose"
      ? "border-rose-300/30"
      : "border-white/12";
  const bg = featured
    ? "bg-gradient-to-br from-rose-600/22 via-fuchsia-600/14 to-amber-500/10"
    : tone === "rose"
      ? "bg-gradient-to-br from-rose-600/14 via-fuchsia-600/8 to-violet-700/8"
      : "bg-white/[0.035]";
  const cta = featured
    ? "text-white shadow-2xl shadow-rose-600/30"
    : tone === "rose"
      ? "border border-rose-300/40 text-white hover:bg-rose-400/15"
      : "border border-white/20 text-white/90 hover:bg-white/10 hover:text-white";

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border p-8 backdrop-blur-md transition hover:-translate-y-1 ${ring} ${bg}`}
    >
      {featured ? (
        <div className="absolute end-5 top-5 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-rose-500 to-fuchsia-500 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white shadow">
          <Crown className="h-3 w-3" />
          {badge}
        </div>
      ) : (
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">
          {badge}
        </div>
      )}

      <h3
        className="mt-2 text-2xl tracking-tight text-white"
        style={{ fontFamily: "'Frank Ruhl Libre', serif", fontWeight: 600 }}
      >
        {title}
      </h3>
      <div className="mt-4 flex items-end gap-1">
        <span className="text-4xl font-extrabold tracking-tight text-white">
          {price}
        </span>
        {periodLabel ? (
          <span className="pb-1 text-base font-medium text-white/55">
            {periodLabel}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-white/65">{subtitle}</p>

      <ul className="mt-6 space-y-2.5 text-sm">
        {perks.map((p) => (
          <li key={p} className="flex items-start gap-2 text-white/80">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
            <span>{p}</span>
          </li>
        ))}
      </ul>

      <Link
        href={ctaHref}
        className={`relative mt-8 inline-flex min-h-[48px] w-full items-center justify-center overflow-hidden rounded-full px-6 text-sm font-semibold transition ${cta}`}
      >
        {featured ? (
          <span
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(110deg,#f43f5e_0%,#ec4899_45%,#a855f7_100%)] bg-[length:220%_100%] mio-adults-cta-shift"
          />
        ) : null}
        <span className="relative z-10 inline-flex items-center gap-2">
          {ctaLabel}
          <ArrowRight className="h-4 w-4" />
        </span>
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. FAQ — single-column dark accordion. Distinct from /games + /journey
//    (whi-h use the homepage two-column V2 FAQ). Keeps the page identity.
// ─────────────────────────────────────────────────────────────────────────────

export function AdultsFaqSection({ isHe }: { isHe: boolean }) {
  // First and last items removed per design review.
  const items = [
    {
      qHe: "צריך לקנות צעצועי מין?",
      qEn: "Do I need to buy sex toys?",
      aHe:
        "תלוי במשחק. חלק מהמשחקים משלבים צעצועים — וזה מצוין למפורט בעמוד המשחק. חלק לא דורשים שום ציוד. אתם בוחרים.",
      aEn:
        "Depends on the game. Some games incorporate toys — clearly listed on each game's page. Others require no equipment at all. You choose.",
    },
    {
      qHe: "איך השותף/ה שלי מצטרף/ת?",
      qEn: "How does my partner join?",
      aHe:
        "במינוי זוגי אתם מזינים את כתובת המייל שלהם. הם מקבלים מייל הזמנה ומצטרפים בלחיצה. כל משחק שאחד מכם פותח נגיש לשניכם.",
      aEn:
        "On a couple plan, you enter their email. They get an invite and join with one click. Every game either of you unlocks is accessible to both of you.",
    },
    {
      qHe: "זה דיסקרטי?",
      qEn: "Is this discreet?",
      aHe:
        "לחלוטין. החיוב מופיע תחת Mioshy בלבד — בלי מילים אחרות, בלי שמות משחקים. כל הנתונים מוצפנים, אנחנו לא מוכרים מידע, ואין פרסומות.",
      aEn:
        "Completely. Billing shows only as Mioshy — no other words, no game titles. All data is encrypted, we don't sell information, and there are no ads.",
    },
    {
      qHe: "מה אם אחד מאיתנו לא מוכן/ה?",
      qEn: "What if one of us isn't ready?",
      aHe:
        "אז מתחילים ברמה הראשונה — שיחה ושאלות, בלי שום לחץ. רוב הזוגות שמתחילים שם מגלים שהשני נפתח באופן טבעי.",
      aEn:
        "Then start at level one — talk and questions, no pressure. Most couples who start there find the other opens up naturally.",
    },
  ];

  return (
    <section id="faq" className="relative px-4 py-[80px]">
      {/* Top hairline */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#B83C4D]/20 to-transparent"
      />
      <div className="relative mx-auto max-w-3xl">
        <div className="text-center">
          <span className="inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#8B2638]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#B83C4D] shadow-[0_0_8px_rgba(184,60,77,0.3)]" />
            {isHe ? "שאלות נפוצות" : "FAQ"}
          </span>
          <h2
            className="mt-7 text-[36px] leading-[1.05] tracking-[-0.02em] text-[#170E14] sm:text-[44px]"
            style={{ fontFamily: "'Frank Ruhl Libre', serif", fontWeight: 600 }}
          >
            {isHe ? (
              <>
                שאלות שזוגות שואלים{" "}
                <span
                  className="text-[#B83C4D]"
                  style={{ fontStyle: "italic", fontWeight: 500 }}
                >
                  לפני הרכישה.
                </span>
              </>
            ) : (
              <>
                Questions couples ask{" "}
                <span
                  className="text-[#B83C4D]"
                  style={{ fontStyle: "italic", fontWeight: 500 }}
                >
                  before they buy.
                </span>
              </>
            )}
          </h2>
        </div>

        <ul className="mt-12 space-y-2">
          {items.map((it, i) => (
            <li key={i}>
              <details className="group border-b border-[#EAE0E3] transition hover:border-[#B83C4D]/30">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-6 text-[18px] font-semibold text-[#170E14] transition group-open:text-[#B83C4D] [&::-webkit-details-marker]:hidden">
                  <span className="text-start">{isHe ? it.qHe : it.qEn}</span>
                  <span
                    aria-hidden
                    className="mt-0.5 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-[#EAE0E3] bg-white text-[#8B2638]/60 transition group-open:rotate-45 group-open:border-[#B83C4D]/30 group-open:bg-[#FBE9EC] group-open:text-[#B83C4D]"
                  >
                    +
                  </span>
                </summary>
                <p className="pb-6 text-[16px] leading-[1.7] text-[#4A3A45]">
                  {isHe ? it.aHe : it.aEn}
                </p>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. CLOSING — single dramatic statement + CTA. The page's last word.
// ───────────-─────────────────────────────────────────────────────────────────

export function AdultsClosingCta({ isHe }: { isHe: boolean }) {
  return (
    <section className="relative overflow-hidden px-4 py-[120px]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0"
        style={{
          background:
            "radial-gradient(1100px 600px at 50% 50%, rgba(244,63,94,0.18), transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-400/30 to-transparent"
      />

      <div className="relative mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.32em] text-rose-200/80">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.7)]" />
          {isHe ? "מוכנים?" : "Ready?"}
        </span>
        <h2
          className="mt-7 text-balance text-[44px] leading-[1.02] tracking-[-0.02em] text-white sm:text-[56px] lg:text-[72px]"
          style={{ fontFamily: "'Frank Ruhl Libre', serif", fontWeight: 600 }}
        >
          {isHe ? (
            <>
              לילה אחד.{" "}
              <span
                className="block bg-gradient-to-br from-rose-200 via-rose-400 to-amber-300 bg-clip-text text-transparent"
                style={{ fontStyle: "italic", fontWeight: 500 }}
              >
                כל מה שצריך כדי לדעת.
              </span>
            </>
          ) : (
            <>
              One night.{" "}
              <span
                className="block bg-gradient-to-br from-rose-200 via-rose-400 to-amber-300 bg-clip-text text-transparent"
                style={{ fontStyle: "italic", fontWeight: 500 }}
              >
                That&apos;s all it takes to know.
              </span>
            </>
          )}
        </h2>

        <Link
          href="#catalogue"
          className="group relative mt-12 inline-flex min-h-[60px] items-center justify-center overflow-hidden rounded-full px-12 text-base font-semibold text-white shadow-2xl shadow-rose-600/35 transition hover:brightness-110"
        >
          <span
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(110deg,#f43f5e_0%,#ec4899_45%,#a855f7_100%)] bg-[length:220%_100%] mio-adults-cta-shift"
          />
          <span className="relative z-10 inline-flex items-center gap-2">
            <Star className="h-4 w-4" />
            {isHe ? "אל הקטלוג" : "Enter the catalogue"}
            <ArrowRight
              className={`h-5 w-5 transition group-hover:translate-x-1 ${
                isHe ? "rotate-180 group-hover:-translate-x-1" : ""
              }`}
            />
          </span>
        </Link>

        <p
          className="mt-6 text-[18px] text-white/70 sm:text-[14px] sm:text-white/45"
          style={{ fontFamily: "'Frank Ruhl Libre', serif", fontStyle: "italic" }}
        >
          {isHe
            ? "ללא חוזה · ביטול בכל עת · החיוב מופיע כ-Mioshy בלבד"
            : "No contract · cancel anytime · billed only as Mioshy"}
        </p>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes mio-adults-cta-shift {
              0%, 100% { background-position: 0% 50%; }
              50%      { background-position: 100% 50%; }
            }
            .mio-adults-cta-shift { animation: mio-adults-cta-shift 7s ease-in-out infinite; }
          `,
        }}
      />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Catalogue intro — small editorial heading rendered just above the storefront.
// Kept as its own -xport so the page can still position the storefront where
// it wants.
// ─────────────────────────────────────────────────────────────────────────────

export function AdultsCatalogueIntro({ isHe }: { isHe: boolean }) {
  return (
    <div id="catalogue-intro" className="relative px-4 pb-2 pt-[32px] sm:pt-[80px]">
      {/* Top hairline */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#B83C4D]/20 to-transparent"
      />
      <div className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#8B2638]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#B83C4D] shadow-[0_0_8px_rgba(184,60,77,0.3)]" />
          {isHe ? "הקטלוג" : "The catalogue"}
        </span>
        <h2
          className="mt-7 text-[36px] leading-[1.05] tracking-[-0.02em] text-[#170E14] sm:text-[44px] lg:text-[52px]"
          style={{ fontFamily: "'Frank Ruhl Libre', serif", fontWeight: 600 }}
        >
          {isHe ? (
            <>
              בחרו את המשחק{" "}
              <span
                className="text-[#B83C4D]"
                style={{ fontStyle: "italic", fontWeight: 500 }}
              >
                שמתחיל את הערב.
              </span>
            </>
          ) : (
            <>
              Pick the game{" "}
              <span
                className="text-[#B83C4D]"
                style={{ fontStyle: "italic", fontWeight: 500 }}
              >
                that opens the evening.
              </span>
            </>
          )}
        </h2>
      </div>
    </div>
  );
}

// Backward-compat — still exported, but nobody on the new page uses it.
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
    <>
      <AdultsManifestoSection isHe={isHe} />
      <AdultsProofSection isHe={isHe} />
      <AdultsPricingSection isHe={isHe} hero={hero} pricing={pricing} />
      <AdultsFaqSection isHe={isHe} />
      <AdultsClosingCta isHe={isHe} />
    </>
  );
}
