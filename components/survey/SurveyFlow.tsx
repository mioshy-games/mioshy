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

/**
 * Screens 1–2 of the Israel Relationship Survey: question → live reveal.
 * Anonymous (no registration, §6). The live counter shows the REAL vote total
 * (§13 — never invented); it refreshes by re-polling the server, not by
 * counting up locally. Register / share CTAs land in Stages 6–7.
 */
export function SurveyFlow() {
  const [status, setStatus] = useState<"loading" | "question" | "reveal" | "empty">("loading");
  const [question, setQuestion] = useState<Question | null>(null);
  const [yourOption, setYourOption] = useState<"a" | "b" | null>(null);
  const [tally, setTally] = useState<Tally | null>(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initial load: current question + (if already voted) the reveal.
  useEffect(() => {
    let alive = true;
    fetch("/api/poll/current")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        if (!d.question) { setStatus("empty"); return; }
        setQuestion(d.question);
        if (d.yourOption && d.tally) {
          setYourOption(d.yourOption);
          setTally(d.tally);
          setStatus("reveal");
        } else {
          setStatus("question");
        }
      })
      .catch(() => alive && setStatus("empty"));
    return () => { alive = false; };
  }, []);

  // Live refresh of the real tally while on the reveal (§8 polling).
  const refreshTally = useCallback(() => {
    fetch("/api/poll/current")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.tally) setTally(d.tally); })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (status !== "reveal") return;
    pollRef.current = setInterval(refreshTally, 6000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [status, refreshTally]);

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
    } catch {
      setBusy(false);
    }
  };

  return (
    <div className={styles.page} dir="rtl">
      <div className={styles.logo}>Mioshy</div>
      <div className={styles.pageSub}>סקר הזוגיות של ישראל</div>

      <div className={styles.card}>
        {status === "loading" && <p className={styles.center}>טוען…</p>}

        {status === "empty" && (
          <p className={styles.center}>אין כרגע שאלה פעילה. חזרו בקרוב 🙂</p>
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

            {/* Register / share CTAs — visual per mockup; wired in Stages 6–7. */}
            <button type="button" className={`${styles.cta} ${styles.amber}`}>
              רוצים שאלה כזו כל יום? הצטרפו
            </button>
            <button type="button" className={styles.linkbtn}>שתפו את השאלה בוואטסאפ</button>
          </section>
        )}
      </div>
    </div>
  );
}
