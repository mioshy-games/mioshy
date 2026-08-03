"use client";

import { useCallback, useState } from "react";
import { SurveyFlow } from "./SurveyFlow";
import { AssessmentInvitePopup } from "./AssessmentInvitePopup";

type View = "landing" | "question" | "history";

interface HistItem {
  questionId: string;
  text: string;
  chosenLabel: string;
  otherLabel: string;
  option: "a" | "b";
  chosenPct: number;
  otherPct: number;
  totalVotes: number;
  answeredAt: string;
}

/**
 * Dashboard home for "סקר הזוגיות של ישראל" (§5/§6). Signed-in space, so all
 * text is light on the dark shell. Three views, no navigation to the marketing
 * flow:
 *   • question — THE DEFAULT. A signed-in user lands straight on the first
 *                question they have not answered yet, with no interstitial.
 *                Answering reveals inline and stays here (§5).
 *   • landing  — join confirmation + entry points. No longer the entry point;
 *                reachable by pressing back from the question.
 *   • history  — read-only look back: answered questions + choice + § percentages
 *
 * ── Why "question" is the default (2026-08-03) ──────────────────────────────
 * The landing used to open first, one click away from the actual survey. That
 * click bought nothing: the survey has never had a per-day limit (the flow is
 * continuous for signed-in users exactly as it is for guests — see
 * lib/poll/queries.ts:getCurrentQuestion, which derives "next" purely from what
 * you have already answered). The interstitial only delayed the thing the user
 * came for.
 */
export function PollDashboardLanding({
  userName,
  locale = "he",
  hasShortAssessment = false,
}: {
  userName?: string | null;
  locale?: string;
  /** Server-resolved: user already completed the short assessment → suppress the
   *  post-signup assessment-invite popup. */
  hasShortAssessment?: boolean;
}) {
  const [view, setView] = useState<View>("question");
  const [history, setHistory] = useState<HistItem[] | null>(null);
  const [histLoading, setHistLoading] = useState(false);
  // Has the user answered something this session? Gates the assessment invite —
  // see the comment where it is rendered.
  const [revealed, setRevealed] = useState(false);

  const openHistory = useCallback(async () => {
    setView("history");
    if (history) return;
    setHistLoading(true);
    const d = await fetch("/api/poll/history?tally=1")
      .then((r) => (r.ok ? r.json() : { history: [] }))
      .catch(() => ({ history: [] }));
    setHistory(d.history ?? []);
    setHistLoading(false);
  }, [history]);

  // ── Question view (DEFAULT): the survey, in the dashboard. Answering reveals
  //    inline and stays here (§5); back goes to the landing (§4).
  //
  // The assessment invite is a FULL-SCREEN modal, so where it fires decides
  // whether this page feels open or blocked. It used to sit in the landing
  // markup, which meant two things once "question" became the default: it would
  // have stopped rendering altogether, and putting it back naively would have
  // dropped a modal on top of the question — re-adding exactly the friction
  // between arriving and answering that this flow removed.
  //
  // So it waits for the reveal (Itzik 2026-08-03): the user has answered
  // something and seen how the country answered, which is also a far better
  // moment to offer the assessment. Frequency is unchanged — the popup is still
  // once per user, gated on its own localStorage key.
  if (view === "question") {
    return (
      <>
        {revealed ? (
          <AssessmentInvitePopup locale={locale} hasShortAssessment={hasShortAssessment} />
        ) : null}
        <SurveyFlow
          embedded
          authed
          userName={userName}
          back={{ onClick: () => setView("landing") }}
          onReveal={() => setRevealed(true)}
        />
      </>
    );
  }

  // ── History view (§6): read-only look back with the live percentages.
  if (view === "history") {
    return (
      <div dir="rtl" className="mx-auto max-w-lg px-5 py-10 text-[#2a2130]" style={{ fontFamily: "var(--font-assistant), sans-serif" }}>
        <button
          type="button"
          onClick={() => setView("landing")}
          className="mb-6 inline-flex items-center gap-1.5 text-[15px] font-semibold text-[#4a3f4a] hover:text-[#2a2130]"
        >
          <span aria-hidden>→</span> חזרה
        </button>
        <h1 className="text-[22px] font-extrabold text-center text-[#2a2130]">ההיסטוריה שלי</h1>
        <p className="text-[#6b5f6a] text-sm text-center mb-6">השאלות שכבר עניתם עליהן</p>

        {histLoading ? (
          <p className="text-center text-[#6b5f6a]">טוען…</p>
        ) : !history || history.length === 0 ? (
          <p className="text-center text-[#6b5f6a] mt-6">עוד לא ענית על שאלות. חזרו לסקר.</p>
        ) : (
          <div className="space-y-3">
            {history.map((h) => (
              <div key={h.questionId} className="rounded-2xl bg-black/[0.03] ring-1 ring-black/10 p-4">
                <div className="font-semibold text-[#2a2130] leading-snug">{h.text}</div>
                <div className="mt-2 text-[14px] text-[#4a3f4a]">
                  בחרת: <b className="text-[#2a2130]">{h.chosenLabel}</b>
                </div>
                {/* Priors were removed, so a question only you answered would
                    read "100% ענו כמוך" — say what is actually true instead. */}
                <div className="mt-1 text-[14px] text-[#6b5f6a]">
                  {h.totalVotes <= 1 ? (
                    "אתם הראשונים שעונים על השאלה הזו."
                  ) : (
                    <>
                      <b className="text-pink-600">{h.chosenPct}%</b> ענו כמוך · {h.otherPct}% בחרו {h.otherLabel}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Landing. No longer the entry point — reached by pressing back from the
  //    question. Dark ink on the light survey canvas (page.tsx).
  return (
    <div dir="rtl" className="mx-auto max-w-lg px-5 py-10 text-center text-[#2a2130]" style={{ fontFamily: "var(--font-assistant), sans-serif" }}>
      <div
        className="mx-auto mb-6 grid h-[76px] w-[76px] place-items-center rounded-full text-4xl font-extrabold text-white"
        style={{ background: "linear-gradient(95deg, #6C5CE7 0%, #D6409F 52%, #F79154 100%)", boxShadow: "0 16px 30px -14px rgba(214,64,159,.6)" }}
      >
        ✓
      </div>
      {/* No cadence promise in the copy: there is no daily send, and the survey
          has no per-day limit. */}
      <h1 className="text-[22px] font-extrabold mb-3 text-[#2a2130]">
        ענו על שאלות הסקר, וראו מיד מה זוגות אחרים בישראל ענו
      </h1>

      <div className="mt-7 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => setView("question")}
          className="inline-block rounded-2xl px-6 py-3.5 font-extrabold text-white text-[16px]"
          style={{ background: "linear-gradient(95deg, #6C5CE7 0%, #D6409F 52%, #F79154 100%)", boxShadow: "0 14px 28px -14px rgba(214,64,159,.5)" }}
        >
          מתחילים ←
        </button>
        <button
          type="button"
          onClick={openHistory}
          className="text-[15px] font-semibold text-[#4a3f4a] underline hover:text-[#2a2130]"
        >
          ההיסטוריה שלי
        </button>
      </div>

      {/* The "קבלת שאלה יומית" toggle was removed (2026-08-03): poll_subscriptions
          is written on signup and read by the page, but nothing sends a daily
          question — no cron, no Brevo sequence. The switch promised a mail that
          does not exist. Table, migration 187 and the /api/poll/subscribe GET are
          all untouched, so restoring the control is UI-only work. */}
    </div>
  );
}
