/**
 * /[locale]/unsubscribe — public marketing opt-out landing (Itzik 2026-07-16).
 *
 * Compliance flow:
 *   • The email's "להסרה מרשימת הדיוור" link points here with a signed ?u= token
 *     that identifies the recipient (no login).
 *   • We do NOT unsubscribe on GET — email security scanners prefetch links and
 *     would fire a false opt-out. Instead we show ONE confirm button that POSTs
 *     (a server action) and only then records the opt-out ("click + confirm").
 *   • The RFC 8058 List-Unsubscribe-Post header handles the mail client's native
 *     one-click button via /api/unsubscribe (real POST, no scanner risk).
 *   • On success we render a clear confirmation here — never a redirect home.
 */

import { redirect } from "next/navigation";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe-token";
import { performUnsubscribe } from "@/lib/email/unsubscribe";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return { title: "Mioshy — הסרה מרשימת הדיוור", robots: { index: false, follow: false } };
}

const WRAP: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#fcfaf7",
  color: "#2e2622",
  fontFamily: "var(--font-assistant), Assistant, Heebo, system-ui, sans-serif",
  padding: "24px",
};
const CARD: React.CSSProperties = {
  width: "100%",
  maxWidth: 460,
  background: "#fff",
  border: "1px solid #ece2d4",
  borderRadius: 18,
  boxShadow: "0 24px 60px -40px rgba(80,50,35,.4)",
  padding: "34px 28px",
  textAlign: "center",
};

export default async function UnsubscribePage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams?: { u?: string; done?: string };
}) {
  const { locale } = params;
  const isHe = locale !== "en";

  // Confirmed view — reached after the POST redirect. No token needed (it's a
  // static acknowledgement, exposes nothing).
  if (searchParams?.done === "1") {
    return (
      <div style={WRAP} dir={isHe ? "rtl" : "ltr"}>
        <div style={CARD}>
          <div style={{ fontSize: 40, marginBottom: 8 }} aria-hidden>✓</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 10px" }}>
            {isHe ? "הוסרת מרשימת הדיוור" : "You've been unsubscribed"}
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: "#5a5049", margin: 0 }}>
            {isHe
              ? "לא נשלח לך יותר דיוור שיווקי (מייל ו‑WhatsApp). אם זו הייתה טעות, אפשר להצטרף מחדש בכל עת מתוך החשבון."
              : "You will no longer receive marketing messages (email & WhatsApp). Changed your mind? You can re-subscribe any time from your account."}
          </p>
        </div>
      </div>
    );
  }

  const token = (searchParams?.u ?? "").trim();
  const userId = verifyUnsubscribeToken(token);

  // Invalid / missing / unsigned token.
  if (!userId) {
    return (
      <div style={WRAP} dir={isHe ? "rtl" : "ltr"}>
        <div style={CARD}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 10px" }}>
            {isHe ? "הקישור אינו תקין" : "This link isn't valid"}
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: "#5a5049", margin: 0 }}>
            {isHe
              ? "ייתכן שהקישור פג או הועתק חלקית. אפשר לנהל את העדפות הדיוור מתוך החשבון, או להשיב למייל ונסיר אותך ידנית."
              : "The link may have expired or been copied partially. You can manage your preferences from your account, or reply to the email and we'll remove you manually."}
          </p>
        </div>
      </div>
    );
  }

  // The confirm action — server-side; performs the opt-out then shows the
  // confirmation. Bound to `locale` via closure.
  async function confirmUnsubscribe(formData: FormData) {
    "use server";
    const t = String(formData.get("u") ?? "").trim();
    const uid = verifyUnsubscribeToken(t);
    if (uid) await performUnsubscribe(uid);
    redirect(`/${locale}/unsubscribe?done=1`);
  }

  return (
    <div style={WRAP} dir={isHe ? "rtl" : "ltr"}>
      <div style={CARD}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 10px" }}>
          {isHe ? "להסיר אותך מרשימת הדיוור?" : "Unsubscribe from marketing?"}
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: "#5a5049", margin: "0 0 22px" }}>
          {isHe
            ? "לחיצה על הכפתור תסיר אותך מכל הדיוור השיווקי שלנו (מייל ו‑WhatsApp)."
            : "Clicking below removes you from all our marketing messages (email & WhatsApp)."}
        </p>
        <form action={confirmUnsubscribe}>
          <input type="hidden" name="u" value={token} />
          <button
            type="submit"
            style={{
              width: "100%",
              border: 0,
              cursor: "pointer",
              borderRadius: 14,
              padding: "15px 18px",
              fontSize: 17,
              fontWeight: 800,
              color: "#fff",
              background: "linear-gradient(95deg,#6C5CE7 0%,#D6409F 52%,#F79154 100%)",
            }}
          >
            {isHe ? "כן, הסירו אותי מהדיוור" : "Yes, unsubscribe me"}
          </button>
        </form>
      </div>
    </div>
  );
}
