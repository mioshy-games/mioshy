"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@/navigation";
import { track } from "@/lib/analytics";
import styles from "./survey.module.css";
import { PollRegister } from "./PollRegister";
import { pollAnonHeaders } from "@/lib/poll/anon-client";
import type { OtpConsentCopy } from "@/lib/auth/otp-consent";

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
   *  signed-in user is already "in" — hide the internal history toggle (the
   *  dashboard owns history) and the end-screen join form. */
  authed?: boolean;
  /** Floating "back" control shown while a question/reveal is on screen.
   *  onClick keeps you in-app (dashboard); href navigates (anon → marketing). */
  back?: { href?: string; onClick?: () => void };
  /** Logged-in user's display name — personalises the invite text
   *  ("{name} מזמין/ה אותך…"). Omitted for anon → generic invite. */
  userName?: string | null;
  /** Unified OTP consent copy (server-resolved) — required for the END-SCREEN
   *  join form (the passwordless register), the only place registration appears.
   *  Omitted for the authed dashboard where that form never shows. */
  consent?: OtpConsentCopy;
  /** Locale for the register flow's links/redirects. */
  locale?: string;
}

/**
 * Israel Relationship Survey — the question flow (§6): serial question (§7) →
 * anonymous vote → live reveal (§8, numbers only) → "next question" → the next
 * unanswered question, with no registration gate and no clock anywhere in
 * between. Identity is the anon cookie mirrored in localStorage
 * (lib/poll/anon-client), so a returning visitor resumes at the first question
 * they have not seen. Registration appears ONLY on the end screen, once the
 * questions run out, as an opt-in to be told when new ones are added.
 */
