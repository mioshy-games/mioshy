/**
 * /[locale]/how-it-works
 *
 * Dedicated landing page for the journey service. Bilingual inline
 * strings (no new message keys required). Designed to answer:
 *   1. What is Mioshy?
 *   2. What's the difference from "another tips blog"?
 *   3. What do I actually get?
 *   4. How does it work step by step?
 *   5. How much does it cost and can I cancel?
 *   6. How do I start?
 */

import { Link } from "@/navigation";
import type { Metadata } from "next";
import {
  ArrowRight,
  Brain,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  HeartHandshake,
  MessageCircleHeart,
  ShieldCheck,
  Sparkles,
  Target,
  UserCheck,
  Zap,
} from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const isHe = params.locale === "he";
  return {
    title: isHe
      ? "איך זה עובד - מיאושי"
      : "How it works - Mioshy",
    description: isHe
      ? "המסע האישי של מיאושי: שאלון, ניתוח, ותוכנית שבועית שמותאמת בדיוק לכם. לא עצות גנריות."
      : "Mioshy's personal journey: a questionnaire, deep analysis, and a weekly plan tailored to you. Not generic advice.",
  };
}

export default function HowItWorksPage({
  params,
}: {
  params: { locale: string };
}) {
  const isHe = params.locale === "he";
  const L = isHe ? he : en;

  return (
    <main dir={isHe ? "rtl" : "ltr"} className="min-h-[100dvh] bg-[var(--mio-bg)] text-white">
      {/* Hero */}
      <section className="relative overflow-hidden py-20 sm:py-28">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(800px_circle_at_20%_10%,#3b0764,transparent_60%),radial-gradient(700px_circle_at_80%_30%,rgba(251,113,133,0.18),transparent_55%),linear-gradient(180deg,#0d0a14,#1a0a2e_60%,#0d0a14)]" />
        <div className="mx-auto max-w-4xl px-4 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-fuchsia-200">
            <Sparkles className="h-3.5 w-3.5" />
            {L.badge}
          </span>
          <h1 className="mt-6 font-heading text-5xl font-bold leading-[1.08] tracking-tight sm:text-6xl">
            <span className="bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
              {L.heroTitle}
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/80 sm:text-xl">
            {L.heroSub}
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/journey"
              className="cta-glow inline-flex min-h-[56px] items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 via-purple-500 to-pink-500 px-8 text-base font-bold text-white shadow-lg shadow-fuchsia-500/30 transition hover:brightness-110 sm:min-w-[240px]"
            >
              {L.ctaPrimary}
              <ArrowRight className="ms-2 h-5 w-5" />
            </Link>
            <Link
              href="#process"
              className="inline-flex min-h-[56px] items-center justify-center rounded-full border border-purple-400/30 bg-purple-500/10 px-8 text-base font-semibold text-white/90 transition hover:bg-purple-500/20 sm:min-w-[220px]"
            >
              {L.ctaSecondary}
            </Link>
          </div>
        </div>
      </section>

      {/* Why not generic */}
      <section className="py-16">
        <div className="mx-auto max-w-5xl px-4">
          <div className="rounded-3xl border border-purple-500/20 bg-[var(--mio-card)] p-8 backdrop-blur-md sm:p-12">
            <h2 className="font-heading text-3xl font-bold sm:text-4xl">{L.whyTitle}</h2>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/75">
              {L.whyIntro}
            </p>

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6">
                <p className="text-sm font-bold uppercase tracking-wider text-rose-300">
                  {L.whyGenericLabel}
                </p>
                <ul className="mt-4 space-y-3 text-sm text-white/80">
                  {L.whyGenericList.map((x, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400/70" />
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/5 p-6">
                <p className="text-sm font-bold uppercase tracking-wider text-fuchsia-300">
                  {L.whyMioshyLabel}
                </p>
                <ul className="mt-4 space-y-3 text-sm text-white/90">
                  {L.whyMioshyList.map((x, i) => (
                    <li key={i} className="flex gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-300" />
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Process */}
      <section id="process" className="bg-[var(--mio-surface-b)] py-20">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="font-heading text-4xl font-bold sm:text-5xl">{L.processTitle}</h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/75">
            {L.processSub}
          </p>

          <ol className="mt-12 space-y-5">
            {[
              { icon: ClipboardList, num: "01", t: L.step1Title, d: L.step1Desc, b: L.step1Badge },
              { icon: Brain, num: "02", t: L.step2Title, d: L.step2Desc, b: L.step2Badge },
              { icon: Target, num: "03", t: L.step3Title, d: L.step3Desc, b: L.step3Badge },
              { icon: CalendarCheck, num: "04", t: L.step4Title, d: L.step4Desc, b: L.step4Badge },
            ].map((s) => (
              <li
                key={s.num}
                className="flex flex-col gap-5 rounded-3xl border border-purple-500/20 bg-[var(--mio-card)] p-6 backdrop-blur-md sm:flex-row sm:items-center sm:p-8"
              >
                <div className="flex shrink-0 items-center gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 via-purple-500 to-pink-500 text-lg font-bold">
                    {s.num}
                  </span>
                  <s.icon className="h-7 w-7 text-[var(--mio-purple)]" />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-heading text-xl font-bold sm:text-2xl">{s.t}</h3>
                    <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-200">
                      {s.b}
                    </span>
                  </div>
                  <p className="mt-2 leading-relaxed text-white/75">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* What you get */}
      <section className="py-20">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="font-heading text-4xl font-bold sm:text-5xl">{L.getTitle}</h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/75">{L.getSub}</p>

          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {[
              { icon: Zap, t: L.get1Title, d: L.get1Desc },
              { icon: ClipboardList, t: L.get2Title, d: L.get2Desc },
              { icon: MessageCircleHeart, t: L.get3Title, d: L.get3Desc },
              { icon: UserCheck, t: L.get4Title, d: L.get4Desc, badge: L.getSoonBadge },
            ].map((c, i) => (
              <div
                key={i}
                className="relative rounded-2xl border border-purple-500/20 bg-[var(--mio-card)] p-6 backdrop-blur-md"
              >
                {c.badge ? (
                  <span className="absolute top-5 end-5 rounded-full bg-fuchsia-500/20 px-2.5 py-0.5 text-xs font-bold text-fuchsia-200">
                    {c.badge}
                  </span>
                ) : null}
                <c.icon className="h-6 w-6 text-[var(--mio-purple)]" />
                <p className="mt-4 text-lg font-bold">{c.t}</p>
                <p className="mt-2 leading-relaxed text-white/75">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="bg-[var(--mio-surface-b)] py-16">
        <div className="mx-auto max-w-5xl px-4">
          <div className="grid gap-5 md:grid-cols-3">
            {[
              { icon: ShieldCheck, t: L.trust1Title, d: L.trust1Desc },
              { icon: HeartHandshake, t: L.trust2Title, d: L.trust2Desc },
              { icon: Sparkles, t: L.trust3Title, d: L.trust3Desc },
            ].map((c, i) => (
              <div
                key={i}
                className="rounded-2xl border border-purple-500/20 bg-[var(--mio-card)] p-6 backdrop-blur-md"
              >
                <c.icon className="h-6 w-6 text-[var(--mio-rose)]" />
                <p className="mt-3 text-lg font-bold">{c.t}</p>
                <p className="mt-2 text-sm leading-relaxed text-white/70">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="font-heading text-4xl font-bold sm:text-5xl">{L.finalTitle}</h2>
          <p className="mt-5 text-lg leading-relaxed text-white/80">{L.finalSub}</p>
          <div className="mt-10 flex justify-center">
            <Link
              href="/journey"
              className="cta-glow inline-flex min-h-[56px] items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 via-purple-500 to-pink-500 px-10 text-base font-bold text-white shadow-lg shadow-fuchsia-500/30 transition hover:brightness-110"
            >
              {L.finalCta}
              <ArrowRight className="ms-2 h-5 w-5" />
            </Link>
          </div>
          <p className="mt-4 text-sm text-white/60">{L.finalFinePrint}</p>
        </div>
      </section>
    </main>
  );
}

// ─────────────────────────── Copy (he) ───────────────────────────
const he = {
  badge: "השירות המרכזי של מיאושי",
  heroTitle: "לא עצות מהספרים. ליווי מותאם אישית לזוגיות שלכם.",
  heroSub:
    "שאלון חכם, ניתוח של 20 צירים מקצועיים, ותוכנית שבועית של פעולות מדויקות - לא טיפים כלליים. זה השירות של מיאושי.",
  ctaPrimary: "התחלת המסע",
  ctaSecondary: "איך זה בדיוק עובד",

  whyTitle: "למה לא עוד אפליקציית עצות?",
  whyIntro:
    "רוב האפליקציות נותנות לכל זוג את אותן 10 עצות. הבעיה היא שהעצה ש״תעבוד לכם״ תלויה לגמרי בפער הספציפי שלכם. אנחנו מזהים את הפער - ואז בונים את התוכנית.",
  whyGenericLabel: "אפליקציות גנריות",
  whyGenericList: [
    "רשימת ״10 טיפים״ לכל זוג",
    "חומר שנכתב לפני 5 שנים, לא לכם",
    "לא יודעים מה עובד עבורכם ומה לא",
    "אתם לבד עם הפרשנות",
  ],
  whyMioshyLabel: "מיאושי",
  whyMioshyList: [
    "שאלון קצר שמגלה את הפער האישי שלכם",
    "ניתוח מקצועי שמבוסס על גוטמן, פרל וצ׳פמן",
    "משימות שנבחרות ספציפית לפי הציונים שלכם",
    "התאמה שבועית - לא קובץ סטטי",
  ],

  processTitle: "איך זה עובד",
  processSub:
    "ארבעה שלבים ברורים. בלי תשובות פתוחות באלף מילים, בלי פרופילים פסיכולוגיים ארוכים. רק מה שדרוש כדי לבנות לכם תוכנית.",
  step1Title: "מילוי שאלון",
  step1Desc:
    "28 שאלות קצרות, 7–10 דקות. סולם של 1–5, ללא תשובות פתוחות. השאלון לומד אתכם תוך כדי.",
  step1Badge: "7 דקות",
  step2Title: "ניתוח ע״י מומחים",
  step2Desc:
    "ניתוח אוטומטי של 20 צירים (מפת אהבה, חברות, טיפול בקונפליקט, שפת אהבה, תשוקה) ובדיקה אישית של המומחה שלנו לפני שליחת התוכנית.",
  step2Badge: "ניתוח עמוק",
  step3Title: "קבלת תוכנית אישית",
  step3Desc:
    "דוח אישי שמראה לכם בדיוק איפה אתם חזקים ואיפה הפערים, ותוכנית של 26 שבועות שמותאמת לציונים שלכם.",
  step3Badge: "תוכנית אישית",
  step4Title: "תרגול שבועי",
  step4Desc:
    "2–4 משימות בשבוע שמגיעות במייל או בווטסאפ. פעולה אחת כל פעם. ללא הרצאות, ללא מאמרים ארוכים - רק מה לעשות.",
  step4Badge: "26 שבועות",

  getTitle: "מה מקבלים בשירות",
  getSub: "המחיר אחד. כל מה שבהמשך נכלל.",
  get1Title: "2–4 משימות בשבוע",
  get1Desc:
    "תרגולים קצרים שמותאמים לפער האישי שלכם. כל משימה לוקחת 5–20 דקות - לא פרויקט.",
  get2Title: "שאלונים נוספים להתאמה מדויקת",
  get2Desc:
    "כל 4 שבועות שאלון קצר לחידוד. התוכנית שלכם מתעדכנת בהתאם - לא סטטית.",
  get3Title: "דוח אישי מפורט",
  get3Desc:
    "ניתוח של 20 צירים עם המלצות שעולות מהציונים שלכם. ניתן לשתף עם בן/בת הזוג.",
  get4Title: "שיחות עם מומחים",
  get4Desc:
    "בשלב הבא של התוכנית - שיחות אישיות קצרות עם מומחה לזוגיות, כלולות במחיר.",
  getSoonBadge: "בהמשך",

  trust1Title: "פרטי, לגמרי",
  trust1Desc:
    "התשובות שלכם לא נמכרות, לא מפורסמות, ואף אחד לא רואה אותן מלבדכם והצוות המטפל.",
  trust2Title: "מבוסס מחקר",
  trust2Desc:
    "המודל של גוטמן (40 שנה מחקר), 5 שפות האהבה של צ׳פמן, ותובנות מאסתר פרל על תשוקה.",
  trust3Title: "ביטול בכל זמן",
  trust3Desc:
    "המסלול הוא חודשי. אין מחויבות שנתית, אפשר לעצור או לחזור בכל עת.",

  finalTitle: "המסע מתחיל בשאלה אחת",
  finalSub:
    "שלוש שאלות ראשונות הן חינם - לפני בקשת תשלום תוכלו לראות איך זה מרגיש ולהחליט.",
  finalCta: "התחלת המסע",
  finalFinePrint: "אין צורך בכרטיס אשראי בהתחלה. הצטרפות 2 דקות.",
};

// ─────────────────────────── Copy (en) ───────────────────────────
const en = {
  badge: "Mioshy's flagship service",
  heroTitle: "Not advice from books. A journey built for your relationship.",
  heroSub:
    "A smart questionnaire, analysis across 20 professional axes, and a weekly plan of specific actions - not generic tips. That's Mioshy.",
  ctaPrimary: "Begin my journey",
  ctaSecondary: "How it works, exactly",

  whyTitle: "Why not another advice app?",
  whyIntro:
    "Most apps give every couple the same 10 tips. The problem: the advice that will work for you depends entirely on your specific gap. We identify the gap - then build the plan.",
  whyGenericLabel: "Generic apps",
  whyGenericList: [
    "A '10 tips' list for every couple",
    "Content written 5 years ago, not for you",
    "Don't know what works for you vs. what doesn't",
    "You're alone with the interpretation",
  ],
  whyMioshyLabel: "Mioshy",
  whyMioshyList: [
    "A short questionnaire that reveals your personal gap",
    "Professional analysis grounded in Gottman, Perel, Chapman",
    "Tasks chosen specifically based on your scores",
    "Weekly adaptation - not a static file",
  ],

  processTitle: "How it works",
  processSub:
    "Four clear steps. No thousand-word open-ended answers, no long psychological profiles. Only what's needed to build your plan.",
  step1Title: "Fill the questionnaire",
  step1Desc:
    "28 short questions, 7–10 minutes. A 1–5 scale, no open-ended. It learns you as you go.",
  step1Badge: "7 minutes",
  step2Title: "Expert analysis",
  step2Desc:
    "Automatic analysis across 20 axes (love map, friendship, conflict handling, love language, passion) and a human review from our expert before your plan goes out.",
  step2Badge: "Deep analysis",
  step3Title: "Get your personal plan",
  step3Desc:
    "A personal report showing exactly where you're strong and where the gaps are, plus a 26-week plan tailored to your scores.",
  step3Badge: "Personal plan",
  step4Title: "Weekly practice",
  step4Desc:
    "2–4 tasks per week arriving by email or WhatsApp. One action at a time. No lectures, no long articles - just what to do.",
  step4Badge: "26 weeks",

  getTitle: "What you get",
  getSub: "One price. Everything below is included.",
  get1Title: "2–4 tasks per week",
  get1Desc:
    "Short practices matched to your personal gap. Each takes 5–20 minutes - not a project.",
  get2Title: "Ongoing questionnaires for precise matching",
  get2Desc:
    "Every 4 weeks a short check-in. Your plan updates based on it - never static.",
  get3Title: "Detailed personal report",
  get3Desc:
    "20-axis analysis with recommendations derived from your scores. Shareable with your partner.",
  get4Title: "Expert consultations",
  get4Desc:
    "In the next phase of the program - short 1-on-1 sessions with a relationship expert, included in the price.",
  getSoonBadge: "Coming soon",

  trust1Title: "Private, always",
  trust1Desc:
    "Your answers aren't sold, aren't published, and no one sees them besides you and the care team.",
  trust2Title: "Research-backed",
  trust2Desc:
    "Gottman's model (40 years of research), Chapman's 5 Love Languages, and Perel's insights on desire.",
  trust3Title: "Cancel anytime",
  trust3Desc:
    "Monthly plan. No annual commitment - pause or cancel anytime.",

  finalTitle: "The journey starts with one question",
  finalSub:
    "The first 3 questions are free - you can feel how it works before any payment.",
  finalCta: "Begin my journey",
  finalFinePrint: "No credit card up front. Sign-up takes 2 minutes.",
};
