"use client";

import { useState } from "react";
import styles from "./survey.module.css";
import { pollSignup } from "@/app/actions/poll-signup";
import { metaEventId } from "@/lib/analytics/meta-event-id";

/**
 * Screen 3 — join the daily poll (§6). Full form: name, email, phone, password,
 * marketing opt-in (default on), terms (required). On success the session is set
 * server-side; we fire the browser-side Meta CompleteRegistration with the CAPI
 * event_id for dedup (§9א), then land on the dashboard survey page.
 */
export function PollRegister() {
  const [mode, setMode] = useState<"register" | "login">("register");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  // Marketing consent is OFF by default — no pre-checked consent (§5).
  const [marketing, setMarketing] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // §6 — "submit form" Lead on the browser Pixel, deduped with the server CAPI
    // Lead via the shared event_id (keyed by email).
    const leadEventId = metaEventId.lead(email.trim().toLowerCase());
    if (mode === "register" && typeof window !== "undefined") {
      const fbq = (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq;
      if (fbq) fbq("track", "Lead", { content_name: "survey_join_form" }, { eventID: leadEventId });
    }
    try {
      const r = await pollSignup({ email, password, fullName, phone, mode, marketingConsent: marketing, termsAccepted: terms, leadEventId });
      if (!r.success) { setError(r.error); setBusy(false); return; }
      // §9א — browser Pixel CompleteRegistration, deduped by the CAPI event_id.
      if (mode === "register" && r.capiEventId && typeof window !== "undefined") {
        const fbq = (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq;
        // Same content_name as the CAPI event (server sends "relationship_survey")
        // so the deduped browser+server pair carries a consistent source tag.
        if (fbq) fbq("track", "CompleteRegistration", { content_name: "relationship_survey" }, { eventID: r.capiEventId });
      }
      window.location.href = "/he/my/survey"; // land on the dashboard survey page
    } catch {
      setError("שגיאה. נסו שוב.");
      setBusy(false);
    }
  };

  return (
    <section className={styles.fade}>
      <div className={styles.hLead}>
        הצטרפו ל<span className={styles.em}>סקר הזוגיות של ישראל</span>
      </div>
      <div className={styles.sLead}>
        כל יום שאלה אחת על הזוגיות שלכם. פותח נושאי שיחה חדשים, ומזמין אתכם לדבר על דברים שלא העזתם. הכי כיף לענות יחד.
      </div>

      <form className={styles.joinform} onSubmit={submit}>
        {mode === "register" && (
          <>
            {/* Visible labels above each field, matching the post-assessment
                signup (AuthField) look — adapted to this light card's ink. */}
            <div className={styles.fldGroup}>
              <label className={styles.fldLabel} htmlFor="poll_name">שם</label>
              <input id="poll_name" className={styles.fld} type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required />
            </div>
            <div className={styles.fldGroup}>
              <label className={styles.fldLabel} htmlFor="poll_phone">טלפון נייד</label>
              <input id="poll_phone" className={styles.fld} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" required />
            </div>
          </>
        )}
        <div className={styles.fldGroup}>
          <label className={styles.fldLabel} htmlFor="poll_email">אימייל</label>
          <input id="poll_email" className={styles.fld} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </div>
        <div className={styles.fldGroup}>
          <label className={styles.fldLabel} htmlFor="poll_password">סיסמה</label>
          <input id="poll_password" className={styles.fld} type="password" placeholder="לפחות 8 תווים" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={8} />
        </div>

        {mode === "register" && (
          <>
            {/* §5 — legal terms first (required), marketing consent below and
                NOT pre-checked. */}
            <label className={styles.consent}>
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
              קראתי ואני מאשר/ת את תנאי השימוש של האתר
            </label>
            <label className={styles.consent}>
              <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
              מאשר לקבל טיפים ותוכן שיווקי מהמומחים של מיאושי במייל ובוואטסאפ.
            </label>
          </>
        )}

        {error && <div className={styles.err}>{error}</div>}

        <button type="submit" className={`${styles.cta} ${styles.amber}`} style={{ marginTop: 4 }} disabled={busy || (mode === "register" && !terms)}>
          {busy ? "רגע…" : mode === "register" ? "הצטרפות חינם" : "התחברות"}
        </button>
      </form>

      <button type="button" className={styles.linkbtn} onClick={() => { setMode((m) => (m === "register" ? "login" : "register")); setError(null); }}>
        {mode === "register" ? "כבר יש לכם חשבון? התחברות" : "אין לכם חשבון? הצטרפות"}
      </button>
    </section>
  );
}
