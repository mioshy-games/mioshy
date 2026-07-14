"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./survey.module.css";
import { PollRegister } from "./PollRegister";
import { PersonalOfferTimer } from "@/components/journey/PersonalOfferTimer";

/**
 * The ISO instant of the NEXT Israel calendar-day start (00:00 Asia/Jerusalem) —
 * the moment the "one question per day" model serves a new question. Measures
 * the live Asia/Jerusalem UTC offset so it's DST-correct year-round.
 */
function nextIsraelMidnightIso(): string {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = dtf.formatToParts(now).reduce<Record<string, string>>((a, x) => { a[x.type] = x.value; return a; }, {});
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  const offsetMin = (asUTC - now.getTime()) / 60000; // Israel offset (+120 / +180)
  const tomorrowWallUTC = Date.UTC(+p.year, +p.month - 1, +p.day + 1, 0, 0, 0);
  return new Date(tomorrowWallUTC - offsetMin * 60000).toISOString();
}

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
        if (!d) { setStatus("done"); return; }
        // §10 — already answered: jump straight to the reveal (choice marked).
        if (d.answered && d.question && (d.yourOption === "a" || d.yourOption === "b")) {
          setQuestion(d.question);
          setYourOption(d.yourOption);
          setTally({ pctA: d.pctA, pctB: d.pctB, totalVotes: d.totalVotes });
          setStatus("reveal");
          return;
        }
        if (d.done || !d.question) { setStatus("done"); return; }
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

  // Single floating "back" control (§7), pinned to the bottom (§3). On the
  // register screen it returns to the reveal; otherwise it follows `back`
  // (dashboard → onClick, anon → href to the marketing page).
  const goBack = () => {
    if (showRegister) { setShowRegister(false); return; }
    if (back?.onClick) { back.onClick(); return; }
    if (back?.href && typeof window !== "undefined") { window.location.href = back.href; }
  };
  // Countdown target — next Israel calendar-day start. Computed once (stable for
  // the reveal's lifetime); the timer itself renders nothing until it mounts.
  const nextQuestionAt = useMemo(() => nextIsraelMidnightIso(), []);

  const showBack = showRegister || ((status === "question" || status === "reveal") && !!back);
  const backBtn = showBack ? (
    <button type="button" className={styles.backBtn} onClick={goBack} aria-label="חזרה">
      <span aria-hidden>→</span>
    </button>
  ) : null;

  return (
    <div className={embedded ? styles.embed : styles.page} dir="rtl">
      {backBtn}
      <div className={styles.card}>
        {/* §11 — small confidentiality trust line at the top of the survey. */}
        <div className={styles.trust}>🔒 סודיות מובטחת · התשובות שלך אנונימיות ופרטיות</div>

        {/* Countdown to the next daily question — shown once answered (reveal),
            reusing the results-page clock (PersonalOfferTimer tiles). */}
        {!showRegister && status === "reveal" && (
          <PersonalOfferTimer endsAt={nextQuestionAt} isHe label="הסקר הבא בעוד" />
        )}

        {!authed && showRegister && <PollRegister />}

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
              <div className={styles.revVs}>לעומת <b>{otherPct}%</b> שבחרו <b>{otherLabel}</b></div>
            </div>

            {question.insightLine && <p className={styles.insight}>{question.insightLine}</p>}

            {/* Join CTA (§6) — anon only; a signed-in user is already in. */}
            {!authed && (
              <button type="button" className={`${styles.cta} ${styles.amber}`} style={{ fontSize: 20 }} onClick={() => setShowRegister(true)}>
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
