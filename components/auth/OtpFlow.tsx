"use client";

import { useEffect, useState } from "react";
import { OtpCodeInput } from "./OtpCodeInput";
import type { OtpConsentCopy } from "@/lib/auth/otp-consent";
import {
  sendAuthSignupOtp,
  verifyAuthSignupOtp,
  saveSignupPhone,
  sendAuthLoginOtp,
  verifyAuthLoginOtp,
} from "@/app/actions/otp-auth";

// Mockup tokens (docs/otp-signup-mockup-v1.html)
const INK = "#2E2622";
const MUT = "#8a7a6b";
const LINE = "#ece2d4";
const GRAD = "linear-gradient(95deg,#6C5CE7 0%,#D6409F 52%,#F79154 100%)";
const SERIF = 'var(--font-frank-ruhl), "Frank Ruhl Libre", serif';

type Step = "form" | "code" | "phone";
const RESEND_SECONDS = 45;

/** Only allow a same-origin relative path as the post-auth destination. */
function safePath(next: string | undefined, fallback: string): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return fallback;
}

/**
 * OtpFlow — the shared passwordless auth UI (mockup screens 1–4). Used on /auth
 * (signup + login) and reused by the survey/assessment/journey surfaces. Consent
 * copy comes in as props (server-resolved, CMS-editable) so no CmsTextProvider
 * is needed here.
 */
