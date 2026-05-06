"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Lock, CalendarDays, MessageCircle } from "lucide-react";
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
 * Post-completion screen.
 * - Shows the personalized relationship analysis.
 * - If the user doesn't have an active subscription, shows the service CTA.
 * - If they're already subscribed, shows a "you're all set" message.
 */
export function AnalysisSummary({ analysis, locale, subscriptionActive = false }: AnalysisSummaryProps) {
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  const isHe = locale === "he";

  if (!analysis) {
    return (
      <div dir={isHe ? "rtl" : "ltr"} className="mx-auto max-w-2xl p-10 text-center text-white/80">
        {isHe ? "מכינים את הניתוח שלכם…" : "Preparing your analysis…"}
      </div>
    );
  }

  // Copy approved by Itzik 2026-05-05. Tone: professional + urgency-results
  // (combination A+C). The offer card now leads with the expert-mentorship
  // promise (private room, weekly content, ongoing dialogue) instead of
  // generic feature bullets - because that's the actual product.
  const t = isHe
    ? {
        title: "הניתוח שלכם",
        friendship: "חברות זוגית",
        conflict: "שקט בוויכוחים",
        passion: "סיכון לירידה בתשוקה",
        topGap: "מוקד לחודש הראשון",
        recs: "התוכנית המותאמת שלכם",
        offerHero: "ליווי צמוד של מומחה זוגיות - בתוך חשבון פרטי, רק אתם והוא.",
        offerSub: "תוך 30 יום תרגישו שינוי אמיתי.",
        feat1Title: "חדר אישי סגור עם המומחה שלכם",
        feat1Body: "שולחים שאלות מתי שצריך, מקבלים מענה אמיתי - לא בוט, לא תור.",
        feat2Title: "תוכן שבועי שמותאם לסיפור שלכם",
        feat2Body:
          "לא קורס מוכן. כל שבוע תוכן שנבנה לפי מה שמילאתם והשיחות שלכם עם המומחה.",
        feat3Title: "שיחה שמתפתחת איתכם",
        feat3Body:
          "אתם מגיבים על כל תוכן, המומחה עונה, וזה ממשיך לבנות את התהליך - שבוע אחר שבוע.",
        price: "57₪ / שבוע · ניתן לעצור בכל עת",
        cta: "פתחו את החדר הפרטי שלכם",
        ctaLoading: "מכין תשלום…",
        activeTitle: "אתם כבר חלק מהמסע! 🎉",
        activeSub:
          "התוכנית האישית שלכם פעילה. המשימות השבועיות יגיעו ישירות אליכם.",
        goAccount: "לחשבון שלי",
      }
    : {
        title: "Your analysis",
        friendship: "Friendship",
        conflict: "Conflict health",
        passion: "Passion at risk",
        topGap: "Focus for the first month",
        recs: "Your personalized program",
        offerHero:
          "Dedicated guidance from a relationship expert - inside a private account, just the two of you and them.",
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
        price: "$19 / week · cancel anytime",
        cta: "Open your private room",
        ctaLoading: "Preparing checkout…",
        activeTitle: "You're all set! 🎉",
        activeSub:
          "Your personal plan is active. Weekly tasks will be delivered to you soon.",
        goAccount: "My account",
      };

  // Resolve the focus area for "מוקד לחודש הראשון" / "Focus for the first
  // month". Priority: pre-baked focus_label from analysis.summary
  // (computed server-side in lib/journey/analysis.ts using DB labels) →
  // legacy top_gap axis fallback → null. Slice 1 of v3: replaces the
  // dropped PRIORITY_LABELS_HE/EN constant maps; client never touches DB.
  const bakedFocus = isHe
    ? analysis.summary.focus_label_he
    : analysis.summary.focus_label_en;
  const focusLabel =
    bakedFocus ??
    (analysis.top_gap ? axisLabel(analysis.top_gap, locale) : null);

  const startCheckout = async () => {
    setCheckoutBusy(true);
    try {
      const res = await fetch("/api/billing/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: "monthly",
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

  const scoreCard = (label: string, value: number, invert = false) => (
    <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
      <div className="text-sm text-white/80">{label}</div>
      <div
        className={`mt-1 text-2xl font-bold ${
          invert
            ? value >= 60 ? "text-rose-300" : "text-emerald-300"
            : value >= 60 ? "text-emerald-300" : "text-amber-300"
        }`}
      >
        {value}
        <span className="text-sm text-white/50">/100</span>
      </div>
    </div>
  );

  return (
    <motion.div
      dir={isHe ? "rtl" : "ltr"}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10"
    >
      {/* ── Analysis header ── */}
      <h1 className="text-3xl font-bold text-white">{t.title}</h1>

      {/* ── Narrative ──
          text-[18px] per UX feedback 2026-05-05: previous text-base (16px)
          was too small for the summary's primary body copy. Leading-relaxed
          stays so the larger size doesn't crowd. */}
      <p className="rounded-2xl border border-white/15 bg-white/5 p-5 text-[18px] leading-relaxed text-white/95">
        {isHe ? analysis.summary.narrative_he : analysis.summary.narrative_en}
      </p>

      {/* ── Score cards ──
          Stack vertically on phones - the third Hebrew label
          ("סיכון לירידה בתשוקה", 21 chars) was wrapping to 3+ lines
          and clipping at 360px. From sm breakpoint up, 3-col grid
          stays for the original side-by-side comparison. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {scoreCard(t.friendship, analysis.friendship_score)}
        {scoreCard(t.conflict, analysis.conflict_health)}
        {scoreCard(t.passion, analysis.passion_risk, true)}
      </div>

      {/* ── Love-language card removed 2026-05-05 per Itzik -
          a single-line label felt too thin and the expanded version
          was deferred. Will revisit with a different relationship-
          insight panel later. The underlying scoring (analysis.
          primary_love_language) still computes; nothing is rendering
          it for now. */}

      {/* ── Focus for the first month ──
          Source priority:
          1. summary.top_priority - the user's #1 ranking pick (preferred)
          2. analysis.top_gap - legacy fallback (axis with lowest score)
          The card is hidden entirely when neither source has data.

          Copy reframed 2026-05-05 (approved by Itzik): the card no longer
          shows just the priority label - it now reflects the choice back
          to the user, validates it, names what the first month will look
          like, and closes with a doing→results frame. Per-priority copy
          lives in lib/journey/focus-month-copy.ts; falls back to the bare
          label when top_priority isn't a known PriorityKey (legacy rows). */}
      {focusLabel && (() => {
        const priority = isPriorityKey(analysis.summary.top_priority)
          ? analysis.summary.top_priority
          : null;
        const focus = getFocusMonthCopy(priority, locale);
        return (
          <div className="rounded-2xl border border-fuchsia-400/40 bg-gradient-to-br from-fuchsia-500/[0.12] via-fuchsia-500/[0.06] to-transparent p-5">
            <div className="text-xs uppercase tracking-wider text-fuchsia-200/85">
              {t.topGap}
            </div>
            <div className="mt-1 text-2xl font-semibold text-white">
              {focusLabel}
            </div>
            {focus ? (
              <div className="mt-3 flex flex-col gap-2.5 text-[18px] leading-relaxed text-white/90">
                <p>{focus.reflection}</p>
                <p>{focus.plan}</p>
                <p className="text-fuchsia-100/95 font-medium">{focus.close}</p>
              </div>
            ) : null}
          </div>
        );
      })()}

      {/* ── Recommendations ──
          Bumped from text-sm to text-[18px] per UX feedback 2026-05-05 -
          recommendations are action-oriented copy the user should actually
          read, not legal fine print. */}
      <div>
        <h2 className="mb-2 text-xl font-semibold text-white">{t.recs}</h2>
        <ul className="flex flex-col gap-2">
          {analysis.summary.recommendations.map((rec) => (
            <li
              key={rec.id}
              className="rounded-2xl border border-white/15 bg-white/5 p-4 text-[18px] leading-relaxed text-white/90"
            >
              {isHe ? rec.he : rec.en}
            </li>
          ))}
        </ul>
      </div>

      {/* ── CTA / Active subscriber ── */}
      <div className="rounded-2xl border border-fuchsia-500/40 bg-fuchsia-950/40 p-6">
        {subscriptionActive ? (
          <div className="flex flex-col gap-3 text-center">
            <h2 className="text-2xl font-bold text-white">{t.activeTitle}</h2>
            <p className="text-white/75">{t.activeSub}</p>
            <a
              href={`/${locale}/account`}
              className="mx-auto mt-2 rounded-2xl bg-fuchsia-600 px-6 py-3 text-sm font-semibold text-white hover:bg-fuchsia-700 transition"
            >
              {t.goAccount}
            </a>
          </div>
        ) : (
          // Offer card - restructured 2026-05-05 (approved by Itzik). The
          // old generic feature bullets ("full access", "more questionnaires")
          // are replaced by the actual product: weekly expert-led mentorship
          // inside a private account. Three feature tiles, each with an
          // icon + concrete promise + supporting copy.
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-[22px] font-bold leading-snug text-white sm:text-2xl">
                {t.offerHero}
              </h2>
              <p className="mt-2 text-[18px] font-semibold text-fuchsia-100">
                {t.offerSub}
              </p>
            </div>

            {/* Feature tiles - stack on mobile, grid on tablet+. */}
            <div className="flex flex-col gap-3 sm:grid sm:grid-cols-3">
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

            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center text-[16px] text-white/95 font-medium">
              {t.price}
            </div>

            <button
              type="button"
              onClick={startCheckout}
              disabled={checkoutBusy}
              className="w-full rounded-2xl bg-fuchsia-600 px-6 py-4 text-[18px] font-semibold text-white transition hover:bg-fuchsia-700 active:scale-[0.98] disabled:opacity-60"
            >
              {checkoutBusy ? t.ctaLoading : t.cta}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Single feature tile inside the offer card. Icon + bold title + supporting
 * line. Local to AnalysisSummary because it isn't used anywhere else and
 * carries the offer's specific styling (fuchsia accent on icon, white
 * gradient panel).
 */
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
    <div className="flex flex-col gap-2 rounded-xl border border-white/15 bg-white/[0.04] p-4">
      <div className="flex items-center gap-2 text-fuchsia-200">
        <span aria-hidden>{icon}</span>
      </div>
      <div className="text-[18px] font-semibold leading-snug text-white">
        {title}
      </div>
      <p className="text-[16px] leading-relaxed text-white/85">{body}</p>
    </div>
  );
}
