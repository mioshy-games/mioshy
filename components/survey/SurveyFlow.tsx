"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./survey.module.css";
import { PollRegister } from "./PollRegister";

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

export interface SurveyFlowProps {
  /** Styling only — drop the full-height page chrome so the card sits inside a
   *  host (e.g. the dashboard). Default false = standalone /he/survey page. */
  embedded?: boolean;
  /** Logged-in context: the survey is open to every account (no paywall), so a
   *  signed-in user is already "in" — hide the join CTA + the internal history
   *  toggle (the dashboard owns history). */
  authed?: boolean;
  /** Floating "back" control shown while a question/reveal is on screen.
   *  onClick keeps you in-app (dashboard); href navigates (anon → marketing). */
  back?: { href?: string; onClick?: () => void };
  /** Logged-in user's display name — personalises the invite text
   *  ("{name} מזמין/ה אותך…"). Omitted for anon → generic invite. */
  userName?: string | null;
}

/**
 * Israel Relationship Survey — the question flow (§6): serial question (§7) →
 * anonymous vote → live Bayesian reveal (§8, numbers only) → WhatsApp share.
 * Answering always reveals inline (no navigation). The join CTA is anon-only.
 */
export function SurveyFlow({ embedded = false, authed = false, back, userName }: SurveyFlowProps = {}) {
  const [status, setStatus] = useState<"loading" | "question" | "reveal" | "done">("loading");
  const [question, setQuestion] = useState<Question | null>(null);
  const [yourOption, setYourOption] = useState<"a" | "b" | null>(null);
  const [tally, setTally] = useState<Tally | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Personalised invite (§ share): "{name} מזמין/ה אותך…" for a signed-in user,
  // generic otherwise.
  const inviteText = userName
    ? `${userName} מזמין/ה אותך להצטרף לסקר הזוגיות של ישראל`
    : "הוזמנת להצטרף לסקר הזוגיות של ישראל";

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
      // Always reveal inline — never navigate away (§ stay put; the dashboard
      // keeps signed-in users on the dashboard).
      setYourOption(d.yourOption);
      setTally({ pctA: d.pctA, pctB: d.pctB, totalVotes: d.totalVotes });
      setStatus("reveal");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch { /* stay on question */ } finally { setBusy(false); }
  };

  const surveyUrl = () =>
    typeof window !== "undefined" ? `${window.location.origin}/he/survey` : "https://mioshy.com/he/survey";

  const share = () => {
    if (typeof window === "undefined") return;
    const q = question?.text ? `\n${question.text}` : "";
    const msg = `${inviteText} 💜${q}\nתענו ותראו מה זוגות בישראל ענו: ${surveyUrl()}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  };

  const copyLink = async () => {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(`${inviteText}\n${surveyUrl()}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked — no-op */ }
  };

  const toggleHistory = async () => {
    if (history) { setHistory(null); return; }
    const d = await fetch("/api/poll/history").then((r) => (r.ok ? r.json() : { history: [] })).catch(() => ({ history: [] }));
    setHistory(d.history ?? []);
  };

  // Floating "back" control — shown whenever a question/reveal is on screen.
  const backBtn =
    back && !showRegister && (status === "question" || status === "reveal") ? (
      back.onClick ? (
        <button type="button" className={styles.backBtn} onClick={back.onClick} aria-label="חזרה">
          <span aria-hidden>→</span>
        </button>
      ) : (
        <a href={back.href} className={styles.backBtn} aria-label="חזרה">
          <span aria-hidden>→</span>
        </a>
      )
    ) : null;

  return (
    <div className={embedded ? styles.embed : styles.page} dir="rtl">
      {backBtn}
      <div className={styles.card}>
        {!authed && showRegister && <PollRegister onBack={() => setShowRegister(false)} />}

        {!showRegister && status === "loading" && <p className={styles.center}>טוען…</p>}

        {!showRegister && status === "done" && (
          <section className={styles.fade}>
            <p className={styles.center}>ענית על כל השאלות שיש כרגע 💜 חזרו מחר לשאלה חדשה.</p>
            {!authed && (
              <button type="button" className={styles.linkbtn} onClick={toggleHistory}>
                {history ? "סגירת ההיסטוריה" : "ההיסטוריה שלי"}
              </button>
            )}
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

            {/* Join CTA (§6) — anon only; a signed-in user is already in. */}
            {!authed && (
              <button type="button" className={`${styles.cta} ${styles.amber}`} onClick={() => setShowRegister(true)}>
                רוצים שאלה כזו כל יום? הצטרפו
              </button>
            )}
            {/* Share (§ invite) — WhatsApp + copy-link with "הועתק" feedback. */}
            <div className={styles.shareRow}>
              <button type="button" className={styles.shareBtn} onClick={share}>
                <span aria-hidden>💬</span> שתפו בוואטסאפ
              </button>
              <button type="button" className={styles.shareBtn} onClick={copyLink}>
                <span aria-hidden>{copied ? "✓" : "🔗"}</span> {copied ? "הועתק" : "העתק לינק הזמנה"}
              </button>
            </div>
          </section>
          );
        })()}

        {!authed && !showRegister && history && (
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
