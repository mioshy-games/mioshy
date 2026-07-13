"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./survey.module.css";

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
 * only) → next question / WhatsApp share (§7). Register/dashboard land in Stage 6.
 */
export function SurveyFlow() {
  const [status, setStatus] = useState<"loading" | "question" | "reveal" | "done">("loading");
  const [question, setQuestion] = useState<Question | null>(null);
  const [yourOption, setYourOption] = useState<"a" | "b" | null>(null);
  const [tally, setTally] = useState<Tally | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
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

  useEffect(() => { void loadCurrent(); }, [loadCurrent]);

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
      setYourOption(d.yourOption);
      setTally({ pctA: d.pctA, pctB: d.pctB, totalVotes: d.totalVotes });
      setStatus("reveal");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch { /* stay on question */ } finally { setBusy(false); }
  };

  const next = async () => { setBusy(true); await loadCurrent(); window.scrollTo({ top: 0, behavior: "smooth" }); setBusy(false); };

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
    <div className={styles.page} dir="rtl">
      <div className={styles.logo}>Mioshy</div>
      <div className={styles.pageSub}>סקר הזוגיות של ישראל</div>

      <div className={styles.card}>
        {status === "loading" && <p className={styles.center}>טוען…</p>}

        {status === "done" && (
          <section className={styles.fade}>
            <p className={styles.center}>ענית על כל השאלות שיש כרגע 💜 חזרו מחר לשאלה חדשה.</p>
            <button type="button" className={styles.linkbtn} onClick={toggleHistory}>
              {history ? "סגירת ההיסטוריה" : "ההיסטוריה שלי"}
            </button>
          </section>
        )}

        {status === "question" && question && (
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

        {status === "reveal" && question && tally && yourOption && (
          <section className={styles.fade}>
            <div className={styles.qmeta}>התוצאה שלכם</div>
            <div className={`${styles.q} ${styles.revQ}`}>{question.text}</div>
            <div className={styles.revYour}>
              בחרת: <span>{yourOption === "a" ? question.optionA : question.optionB}</span>
            </div>
            <div className={styles.revLive}>
              <span className={styles.pulse} />
              <span>{tally.totalVotes.toLocaleString("he-IL")}</span> זוגות ענו על זה · מתעדכן עכשיו
            </div>

            <div className={styles.revRow}>
              <div className={styles.revSide}>
                {yourOption === "a" && <div className={styles.youtag}>כמוך</div>}
                <div className={styles.revLab}>{question.optionA}</div>
                <div className={`${styles.revPct} ${yourOption === "a" ? styles.you : styles.dim}`}>{tally.pctA}%</div>
              </div>
              <div className={`${styles.revSide} ${styles.left}`}>
                {yourOption === "b" && <div className={styles.youtag}>כמוך</div>}
                <div className={styles.revLab}>{question.optionB}</div>
                <div className={`${styles.revPct} ${yourOption === "b" ? styles.you : styles.dim}`}>{tally.pctB}%</div>
              </div>
            </div>

            {question.insightLine && <p className={styles.insight}>{question.insightLine}</p>}

            {/* Register CTA — visual per mockup; wired in Stage 6. */}
            <button type="button" className={`${styles.cta} ${styles.amber}`}>
              רוצים שאלה כזו כל יום? הצטרפו
            </button>
            <button type="button" className={styles.linkbtn} onClick={share}>שתפו את השאלה בוואטסאפ</button>
            <button type="button" className={styles.linkbtn} onClick={next} disabled={busy}>לשאלה הבאה ←</button>
          </section>
        )}

        {history && (
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