export function OtpFlow({
  initialMode,
  locale,
  next,
  consent,
  onAuthenticated,
}: {
  initialMode: "signup" | "login";
  locale: string;
  next?: string;
  consent: OtpConsentCopy;
  /** When set, called after successful auth instead of routing (embedded use). */
  onAuthenticated?: (ctx: { isNewUser: boolean }) => void;
}) {
  const [mode, setMode] = useState<"signup" | "login">(initialMode);
  const [step, setStep] = useState<Step>("form");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  const isHe = locale === "he";

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  const redirectAfterAuth = (isAdmin?: boolean) => {
    if (isAdmin) { window.location.assign("/dashboard"); return; }
    window.location.assign(safePath(next, `/${locale}/my/start`));
  };

  // ── send code ────────────────────────────────────────────────────────────
  const sendCode = async () => {
    setError(null); setBusy(true);
    const r = mode === "signup"
      ? await sendAuthSignupOtp({ email, fullName, termsAccepted: terms })
      : await sendAuthLoginOtp({ email });
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      if (r.code === "no_account") setMode("signup"); // nudge login→signup
      return;
    }
    setCode(""); setStep("code"); setResendIn(RESEND_SECONDS);
  };

  const resend = async () => {
    if (resendIn > 0 || busy) return;
    await sendCode();
  };

  // ── verify code ──────────────────────────────────────────────────────────
  const verify = async (submitted?: string) => {
    const token = (submitted ?? code).replace(/\D/g, "");
    if (token.length !== 6) { setError("יש להזין קוד בן 6 ספרות."); return; }
    setError(null); setBusy(true);
    if (mode === "signup") {
      const r = await verifyAuthSignupOtp({ email, token, fullName, marketingConsent: marketing, termsAccepted: terms, preferredLanguage: locale });
      setBusy(false);
      if (!r.success) { setError(r.error); return; }
      if (onAuthenticated) { onAuthenticated({ isNewUser: true }); return; }
      setStep("phone"); // screen 3
    } else {
      const r = await verifyAuthLoginOtp({ email, token });
      setBusy(false);
      if (!r.success) { setError(r.error); return; }
      if (onAuthenticated) { onAuthenticated({ isNewUser: false }); return; }
      redirectAfterAuth(r.isAdmin);
    }
  };

  // ── phone step ───────────────────────────────────────────────────────────
  const savePhone = async () => {
    setError(null); setBusy(true);
    const r = await saveSignupPhone({ phone });
    setBusy(false);
    if (!r.success) { setError(r.error); return; }
    redirectAfterAuth(false);
  };

  const S = {
    card: { maxWidth: 360, margin: "0 auto", padding: "30px 22px", background: "#fcfaf7", border: `1px solid ${LINE}`, borderRadius: 20 } as const,
    brand: { fontFamily: SERIF, fontWeight: 900, fontSize: 20, textAlign: "center", color: INK, marginBottom: 14 } as const,
    h2: { fontFamily: SERIF, fontWeight: 900, fontSize: 23, textAlign: "center", color: INK, marginBottom: 8 } as const,
    lead: { fontSize: 13.5, color: MUT, textAlign: "center", lineHeight: 1.5, marginBottom: 22 } as const,
    lb: { fontSize: 12.5, fontWeight: 700, color: INK, marginBottom: 6, display: "block" } as const,
    inp: { width: "100%", border: `1.5px solid ${LINE}`, background: "#fff", borderRadius: 13, padding: "13px 15px", fontSize: 15, color: INK, outline: "none" } as const,
    cta: (on: boolean) => ({ display: "block", width: "100%", height: 52, border: 0, cursor: on ? "pointer" : "not-allowed", borderRadius: 13, background: GRAD, color: "#fff", fontWeight: 800, fontSize: 16, opacity: on ? 1 : 0.45, marginTop: 6 } as const),
    ghost: { display: "block", width: "100%", textAlign: "center", background: "none", border: 0, cursor: "pointer", fontSize: 13.5, fontWeight: 700, color: MUT, marginTop: 16 } as const,
    chk: { display: "flex", alignItems: "flex-start", gap: 10, fontSize: 12.5, color: INK, lineHeight: 1.45, cursor: "pointer", marginBottom: 12 } as const,
    err: { marginTop: 12, background: "#fff1f2", border: "1px solid #fecdd3", color: "#be123c", borderRadius: 12, padding: "10px 14px", fontSize: 13.5, textAlign: "center" } as const,
    foot: { marginTop: 20, textAlign: "center", fontSize: 12.5, color: MUT } as const,
    link: { color: "#D6409F", fontWeight: 700, textDecoration: "underline", background: "none", border: 0, cursor: "pointer", font: "inherit" } as const,
  };

  return (
    <div dir="rtl" style={S.card}>
      <div style={S.brand}>מיא<span style={{ background: GRAD, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>ושי</span></div>

      {/* ── screen 1: form ── */}
      {step === "form" && (
        <>
          <h2 style={S.h2}>{mode === "signup" ? "נעים להכיר" : "התחברות"}</h2>
          <p style={S.lead}>{mode === "signup" ? "נתחיל בשני פרטים בלבד. נשלח לכם קוד למייל ותהיו בפנים." : "הזינו את כתובת המייל ונשלח לכם קוד כניסה. בלי סיסמה."}</p>

          {mode === "signup" && (
            <label style={{ display: "block", marginBottom: 14 }}>
              <span style={S.lb}>שם מלא</span>
              <input style={S.inp} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="ישראל ישראלי" autoComplete="name" />
            </label>
          )}
          <label style={{ display: "block", marginBottom: 14 }}>
            <span style={S.lb}>כתובת דוא&quot;ל</span>
            <input style={{ ...S.inp, direction: "ltr", textAlign: "right" }} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" />
          </label>

          {mode === "signup" && (
            <div style={{ margin: "6px 0 4px" }}>
              <label style={S.chk}>
                <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} style={{ marginTop: 2, width: 18, height: 18, accentColor: "#D6409F" }} />
                <span>
                  {consent.termsPrefix}
                  <a href={`/${locale}/terms`} style={{ color: "#D6409F", textDecoration: "underline" }}>{consent.termsLink}</a>
                  {consent.termsAnd}
                  <a href={`/${locale}/privacy`} style={{ color: "#D6409F", textDecoration: "underline" }}>{consent.privacyLink}</a>
                  {consent.termsSuffix}
                </span>
              </label>
              <label style={S.chk}>
                <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} style={{ marginTop: 2, width: 18, height: 18, accentColor: "#D6409F" }} />
                <span style={{ color: MUT }}>{consent.marketingConsent}</span>
              </label>
            </div>
          )}

          <button style={S.cta(mode === "login" || terms)} disabled={busy || (mode === "signup" && !terms) || !email} onClick={sendCode}>
            {busy ? "רגע…" : "שלחו לי קוד"}
          </button>
          {mode === "signup" && !terms && <div style={{ fontSize: 11.5, color: MUT, textAlign: "center", marginTop: 10 }}>לא ניתן להמשיך עד אישור התנאים ומדיניות הפרטיות.</div>}
          {error && <div style={S.err}>{error}</div>}
          <div style={S.foot}>
            {mode === "signup" ? "כבר יש לכם חשבון? " : "אין לכם חשבון עדיין? "}
            <button style={S.link} onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError(null); }}>
              {mode === "signup" ? "התחברות" : "הרשמה"}
            </button>
          </div>
        </>
      )}

      {/* ── screen 2: code ── */}
      {step === "code" && (
        <>
          <h2 style={S.h2}>הזינו את הקוד</h2>
          <p style={S.lead}>שלחנו קוד בן 6 ספרות אל<br /><b style={{ color: INK, direction: "ltr", display: "inline-block" }}>{email}</b></p>
          <div style={{ margin: "6px 0 18px" }}>
            <OtpCodeInput value={code} onChange={setCode} onComplete={(c) => verify(c)} disabled={busy} />
          </div>
          <div style={{ textAlign: "center", fontSize: 12.5, color: MUT, marginBottom: 12, lineHeight: 1.6 }}>
            לא קיבלתם? כדאי להציץ גם בתיקיית הספאם — לפעמים הקוד אוהב להתחבא שם.<br />
            {resendIn > 0
              ? <span>שליחה חוזרת תוך 0:{String(resendIn).padStart(2, "0")}</span>
              : <button style={S.link} onClick={resend} disabled={busy}>שליחה חוזרת</button>}
          </div>
          <button style={S.cta(true)} disabled={busy || code.replace(/\D/g, "").length !== 6} onClick={() => verify()}>{busy ? "רגע…" : "אימות והמשך"}</button>
          {error && <div style={S.err}>{error}</div>}
          <div style={S.foot}>שינוי כתובת המייל? <button style={S.link} onClick={() => { setStep("form"); setError(null); }}>חזרה</button></div>
        </>
      )}

      {/* ── screen 3: phone (signup only) ── */}
      {step === "phone" && (
        <>
          <h2 style={S.h2}>כמעט שם</h2>
          <p style={S.lead}>מוסיפים מספר נייד לסיום ההרשמה. נשתמש בו לחיבור בין בני הזוג ולעדכונים חשובים.</p>
          <label style={{ display: "block", marginBottom: 14 }}>
            <span style={S.lb}>מספר נייד</span>
            <input style={{ ...S.inp, direction: "ltr", textAlign: "right" }} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="050-000-0000" autoComplete="tel" />
          </label>
          <button style={S.cta(true)} disabled={busy || !phone.trim()} onClick={savePhone}>{busy ? "רגע…" : "סיום הרשמה"}</button>
          <button style={S.ghost} onClick={() => redirectAfterAuth(false)} disabled={busy}>דלג/י לעכשיו</button>
          <div style={{ fontSize: 11.5, color: MUT, textAlign: "center", marginTop: 10, lineHeight: 1.4 }}>אפשר לדלג — נבקש את הנייד שוב כשתחברו בן/בת זוג או תרכשו.</div>
          {error && <div style={S.err}>{error}</div>}
        </>
      )}

      {!isHe && null}
    </div>
  );
}
