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
} from "@/components/icons/Icons";
import { Link } from "@/navigation";
import type { AdultsPricing } from "@/lib/adults/pricing";
import { annualSavings } from "@/lib/adults/pricing";
import { CmsText } from "@/components/cms/CmsText";

type Hero = {
  singlePrice: string;
  subPrice: string;
  singleEnabled: boolean;
  subEnabled: boolean;
  buyXGetX: { buy: number; get: number }[];
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. MANIFESTO - what these games actually are. Editorial single-column block.
// ─────────────-───────────────────────────────────────────────────────────────

// `isHe` is destructured but no longer referenced in the body — every
// HE/EN string now goes through <CmsText>. We rename to `_isHe` so the
// destructure stays compatible with the caller's `<AdultsManifestoSection
// isHe={isHe} />` signature while ESLint's no-unused-vars treats the
// underscore-prefixed binding as intentional.
export function AdultsManifestoSection({ isHe: _isHe }: { isHe: boolean }) {
  return (
    <section
      id="manifesto"
      className="relative overflow-hidden px-4 py-12 sm:py-[90px]"
    >
      <div className="relative mx-auto max-w-3xl">
        {/* Eyebrow - bumped to 13px on mobile (was 11px, unreadable). */}
        <div className="text-center">
          <span className="inline-flex items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[0.22em] text-[#8B2638] sm:text-[11px] sm:tracking-[0.32em]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#B83C4D] shadow-[0_0_8px_rgba(184,60,77,0.3)]" />
            <CmsText cmsKey="mioshySexPage.manifestoKicker" />
          </span>
        </div>

        {/* Headline - capped at 30px on mobile so the long Hebrew
            italic doesn't break each word onto its own line. Two CMS
            keys (prefix + italic emphasis) so admins can re-balance
            each half independently. */}
        <h2
          className="mt-4 text-balance text-center text-[30px] leading-[1.1] tracking-[-0.02em] text-[#170E14] sm:mt-7 sm:text-5xl sm:leading-[1.05] lg:text-[56px]"
          style={{ fontFamily: "'Frank Ruhl Libre', serif", fontWeight: 600 }}
        >
          <CmsText cmsKey="mioshySexPage.manifestoHeadlinePrefix" />{" "}
          <span
            className="text-[#F43F5E]"
            style={{ fontStyle: "italic", fontWeight: 500 }}
          >
            <CmsText cmsKey="mioshySexPage.manifestoHeadlineEmphasis" />
          </span>
        </h2>

        {/* Body - three editorial paragraphs with vertical accent rule.
            Mobile: tighter top margin + tighter inter-paragraph margins
            so the manifesto reads as one block, not three loose ones. */}
        <div className="relative mt-6 ps-6 sm:mt-12 sm:ps-10">
          <span
            aria-hidden
            className="absolute inset-y-2 start-0 w-px bg-gradient-to-b from-[#B83C4D]/0 via-[#B83C4D]/50 to-[#B83C4D]/0"
          />

          <CmsText
            cmsKey="mioshySexPage.manifestoBody1"
            as="p"
            className="text-[20px] leading-[1.55] text-[#170E14] sm:text-[20px] sm:leading-[1.7] md:text-[22px]"
          />

          {/* Per Itzik 2026-05-07: bumped from 18-19px to 20px for
              parity with the lead paragraph above — the two should
              read as one continuous voice, not a stepdown. */}
          <CmsText
            cmsKey="mioshySexPage.manifestoBody2"
            as="p"
            className="mt-4 text-[20px] leading-[1.6] text-[#4A3A45] sm:mt-7 sm:text-[20px] sm:leading-[1.7]"
          />

          <CmsText
            cmsKey="mioshySexPage.manifestoBody3"
            as="p"
            className="mt-4 text-[20px] leading-[1.55] text-[#8B2638] sm:mt-7 sm:text-[18px] sm:leading-[1.7]"
            style={{ fontFamily: "'Frank Ruhl Libre', serif", fontStyle: "italic" }}
          />
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. PROOF - gigantic stats. Single most credibility-loaded section on page.
// ─────────-───────────────────────────────────────────────────────────────────

export function AdultsProofSection({ isHe: _isHe }: { isHe: boolean }) {
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
        {/* Eyebrow - bumped to 13px on mobile. */}
        <div className="text-center">
          <span className="inline-flex items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[0.22em] text-[#8B2638] sm:text-[11px] sm:tracking-[0.32em]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#B83C4D] shadow-[0_0_8px_rgba(184,60,77,0.3)]" />
            <CmsText cmsKey="mioshySexPage.proofKicker" />
          </span>
        </div>

        <h2
          className="mt-3 text-balance text-center text-[28px] leading-[1.15] tracking-[-0.02em] text-[#170E14] sm:mt-6 sm:text-[36px] sm:leading-[1.1] md:text-[44px]"
          style={{ fontFamily: "'Frank Ruhl Libre', serif", fontWeight: 600 }}
        >
          <CmsText cmsKey="mioshySexPage.proofHeadlinePrefix" />
          <span
            className="text-[#B83C4D]"
            style={{ fontStyle: "italic", fontWeight: 500 }}
          >
            <CmsText cmsKey="mioshySexPage.proofHeadlineEmphasis" />
          </span>
        </h2>

        {/* Two stat cards - tighter top margin on mobile so the
            "headline → cards" stack feels like one breath. */}
        <div className="mt-6 grid gap-4 sm:mt-14 sm:gap-6 sm:grid-cols-2">
          {/* Stat 1 - 80% */}
          <div className="rounded-3xl border border-[#EAE0E3] bg-[#FBF5F2] px-10 py-12 text-center shadow-sm">
            <span
              className="block text-[100px] leading-none tracking-[-0.03em] text-[#170E14]"
              style={{ fontFamily: "'Frank Ruhl Libre', serif", fontWeight: 700 }}
            >
              80<span className="text-[0.5em] text-[#B83C4D]">%</span>
            </span>
            <div className="mx-auto mt-4 h-px w-20 bg-[#B83C4D]/30" />
            <CmsText
              cmsKey="mioshySexPage.proofStat1Caption"
              as="p"
              className="mx-auto mt-6 max-w-sm text-[20px] leading-[1.55] text-[#4A3A45] sm:text-[20px] sm:leading-[1.6]"
              style={{ fontFamily: "'Frank Ruhl Libre', serif", fontWeight: 500 }}
            />
          </div>

          {/* Stat 2 - 50% */}
          <div className="rounded-3xl border border-[#EAE0E3] bg-[#FBF5F2] px-10 py-12 text-center shadow-sm">
            <span
              className="block text-[100px] leading-none tracking-[-0.03em] text-[#170E14]"
              style={{ fontFamily: "'Frank Ruhl Libre', serif", fontWeight: 700 }}
            >
              50<span className="text-[0.5em] text-[#B83C4D]">%</span>
            </span>
            <div className="mx-auto mt-4 h-px w-20 bg-[#B83C4D]/30" />
            {/* Per Itzik 2026-05-07: clearer phrasing in HE — admins
                edit copy in CMS now; the previous draft had "רכשו את
                כל הקטלוג" before being tightened to "המוצרים שלנו".
                Bumped to 20px on both mobile and desktop. */}
            <CmsText
              cmsKey="mioshySexPage.proofStat2Caption"
              as="p"
              className="mx-auto mt-6 max-w-sm text-[20px] leading-[1.55] text-[#4A3A45] sm:text-[20px] sm:leading-[1.6]"
              style={{ fontFamily: "'Frank Ruhl Libre', serif", fontWeight: 500 }}
            />
          </div>
        </div>

        {/* "Numbers are from our couples..." disclaimer removed
            per Itzik 2026-05-07 — was over-explaining and softening
            the proof. The stats stand on their own. */}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// (removed) "INSIDE EACH GAME - three intensity levels" - section pulled per
// product decision; no replacement.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// 4. PRICING - dark plan cards, in keeping with the after-dark mood.
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
    isHe ? "נשאר שלכם לצמיתות" : "Yours forever - no subscription",
  ];
  const monthlyPerks = [
    isHe ? "שני בני הזוג תחת מינוי אחד" : "Both partners on one plan",
    isHe ? "כל אחד פותח משחק בחודש - שניים ביחד" : "Each unlocks one game / month - two together",
    isHe ? "השותף/ה מצטרף/ת אוטומטית במייל הזמנה" : "Partner joins automatically by email invite",
    isHe ? "גישה לכל הקטלוג" : "Full catalogue access",
    isHe ? "ביטול בכל עת" : "Cancel anytime",
  ];
  const annualPerks = [
    isHe ? "כל מה שכלול במינוי הזוגי - כל השנה" : "Everything in the couple plan - all year",
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
      <div className="relative mx-auto max-w-7xl">
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
                  ? "כל אחד פותח משחק בחודש - שניים ביחד"
                  : "Each unlocks one a month - two together"
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
// 5. FAQ - single-column dark accordion. Distinct from /games + /journey
//    (whi-h use the homepage two-column V2 FAQ). Keeps the page identity.
// ─────────────────────────────────────────────────────────────────────────────

export function AdultsFaqSection({ isHe: _isHe }: { isHe: boolean }) {
  // FAQ rewritten per Itzik 2026-05-07: 5 anchor questions every couple
  // asks before/after buying — why it's worth it, when to play, what
  // they actually get, refund policy, partner access. Two product
  // questions (toys, "what if one isn't ready") kept as the trailing
  // items because they come up after the value/access concerns.
  //
  // Each entry holds the CMS keys for the question + answer. The actual
  // copy lives in mioshySexPage.faqQ{1-8} / faqA{1-8} in messages/he.json
  // and en.json, and (eventually) in cms_texts rows so admins can edit
  // without a deploy.
  // faqQ1/faqA1 ("למה זה טוב? איך זה שונה מטיפים שאני יכול למצוא ברשת?")
  // removed from the rendered list per Itzik 2026-05-21 — the value-vs-tips
  // framing reads too defensive and the surrounding answers already cover
  // what couples get. JSON keys are kept in messages/{he,en}.json so the
  // question can be restored from the array without re-translating.
  const items = [
    { qKey: "mioshySexPage.faqQ2", aKey: "mioshySexPage.faqA2" },
    { qKey: "mioshySexPage.faqQ3", aKey: "mioshySexPage.faqA3" },
    { qKey: "mioshySexPage.faqQ4", aKey: "mioshySexPage.faqA4" },
    { qKey: "mioshySexPage.faqQ5", aKey: "mioshySexPage.faqA5" },
    { qKey: "mioshySexPage.faqQ6", aKey: "mioshySexPage.faqA6" },
    { qKey: "mioshySexPage.faqQ7", aKey: "mioshySexPage.faqA7" },
    { qKey: "mioshySexPage.faqQ8", aKey: "mioshySexPage.faqA8" },
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
            <CmsText cmsKey="mioshySexPage.faqKicker" />
          </span>
          <h2
            className="mt-7 text-[36px] leading-[1.05] tracking-[-0.02em] text-[#170E14] sm:text-[44px]"
            style={{ fontFamily: "'Frank Ruhl Libre', serif", fontWeight: 600 }}
          >
            <CmsText cmsKey="mioshySexPage.faqHeadlinePrefix" />{" "}
            <span
              className="text-[#B83C4D]"
              style={{ fontStyle: "italic", fontWeight: 500 }}
            >
              <CmsText cmsKey="mioshySexPage.faqHeadlineEmphasis" />
            </span>
          </h2>
        </div>

        <ul className="mt-12 space-y-2">
          {items.map((it) => (
            <li key={it.qKey}>
              <details className="group border-b border-[#EAE0E3] transition hover:border-[#B83C4D]/30">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-6 text-[18px] font-semibold text-[#170E14] transition group-open:text-[#B83C4D] [&::-webkit-details-marker]:hidden">
                  <CmsText cmsKey={it.qKey} className="text-start" />
                  <span
                    aria-hidden
                    className="mt-0.5 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-[#EAE0E3] bg-white text-[#8B2638]/60 transition group-open:rotate-45 group-open:border-[#B83C4D]/30 group-open:bg-[#FBE9EC] group-open:text-[#B83C4D]"
                  >
                    +
                  </span>
                </summary>
                <CmsText
                  cmsKey={it.aKey}
                  as="p"
                  className="pb-6 text-[16px] leading-[1.7] text-[#4A3A45]"
                />
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. CLOSING - single dramatic statement + CTA. The page's last word.
// ───────────-─────────────────────────────────────────────────────────────────

export function AdultsClosingCta({ isHe }: { isHe: boolean }) {
  // isHe stays referenced here — used below to flip the ArrowRight icon
  // 180° in RTL so it visually points "forward" toward the catalogue.
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
          <CmsText cmsKey="mioshySexPage.closingKicker" />
        </span>
        <h2
          className="mt-7 text-balance text-[44px] leading-[1.02] tracking-[-0.02em] text-white sm:text-[56px] lg:text-[72px]"
          style={{ fontFamily: "'Frank Ruhl Libre', serif", fontWeight: 600 }}
        >
          <CmsText cmsKey="mioshySexPage.closingHeadlinePrefix" />{" "}
          <span
            className="block bg-gradient-to-br from-rose-200 via-rose-400 to-amber-300 bg-clip-text text-transparent"
            style={{ fontStyle: "italic", fontWeight: 500 }}
          >
            <CmsText cmsKey="mioshySexPage.closingHeadlineEmphasis" />
          </span>
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
            {/* CTA label reuses heroCtaPrimary — same string ("Enter the
                catalogue" / "אל הקטלוג") used at the top of /mioshy-sex,
                so admins edit it once and both surfaces update. */}
            <CmsText cmsKey="mioshySexPage.heroCtaPrimary" />
            <ArrowRight
              className={`h-5 w-5 transition group-hover:translate-x-1 ${
                isHe ? "rotate-180 group-hover:-translate-x-1" : ""
              }`}
            />
          </span>
        </Link>

        <CmsText
          cmsKey="mioshySexPage.closingReassurance"
          as="p"
          className="mt-6 text-[18px] text-white/70 sm:text-[14px] sm:text-white/45"
          style={{ fontFamily: "'Frank Ruhl Libre', serif", fontStyle: "italic" }}
        />
      </div>

      {/* 2026-05-20 — mio-adults-cta-shift CSS animation removed.
          It animated `background-position` which forces a full paint
          on every frame and was flagged as non-composited in
          Lighthouse. The CTA's gradient now sits static; the visual
          loss is minimal (a subtle 7s left-right shimmer) but the
          paint cost is eliminated entirely. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .mio-adults-cta-shift { /* static, animation removed */ }
          `,
        }}
      />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Catalogue intro - small editorial heading rendered just above the storefront.
// Kept as its own -xport so the page can still position the storefront where
// it wants.
// ─────────────────────────────────────────────────────────────────────────────

export function AdultsCatalogueIntro({ isHe: _isHe }: { isHe: boolean }) {
  return (
    /* Per Itzik 2026-05-07: this intro now sits ON the dark catalogue
       surface (text-white) so it reads as the heading OF the products
       grid below, not as a stranded section on a separate cream
       background. Eyebrow accent stays wine; body text is white. */
    <div id="catalogue-intro" className="relative px-4 pb-6 pt-[40px] sm:pt-[80px]">
      <div className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#F8C8CE]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#F43F5E] shadow-[0_0_10px_rgba(244,63,94,0.5)]" />
          <CmsText cmsKey="mioshySexPage.catalogueKicker" />
        </span>
        <h2
          className="mt-7 text-[36px] leading-[1.05] tracking-[-0.02em] text-white sm:text-[44px] lg:text-[52px]"
          style={{ fontFamily: "'Frank Ruhl Libre', serif", fontWeight: 600 }}
        >
          <CmsText cmsKey="mioshySexPage.catalogueHeadlinePrefix" />{" "}
          <span
            className="text-[#F43F5E]"
            style={{ fontStyle: "italic", fontWeight: 500 }}
          >
            <CmsText cmsKey="mioshySexPage.catalogueHeadlineEmphasis" />
          </span>
        </h2>
      </div>
    </div>
  );
}

// Backward-compat - still exported, but nobody on the new page uses it.
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