export function SurveyFlow({ embedded = false, authed: authedProp = false, back, userName, consent, locale = "he" }: SurveyFlowProps = {}) {
  // Snapshot auth at mount. The OTP verify action sets the session cookie, which
  // triggers a Next soft route-refresh that would flip this server prop MID-FLOW
  // — that would unmount PollRegister (killing OtpFlow's phone step) before the
  // user finishes. We only leave the register view on a real reload/redirect
  // (PollRegister.onAuthenticated), so a mid-flow refresh is intentionally ignored.
  const [authed] = useState(authedProp);
  const [status, setStatus] = useState<"loading" | "question" | "reveal" | "done" | "error">("loading");
  const [question, setQuestion] = useState<Question | null>(null);
  const [yourOption, setYourOption] = useState<"a" | "b" | null>(null);
  const [tally, setTally] = useState<Tally | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Personalised invite (§ share): "{name} מזמין/ה אותך…" for a signed-in user,
  // generic otherwise.
  const inviteText = userName
    ? `${userName} מזמין/ה אותך להצטרף לסקר הזוגיות של ישראל`
    : "הוזמנת להצטרף לסקר הזוגיות של ישראל";

  // "Ran out of questions" and "the request failed" are DIFFERENT outcomes and
  // must never share a screen (Itzik 2026-07-30). They used to both land on
  // status "done", whose only content is the signup form — so a dropped mobile
  // connection or a 500 told the user "you answered everything, now register".
  // A failure now shows a retry instead.
  //
  // Promise.resolve() wraps the call so a SYNCHRONOUS throw is caught too:
  // pollAnonHeaders() touches document.cookie / localStorage, which can throw
  // outright in locked-down iOS Safari.
  const loadCurrent = useCallback(() => {
    setTally(null);
    setYourOption(null);
    setStatus("loading");
    return Promise.resolve()
      .then(() => fetch("/api/poll/current", { headers: pollAnonHeaders() }))
      .then((r) => {
        if (!r.ok) throw new Error(`poll_current_http_${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (!d) throw new Error("poll_current_empty_body");
        // Only an explicit server "done" ends the survey.
        if (d.done || !d.question) { setStatus("done"); return; }
        setQuestion(d.question);
        setStatus("question");
      })
      .catch((err) => {
        console.error("[SurveyFlow] could not load the next question", err);
        setStatus("error");
      });
  }, []);

  useEffect(() => { void loadCurrent(); }, [loadCurrent]);

  // Live refresh of the real tally while on the reveal (§8 polling). The number
  // is the true cumulative vote count for THE QUESTION ON SCREEN — it changes
  // between questions because each question has its own count, and it is
  // recomputed from the votes table on every read (never cached, never padded).
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
        headers: pollAnonHeaders({ "content-type": "application/json" }),
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

  // Continuous flow (no clock): the reveal's button pulls the next unanswered
  // question immediately.
  const nextQuestion = () => {
    track("click", { target: "survey_next_question", label: "לשאלה הבאה" });
    void loadCurrent();
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  // Single floating "back" control (§7), pinned to the bottom (§3): dashboard →
  // onClick, anon → href to the marketing page.
  const goBack = () => {
    if (back?.onClick) { back.onClick(); return; }
    if (back?.href && typeof window !== "undefined") { window.location.href = back.href; }
  };

  const showBack = (status === "question" || status === "reveal") && !!back;
  const backBtn = showBack ? (
    <button type="button" className={styles.backBtn} onClick={goBack} aria-label="חזרה">
      <span aria-hidden>→</span>
    </button>
  ) : null;

  // Assessment + share block — permanent, shown under every survey screen
  // (question, reveal, end) rather than only after answering.
  const stickyBlock = status === "loading" ? null : (
    <div className={styles.stickyBlock}>
      {!authed && (
        <Link
          href="/journey/assessment"
          className={styles.diagLink}
          onClick={() =>
            track("click", {
              target: "survey_assessment_link",
              label: "גלו איפה הזוגיות שלכם עומדת, באבחון קצר ←",
            })
          }
        >
          גלו איפה הזוגיות שלכם עומדת, באבחון קצר ←
        </Link>
      )}
      <div className={styles.shareRow}>
        <button type="button" className={styles.shareBtn} onClick={share}>
          <span aria-hidden>💬</span> שתפו בוואטסאפ
        </button>
        <button type="button" className={styles.shareBtn} onClick={copyLink}>
          <span aria-hidden>{copied ? "✓" : "🔗"}</span> {copied ? "הועתק" : "העתק לינק הזמנה"}
        </button>
      </div>
    </div>
  );

  return (
    <div className={embedded ? styles.embed : styles.page} dir="rtl">
      {backBtn}
      <div className={styles.card}>
        {/* §11 — small confidentiality trust line at the top of the survey. */}
        <div className={styles.trust}>🔒 סודיות מובטחת · התשובות שלך אנונימיות ופרטיות</div>

        {status === "loading" && <p className={styles.center}>טוען…</p>}

        {/* Failure — explicitly NOT the end screen. No signup form here: the
            user has not finished anything, the request just failed. */}
        {status === "error" && (
          <section className={styles.fade}>
            <div className={styles.doneHead}>לא הצלחנו לטעון את השאלה</div>
            <p className={styles.doneLead}>
              נראה שהחיבור נפל לרגע. התשובות שכבר עניתם נשמרו.
            </p>
            <button
              type="button"
              className={`${styles.cta} ${styles.amber}`}
              onClick={() => void loadCurrent()}
            >
              נסו שוב
            </button>
          </section>
        )}

        {/* End screen — the questions ran out. The ONLY place registration is
            offered: the site's existing OTP signup (PollRegister → OtpFlow),
            carrying its standard consent block, under a survey-specific title. */}
        {status === "done" && (
          <section className={styles.fade}>
            {authed ? (
              <>
                <div className={styles.doneHead}>עניתם על כל השאלות שיש לנו כרגע.</div>
                <p className={styles.doneLead}>נעדכן אתכם ברגע שנוסיף שאלות חדשות.</p>
              </>
            ) : (
              <>
                {consent && (
                  <PollRegister
                    consent={consent}
                    locale={locale}
                    signupHeading="עניתם על כל השאלות שיש לנו כרגע."
                    signupSubheading="אנחנו מוסיפים שאלות חדשות כל הזמן. השאירו אימייל ונעדכן אתכם כשיהיו חדשות."
                  />
                )}
                <button type="button" className={styles.linkbtn} onClick={toggleHistory}>
                  {history ? "סגירת ההיסטוריה" : "ההיסטוריה שלי"}
                </button>
              </>
            )}
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

        {status === "reveal" && question && tally && yourOption && (() => {
          const chosenLabel = yourOption === "a" ? question.optionA : question.optionB;
          const otherLabel = yourOption === "a" ? question.optionB : question.optionA;
          const chosenPct = yourOption === "a" ? tally.pctA : tally.pctB;
          const otherPct = yourOption === "a" ? tally.pctB : tally.pctA;
          return (
          <section className={styles.fade}>
            <div className={styles.qmeta}>התוצאה שלכם</div>
            <div className={styles.q}>{question.text}</div>
            <div className={styles.revYour}>
              בחרת: <span>{chosenLabel}</span>
            </div>

            {/* Nobody else has answered this question yet — percentages would be
                a meaningless 100%/0%, so say what is actually true. Priors were
                removed, so the numbers are never padded. */}
            {tally.totalVotes <= 1 ? (
              <p className={styles.firstLine}>אתם הראשונים שעונים על השאלה הזו.</p>
            ) : (
              <>
                <div className={styles.revLive}>
                  <span className={styles.pulse} />
                  <span>{tally.totalVotes.toLocaleString("he-IL")}</span> זוגות ענו על זה · מתעדכן עכשיו
                </div>

                {/* Centered big result (§8, mockup screen 2) — the chosen answer's
                    percentage as one large gradient number, "כמוך" tag above it,
                    a divider, then the small "לעומת" comparison. Numbers only. */}
                <div className={styles.revHero}>
                  <span className={styles.youtag}>כמוך</span>
                  <div className={styles.revBig}>{chosenPct}%</div>
                  <div className={styles.revVs}>לעומת <b>{otherPct}%</b> שבחרו <b>{otherLabel}</b></div>
                </div>
              </>
            )}

            {question.insightLine && <p className={styles.insight}>{question.insightLine}</p>}

            {/* Continuous flow (§ no clock): straight on to the next question. */}
            <button
              type="button"
              className={`${styles.cta} ${styles.amber}`}
              onClick={nextQuestion}
            >
              לשאלה הבאה ←
            </button>
          </section>
          );
        })()}

        {stickyBlock}

        {!authed && history && (
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
