"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./survey.module.css";
import { PollRegister } from "./PollRegister";

/**
 * sessionStorage handoff key. When a vote is cast on the homepage teaser
 * (embedded mode), we stash the reveal payload here and navigate to the
 * dedicated /he/survey page, which reads + clears it and shows the reveal.
 */
const POLL_REVEAL_KEY = "mioshy_poll_reveal";

interface Question {
  id: string;
  text: string;
  optionA: string;
  optionB: string;
  insightLine: string | null;
}
interface Tally {
  pctA: number;
  pctB: number;
  totalVotes: number;
}
interface HistoryRow {
  questionId: string;
  text: string;
  chosen: string;
  answeredAt: string;
}

/**
 * Israel Relationship Survey — public flow (no registration, §6):
 * serial question (§7) → anonymous vote → live Bayesian reveal (§8, numbers
 * only) → WhatsApp share (§7). Register/dashboard land in Stage 6.
 *
 * `embedded` (homepage teaser): no page chrome, and a vote does NOT reveal
 * inline — it POSTs, hands the result off via sessionStorage, and navigates
 * to /he/survey (shared anon cookie) where the reveal is shown.
 */
export function SurveyFlow({ embedded = false }: { embedded?: boolean } = {}) {
  const [status, setStatus] = useState<"loading" | "question" | "reveal" | "done">("loading");
  const [question, setQuestion] = useState<Question | null>(null);
  const [yourOption, setYourOption] = useState<"a" | "b" | null>(null);
  const [tally, setTally] = useState<Tally | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadCurrent = useCallback(() => {
    setTally(null);
    setYourOption(null);
    return fetch("/api/poll/current")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || d.done || !d.question) { setStatus("done"); return; }
        setQuestion(d.question);
        setStatus("question");
      })
      .catch(() => setStatus("done"));
  }, []);

  useEffect(() => {
    // /he/survey (non-embedded): if we arrived straight after voting on the
    // homepage teaser, the vote result was handed off via sessionStorage —
    // show that reveal directly instead of loading the next question. The
    // vote is already recorded server-side (anon cookie).
    if (!embedded && typeof window !== "undefined") {
      try {
        const raw = window.sessionStorage.getItem(POLL_REVEAL_KEY);
        if (raw) {
          window.sessionStorage.removeItem(POLL_REVEAL_KEY);
          const r = JSON.parse(raw) as {
            question: Question;
            yourOption: "a" | "b";
            pctA: number;
            pctB: number;
            totalVotes: number;
          };
          if (r?.question && (r.yourOption === "a" || r.yourOption === "b")) {
            setQuestion(r.question);
            setYourOption(r.yourOption);
            setTally({ pctA: r.pctA, pctB: r.pctB, totalVotes: r.totalVotes });
            setStatus("reveal");
            return;
          }
        }
      } catch { /* malformed handoff → fall through to a normal load */ }
    }
    void loadCurrent();
  }, [loadCurrent, embedded]);

  // Live refresh of the real tally while on the reveal (§8 polling).
  useEffect(() => {
    if (status !== "reveal" || !question) return;
    pollRef.current = setInterval(() => {
      fetch(`/api/poll/tally?questionId=${question.id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d?.totalVotes != null) setTally({ pctA: d.pctA, pctB: d.pctB, totalVotes: d.totalVotes }); })
        .catch(() => {});
    }, 6000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [status, question]);

  const vote = async (option: "a" | "b") => {
    if (!question || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/poll/vote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ questionId: question.id, option }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error ?? "vote_failed");
      // Homepage teaser (embedded): don't reveal inline — hand the result to
      // the dedicated /he/survey page (shared anon cookie) and navigate there.
      if (embedded) {
        try {
          window.sessionStorage.setItem(
            POLL_REVEAL_KEY,
            JSON.stringify({ question, yourOption: d.yourOption, pctA: d.pctA, pctB: d.pctB, totalVotes: d.totalVotes }),
          );
        } catch { /* no sessionStorage → /he/survey just shows the next question */ }
        window.location.href = "/he/survey";
        return;
      }
      setYourOption(d.yourOption);
      setTally({ pctA: d.pctA, pctB: d.pctB, totalVotes: d.totalVotes });
      setStatus("reveal");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch { /* stay on question */ } finally { setBusy(false); }
  };

  const share = () => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/he/survey`;
    const q = question?.text ? `\n${question.text}` : "";
    const msg = `עניתי על "סקר הזוגיות של ישראל" של מיאושי 💜${q}\nתענו גם ותראו מה זוגות בישראל ענו: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  };

  const toggleHistory = async () => {
    if (history) { setHistory(null); return; }
    const d = await fetch("/api/poll/history").then((r) => (r.ok ? r.json() : { history: [] })).catch(() => ({ history: [] }));
    setHistory(d.history ?? []);
  };

  return (
    <div className={embedded ? styles.embed : styles.page} dir="rtl">
      <div className={styles.card}>
        {showRegister && <PollRegister onBack={() => setShowRegister(false)} />}

        {!showRegister && status === "loading" && <p className={styles.center}>טוען…</p>}

        {!showRegister && status === "done" && (
          <section className={styles.fade}>
            <p className={styles.center}>ענית על כל השאלות שיש כרגע 💜 חזרו מחר לשאלה חדשה.</p>
            <button type="button" className={styles.linkbtn} onClick={toggleHistory}>
              {history ? "סגירת ההיסטוריה" : "ההיסטוריה שלי"}
            </button>
          </section>
        )}

        {!showRegister && status === "question" && question && (
          <section className={styles.fade}>
            <div className={styles.q}>{question.text}</div>
            <div className={styles.opts}>
              <button type="button" className={styles.opt} disabled={busy} onClick={() => vote("a")}>
                <span className={styles.optTxt}>{question.optionA}</span>
              </button>
              <button type="button" className={styles.opt} disabled={busy} onClick={() => vote("b")}>
                <span className={styles.optTxt}>{question.optionB}</span>
              </button>
            </div>
          </section>
        )}

        {!showRegister && status === "reveal" && question && tally && yourOption && (() => {
          const chosenLabel = yourOption === "a" ? question.optionA : question.optionB;
          const otherLabel = yourOption === "a" ? question.optionB : question.optionA;
          const chosenPct = yourOption === "a" ? tally.pctA : tally.pctB;
          const otherPct = yourOption === "a" ? tally.pctB : tally.pctA;
          return (
          <section className={styles.fade}>
            <div className={styles.qmeta}>התוצאה שלכם</div>
            <div className={`${styles.q} ${styles.revQ}`}>{question.text}</div>
            <div className={styles.revYour}>
              בחרת: <span>{chosenLabel}</span>
            </div>
            <div className={styles.revLive}>
              <span className={styles.pulse} />
              <span>{tally.totalVotes.toLocaleString("he-IL")}</span> זוגות ענו על זה · מתעדכן עכשיו
            </div>

            {/* Centered big result (§8, mockup screen 2) — the chosen answer's
                percentage as one large gradient number, "כמוך" tag above it,
                "ענו כמוך" below, a divider, then the small "לעומת" comparison.
                Numbers only — no graph/bar. */}
            <div className={styles.revHero}>
              <span className={styles.youtag}>כמוך</span>
              <div className={styles.revBig}>{chosenPct}%</div>
              <div className={styles.revBiglabel}>ענו כמוך: <b>{chosenLabel}</b></div>
              <div className={styles.revVs}>לעומת <b>{otherPct}%</b> שבחרו <b>{otherLabel}</b></div>
            </div>

            {question.insightLine && <p className={styles.insight}>{question.insightLine}</p>}

            {/* Register CTA (§6) — opens the join form. */}
            <button type="button" className={`${styles.cta} ${styles.amber}`} onClick={() => setShowRegister(true)}>
              רוצים שאלה כזו כל יום? הצטרפו
            </button>
            <button type="button" className={styles.linkbtn} onClick={share}>שתפו את השאלה בוואטסאפ</button>
          </section>
          );
        })()}

        {!showRegister && history && (
          <div className={styles.history}>
            <div className={styles.qmeta}>ההיסטוריה שלי</div>
            {history.length === 0 ? (
              <p className={styles.center}>עוד לא ענית על שאלות.</p>
            ) : (
              history.map((h) => (
                <div key={h.questionId} className={styles.histRow}>
                  <div className={styles.histQ}>{h.text}</div>
                  <div className={styles.histA}>בחרת: {h.chosen}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
