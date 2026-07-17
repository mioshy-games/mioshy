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
 *   • landing  — join confirmation (§ copy) + daily-question toggle + entry points
 *   • question — the daily question answered IN the dashboard (stays here, §5),
 *                no join CTA (§ already in), floating back → landing
 *   • history  — read-only look back: answered questions + choice + § percentages
 */
export function PollDashboardLanding({
  initialSubscribed,
  userName,
  locale = "he",
  hasShortAssessment = false,
}: {
  initialSubscribed: boolean;
  userName?: string | null;
  locale?: string;
  /** Server-resolved: user already completed the short assessment → suppress the
   *  post-signup assessment-invite popup. */
  hasShortAssessment?: boolean;
}) {
  const [view, setView] = useState<View>("landing");
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<HistItem[] | null>(null);
  const [histLoading, setHistLoading] = useState(false);

  const toggle = async () => {
    setBusy(true);
    const next = !subscribed;
    const r = await fetch("/api/poll/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscribed: next }),
    }).then((x) => x.json()).catch(() => null);
    if (r && typeof r.subscribed === "boolean") setSubscribed(r.subscribed);
    setBusy(false);
  };

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

  // ── Question view: the daily question, in the dashboard. Answering reveals
  //    inline and stays here (§5); back returns to the landing (§4).
  if (view === "question") {
    return <SurveyFlow embedded authed userName={userName} back={{ onClick: () => setView("landing") }} />;
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
          <p className="text-center text-[#6b5f6a] mt-6">עוד לא ענית על שאלות. חזרו ללשאלה של היום.</p>
        ) : (
          <div className="space-y-3">
            {history.map((h) => (
              <div key={h.questionId} className="rounded-2xl bg-black/[0.03] ring-1 ring-black/10 p-4">
                <div className="font-semibold text-[#2a2130] leading-snug">{h.text}</div>
                <div className="mt-2 text-[14px] text-[#4a3f4a]">
                  בחרת: <b className="text-[#2a2130]">{h.chosenLabel}</b>
                </div>
                <div className="mt-1 text-[14px] text-[#6b5f6a]">
                  <b className="text-pink-600">{h.chosenPct}%</b> ענו כמוך · {h.otherPct}% בחרו {h.otherLabel}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Landing (default). Dark ink on the light survey canvas (page.tsx).
  return (
    <div dir="rtl" className="mx-auto max-w-lg px-5 py-10 text-center text-[#2a2130]" style={{ fontFamily: "var(--font-assistant), sans-serif" }}>
      {/* Post-signup invite to the short assessment — shows once, only for users
          who haven't done it yet. A layer above the landing. */}
      <AssessmentInvitePopup locale={locale} hasShortAssessment={hasShortAssessment} />
      <div
        className="mx-auto mb-6 grid h-[76px] w-[76px] place-items-center rounded-full text-4xl font-extrabold text-white"
        style={{ background: "linear-gradient(95deg, #6C5CE7 0%, #D6409F 52%, #F79154 100%)", boxShadow: "0 16px 30px -14px rgba(214,64,159,.6)" }}
      >
        ✓
      </div>
      <h1 className="text-[22px] font-extrabold mb-3 text-[#2a2130]">הצטרפתם! אתם בפנים.</h1>
      <p className="text-[18px] leading-relaxed text-[#4a3f4a] max-w-md mx-auto">
        מעכשיו כל יום תקבלו שאלה אחת על הזוגיות. עונים בכמה שניות, ומיד רואים מה זוגות אחרים בישראל ענו.
      </p>

      <div className="mt-7 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => setView("question")}
          className="inline-block rounded-2xl px-6 py-3.5 font-extrabold text-white text-[16px]"
          style={{ background: "linear-gradient(95deg, #6C5CE7 0%, #D6409F 52%, #F79154 100%)", boxShadow: "0 14px 28px -14px rgba(214,64,159,.5)" }}
        >
          לשאלה של היום ←
        </button>
        <button
          type="button"
          onClick={openHistory}
          className="text-[15px] font-semibold text-[#4a3f4a] underline hover:text-[#2a2130]"
        >
          ההיסטוריה שלי
        </button>
      </div>

      <div className="mt-8 flex items-center justify-center gap-3 text-[15px]">
        <span className="text-[#6b5f6a]">קבלת שאלה יומית</span>
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className={`relative h-7 w-12 rounded-full transition ${subscribed ? "bg-pink-500" : "bg-black/15"}`}
          aria-pressed={subscribed}
        >
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${subscribed ? "right-1" : "right-6"}`} />
        </button>
        <span className="font-bold text-[#2a2130]">{subscribed ? "פעיל" : "כבוי"}</span>
      </div>
    </div>
  );
}
