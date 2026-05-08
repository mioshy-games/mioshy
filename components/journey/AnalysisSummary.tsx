"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Lock,
  CalendarDays,
  MessageCircle,
  CheckCircle2,
  Sparkles,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import type { Analysis, Locale } from "@/lib/journey/types";
import { axisLabel } from "@/lib/journey/analysis";
import {
  getFocusMonthCopy,
  isPriorityKey,
} from "@/lib/journey/focus-month-copy";

interface AnalysisSummaryProps {
  analysis: Analysis | null;
  locale: Locale;
  subscriptionActive?: boolean;
}

/**
 * Post-completion screen — premium edition (Itzik #62).
 *
 * Three sections:
 *   1. Hero — title + 3 score cards in a tight row.
 *   2. Insight — narrative + focus-month + recommendation bullets,
 *      laid out as a single readable column with consistent rhythm.
 *   3. CTA — wine-palette offer card matching /pricing and the rest
 *      of the site (no fuchsia rainbow).
 *
 * Redesigned 2026-05-07 — replaces the wall-of-text pattern with
 * clearly-bulleted, scannable copy and a single brand-consistent
 * conversion path.
 */
export function AnalysisSummary({
  analysis,
  locale,
  subscriptionActive = false,
}: AnalysisSummaryProps) {
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const isHe = locale === "he";

  if (!analysis) {
    return (
      <div
        dir={isHe ? "rtl" : "ltr"}
        className="mx-auto max-w-2xl p-10 text-center text-white/80"
      >
        {isHe ? "מכינים את הניתוח שלכם…" : "Preparing your analysis…"}
      </div>
    );
  }

  const t = isHe
    ? {
        sectionLabel: "התוצאות שלכם",
        title: "הניתוח האישי שלכם",
        subtitle: "מה ראינו, ולאן ממשיכים מכאן",
        friendship: "חברות זוגית",
        conflict: "התמודדות עם קשיים",
        passion: "סיכון לירידה בתשוקה",
        narrativeLabel: "תמצית",
        topGap: "מוקד החודש הראשון",
        recs: "התוכנית המותאמת שלכם",
        offerLabel: "השלב הבא",
        offerHero: "ליווי צמוד של מומחה זוגיות, בחדר פרטי שלכם בלבד.",
        offerSub: "תוך 30 יום תרגישו שינוי אמיתי.",
        feat1Title: "חדר אישי סגור עם המומחה שלכם",
        feat1Body:
          "שולחים שאלות מתי שצריך, מקבלים מענה אמיתי - לא בוט, לא תור.",
        feat2Title: "תוכן שבועי שמותאם לסיפור שלכם",
        feat2Body:
          "לא קורס מוכן. כל שבוע תוכן שנבנה לפי מה שמילאתם והשיחות שלכם עם המומחה.",
        feat3Title: "שיחה שמתפתחת איתכם",
        feat3Body:
          "אתם מגיבים על כל תוכן, המומחה עונה, וזה ממשיך לבנות את התהליך - שבוע אחר שבוע.",
        price: "57₪ / שבוע",
        priceNote: "ניתן לעצור בכל עת",
        cta: "המומחים שלנו מחכים לכם",
        ctaLoading: "מכין תשלום…",
        activeTitle: "אתם כבר חלק מהמסע",
        activeSub:
          "התוכנית האישית שלכם פעילה. המשימות השבועיות יגיעו ישירות אליכם.",
        goAccount: "מיאושי שלי",
      }
    : {
        sectionLabel: "Your results",
        title: "Your personal analysis",
        subtitle: "What we found, and where we go from here",
        friendship: "Friendship",
        conflict: "Handling friction",
        passion: "Passion at risk",
        narrativeLabel: "Summary",
        topGap: "Focus for the first month",
        recs: "Your personalized program",
        offerLabel: "What's next",
        offerHero:
          "Dedicated guidance from a relationship expert, inside a private room — just the two of you and them.",
        offerSub: "In 30 days you'll feel a real change.",
        feat1Title: "A private, closed room with your expert",
        feat1Body:
          "Send questions whenever you need to, get a real reply - no bot, no queue.",
        feat2Title: "Weekly content tailored to your story",
        feat2Body:
          "Not an off-the-shelf course. Each week's content is built around what you filled in and your conversations with the expert.",
        feat3Title: "A dialogue that grows with you",
        feat3Body:
          "You respond to every piece of content, your expert replies, and the process keeps building - week after week.",
        price: "$19 / week",
        priceNote: "Cancel anytime",
        cta: "Our experts are ready",
        ctaLoading: "Preparing checkout…",
        activeTitle: "You're already on the journey",
        activeSub:
          "Your personal plan is active. Weekly tasks will be delivered to you soon.",
        goAccount: "Open My Mioshy",
      };

  const bakedFocus = isHe
    ? analysis.summary.focus_label_he
    : analysis.summary.focus_label_en;
  const focusLabel =
    bakedFocus ??
    (analysis.top_gap ? axisLabel(analysis.top_gap, locale) : null);

  const Arrow = isHe ? ArrowLeft : ArrowRight;

  const startCheckout = async () => {
    setCheckoutBusy(true);
    try {
      const res = await fetch("/api/billing/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: "weekly",
          product: "journey",
          source: "analysis_summary",
          language: locale,
          is_israeli: locale === "he",
        }),
      });
      const data = await res.json();
      if (data?.redirect_url) {
        window.location.href = data.redirect_url;
      } else {
        setCheckoutBusy(false);
      }
    } catch {
      setCheckoutBusy(false);
    }
  };

  return (
    <motion.div
      dir={isHe ? "rtl" : "ltr"}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10"
    >
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-2.5">
        <span className="inline-flex items-center gap-2 self-start rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-[12px] font-semibold uppercase tracking-wider text-white/70">
          <Sparkles className="h-3.5 w-3.5" />
          {t.sectionLabel}
        </span>
        <h1 className="font-heading text-[34px] font-extrabold leading-tight text-white sm:text-[42px]">
          {t.title}
        </h1>
        <p className="text-[17px] text-white/65">{t.subtitle}</p>
      </header>

      {/* ── Score cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ScoreCard label={t.friendship} value={analysis.friendship_score} />
        <ScoreCard label={t.conflict} value={analysis.conflict_health} />
        <ScoreCard
          label={t.passion}
          value={analysis.passion_risk}
          invert
        />
      </div>

      {/* ── Narrative ────────────────────────────────────────────────── */}
      <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
        <div className="text-[12px] font-semibold uppercase tracking-wider text-[#B83C4D]/80">
          {t.narrativeLabel}
        </div>
        <p className="mt-2 text-[18px] leading-[1.7] text-white/90">
          {isHe ? analysis.summary.narrative_he : analysis.summary.narrative_en}
        </p>
      </section>

      {/* ── Focus for the first month ────────────────────────────────── */}
      {focusLabel && (() => {
        const priority = isPriorityKey(analysis.summary.top_priority)
          ? analysis.summary.top_priority
          : null;
        const focus = getFocusMonthCopy(priority, locale);
        return (
          <section
            className="relative overflow-hidden rounded-3xl border p-6 sm:p-7"
            style={{
              borderColor: "rgba(184,60,77,0.35)",
              background:
                "linear-gradient(135deg, rgba(184,60,77,0.18) 0%, rgba(108,46,64,0.10) 60%, rgba(255,255,255,0.02) 100%)",
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -end-20 -top-20 h-56 w-56 rounded-full opacity-30 blur-3xl"
              style={{ background: "#B83C4D" }}
            />
            <div className="relative">
              <div className="text-[12px] font-semibold uppercase tracking-wider text-[#FAF6F7]/70">
                {t.topGap}
              </div>
              <div className="mt-1.5 font-heading text-[26px] font-extrabold leading-tight text-white sm:text-[30px]">
                {focusLabel}
              </div>
              {focus ? (
                <ul className="mt-4 flex flex-col gap-2.5">
                  {[focus.reflection, focus.plan, focus.close].map((line, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 text-[17px] leading-[1.7] text-white/90"
                    >
                      <CheckCircle2
                        className="mt-1 h-4 w-4 shrink-0 text-[#B83C4D]"
                        aria-hidden
                      />
                      <span className={i === 2 ? "font-semibold text-[#FAF6F7]" : ""}>
                        {line}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>
        );
      })()}

      {/* ── Recommendations as bullets ───────────────────────────────── */}
      <section>
        <h2 className="font-heading text-[22px] font-extrabold text-white sm:text-[26px]">
          {t.recs}
        </h2>
        <ul className="mt-4 flex flex-col gap-2.5">
          {analysis.summary.recommendations.map((rec) => (
            <li
              key={rec.id}
              className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.025] px-5 py-3.5"
            >
              <span
                className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: "#B83C4D" }}
                aria-hidden
              />
              <span className="text-[17px] leading-[1.65] text-white/90">
                {isHe ? rec.he : rec.en}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── CTA / Active subscriber ──────────────────────────────────── */}
      {subscriptionActive ? (
        <ActiveSubscriberCard
          title={t.activeTitle}
          sub={t.activeSub}
          ctaLabel={t.goAccount}
          locale={locale}
        />
      ) : (
        <OfferCard
          t={t}
          checkoutBusy={checkoutBusy}
          onCheckout={startCheckout}
          Arrow={Arrow}
        />
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Score card — solid surface, big numeric, label above. Invert flips
// the colour mapping for "risk" axes (high=bad, low=good).
// ─────────────────────────────────────────────────────────────────────

function ScoreCard({
  label,
  value,
  invert = false,
}: {
  label: string;
  value: number;
  invert?: boolean;
}) {
  const tone = invert
    ? value >= 60
      ? "text-rose-300"
      : "text-emerald-300"
    : value >= 60
      ? "text-emerald-300"
      : "text-amber-300";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-white/15">
      <div className="text-[13px] font-medium text-white/70">{label}</div>
      <div className={`mt-1 text-[28px] font-extrabold leading-none ${tone}`}>
        {value}
        <span className="ms-1 text-[14px] font-semibold text-white/45">
          /100
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────

function ActiveSubscriberCard({
  title,
  sub,
  ctaLabel,
  locale,
}: {
  title: string;
  sub: string;
  ctaLabel: string;
  locale: string;
}) {
  return (
    <section
      className="flex flex-col items-center gap-3 rounded-3xl border p-7 text-center"
      style={{
        borderColor: "rgba(184,60,77,0.35)",
        background:
          "linear-gradient(135deg, rgba(184,60,77,0.18) 0%, rgba(108,46,64,0.08) 100%)",
      }}
    >
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full"
        style={{
          background: "linear-gradient(135deg, #B83C4D 0%, #6C2E40 100%)",
          boxShadow: "0 12px 30px -10px rgba(184,60,77,0.55)",
        }}
      >
        <CheckCircle2 className="h-7 w-7 text-[#FAF6F7]" />
      </div>
      <h2 className="font-heading text-[26px] font-extrabold text-white">
        {title}
      </h2>
      <p className="max-w-md text-[16px] text-white/75">{sub}</p>
      <a
        href={`/${locale}/my`}
        className="mt-2 inline-flex min-h-[52px] items-center justify-center rounded-full px-7 text-[15px] font-bold text-white transition hover:brightness-110"
        style={{
          background: "linear-gradient(135deg, #B83C4D 0%, #6C2E40 100%)",
        }}
      >
        {ctaLabel}
      </a>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────

function OfferCard({
  t,
  checkoutBusy,
  onCheckout,
  Arrow,
}: {
  t: {
    offerLabel: string;
    offerHero: string;
    offerSub: string;
    feat1Title: string;
    feat1Body: string;
    feat2Title: string;
    feat2Body: string;
    feat3Title: string;
    feat3Body: string;
    price: string;
    priceNote: string;
    cta: string;
    ctaLoading: string;
  };
  checkoutBusy: boolean;
  onCheckout: () => void;
  Arrow: typeof ArrowLeft;
}) {
  return (
    <section
      className="relative overflow-hidden rounded-3xl border p-7 sm:p-8"
      style={{
        borderColor: "rgba(184,60,77,0.45)",
        background:
          "linear-gradient(160deg, #1a0f15 0%, #0E0810 60%, #0E0810 100%)",
        boxShadow: "0 30px 80px -30px rgba(184,60,77,0.5)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -start-24 -top-24 h-64 w-64 rounded-full opacity-30 blur-3xl"
        style={{ background: "#B83C4D" }}
      />

      <div className="relative">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#B83C4D]/40 bg-[#B83C4D]/15 px-3 py-1 text-[12px] font-semibold uppercase tracking-wider text-[#FAF6F7]">
          {t.offerLabel}
        </span>
        <h2 className="mt-3 font-heading text-[26px] font-extrabold leading-snug text-white sm:text-[30px]">
          {t.offerHero}
        </h2>
        <p className="mt-2 text-[17px] font-semibold text-[#FAF6F7]/85">
          {t.offerSub}
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:grid sm:grid-cols-3">
          <FeatureTile
            icon={<Lock className="size-5" />}
            title={t.feat1Title}
            body={t.feat1Body}
          />
          <FeatureTile
            icon={<CalendarDays className="size-5" />}
            title={t.feat2Title}
            body={t.feat2Body}
          />
          <FeatureTile
            icon={<MessageCircle className="size-5" />}
            title={t.feat3Title}
            body={t.feat3Body}
          />
        </div>

        <div className="mt-6 flex flex-col items-center gap-1.5 sm:flex-row sm:justify-between sm:gap-4">
          <div className="flex items-baseline gap-2">
            <span className="font-heading text-[34px] font-extrabold text-white">
              {t.price}
            </span>
            <span className="text-[14px] text-white/55">· {t.priceNote}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onCheckout}
          disabled={checkoutBusy}
          className="group mt-5 inline-flex min-h-[58px] w-full items-center justify-center gap-3 rounded-full px-8 text-[17px] font-bold text-white transition hover:brightness-110 disabled:opacity-60"
          style={{
            background: "linear-gradient(135deg, #B83C4D 0%, #6C2E40 100%)",
            boxShadow: "0 18px 40px -12px rgba(184,60,77,0.55)",
          }}
        >
          {checkoutBusy ? t.ctaLoading : t.cta}
          {!checkoutBusy ? (
            <Arrow className="h-4 w-4 transition-transform group-hover:translate-x-[-3px]" />
          ) : null}
        </button>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────

function FeatureTile({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <span
        className="flex h-9 w-9 items-center justify-center rounded-full text-[#FAF6F7]"
        style={{ background: "rgba(184,60,77,0.25)" }}
        aria-hidden
      >
        {icon}
      </span>
      <div className="text-[16px] font-bold leading-snug text-white">
        {title}
      </div>
      <p className="text-[14px] leading-[1.55] text-white/70">{body}</p>
    </div>
  );
}
