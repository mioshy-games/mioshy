"use client";

// ============================================================
// InvitePartnerByEmail
// ============================================================
// Shared client component for the "invite partner by email" flow.
// Used after purchase on the game detail page, on /my, and in the
// account page. Given a couple_id and (optionally) an existing
// invitation summary, it:
//
//   * if no invite exists → shows email input + "Send invite"
//   * if pending          → shows "Invite sent to …" + resend +
//                            revoke
//   * if accepted         → shows "Partner joined" success state
//
// Owner-only on server. UI-level: `canInvite` decides whether the
// input is rendered at all (e.g. a couple-partner would see the
// read-only pending state but no input).
// ============================================================
import { useState, useTransition } from "react";
import {
  inviteCouplePartnerByEmail,
  revokePendingInvitation,
} from "@/app/actions/couple-invitations";
import {
  Check,
  CheckCircle2,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  Sparkles,
  XCircle,
} from "lucide-react";

export type InvitationSummary = {
  id: string;
  email: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  last_sent_at: string;
  send_count: number;
};

export function InvitePartnerByEmail({
  locale,
  isHe,
  invitation,
  canInvite,
  gameTitle,
  compact,
}: {
  locale: "he" | "en";
  isHe: boolean;
  invitation: InvitationSummary | null;
  canInvite: boolean;
  gameTitle?: string | null;
  compact?: boolean;
}) {
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Locally optimistic: once a revoke or send succeeds we flip state
  // without waiting for the server-rendered parent to re-render.
  const [localInvitation, setLocalInvitation] = useState<
    InvitationSummary | null
  >(invitation);

  const active = localInvitation;

  async function handleSend() {
    setError(null);
    setSuccess(null);
    const target = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(target)) {
      setError(isHe ? "כתובת מייל לא תקינה" : "Invalid email address");
      return;
    }
    start(async () => {
      const res = await inviteCouplePartnerByEmail({
        email: target,
        locale,
        gameTitle: gameTitle ?? null,
      });
      if (!res.ok) {
        // Under OTP a user may reach here without a mobile number. Instead of a
        // dead-end error, send them to the profile collector to add it, then back.
        if (res.error === "profile_incomplete" && typeof window !== "undefined") {
          const back = window.location.pathname + window.location.search;
          window.location.assign(`/${locale}/account/profile?reason=profile_incomplete&next=${encodeURIComponent(back)}`);
          return;
        }
        setError(translateError(res.error, isHe));
        return;
      }
      setSuccess(
        isHe
          ? res.email_dispatched
            ? "ההזמנה נשלחה במייל 💌"
            : "ההזמנה נוצרה - אפשר לשלוח ידנית את הקישור."
          : res.email_dispatched
            ? "Invitation sent by email 💌"
            : "Invitation created - you can share the link manually.",
      );
      setLocalInvitation({
        id: res.invitation_id,
        email: target,
        status: "pending",
        expires_at: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        last_sent_at: new Date().toISOString(),
        send_count: 1,
      });
      setEmail("");
    });
  }

  async function handleResend() {
    if (!active) return;
    setError(null);
    setSuccess(null);
    start(async () => {
      const res = await inviteCouplePartnerByEmail({
        email: active.email,
        locale,
        gameTitle: gameTitle ?? null,
      });
      if (!res.ok) {
        // Under OTP a user may reach here without a mobile number. Instead of a
        // dead-end error, send them to the profile collector to add it, then back.
        if (res.error === "profile_incomplete" && typeof window !== "undefined") {
          const back = window.location.pathname + window.location.search;
          window.location.assign(`/${locale}/account/profile?reason=profile_incomplete&next=${encodeURIComponent(back)}`);
          return;
        }
        setError(translateError(res.error, isHe));
        return;
      }
      setSuccess(
        isHe ? "נשלח שוב במייל ✅" : "Sent again ✅",
      );
      setLocalInvitation({
        ...active,
        last_sent_at: new Date().toISOString(),
        send_count: active.send_count + 1,
      });
    });
  }

  async function handleRevoke() {
    if (!active) return;
    setError(null);
    setSuccess(null);
    start(async () => {
      const res = await revokePendingInvitation(active.id);
      if (!res.ok) {
        // Under OTP a user may reach here without a mobile number. Instead of a
        // dead-end error, send them to the profile collector to add it, then back.
        if (res.error === "profile_incomplete" && typeof window !== "undefined") {
          const back = window.location.pathname + window.location.search;
          window.location.assign(`/${locale}/account/profile?reason=profile_incomplete&next=${encodeURIComponent(back)}`);
          return;
        }
        setError(translateError(res.error, isHe));
        return;
      }
      setSuccess(
        isHe ? "ההזמנה בוטלה." : "Invitation revoked.",
      );
      setLocalInvitation(null);
    });
  }

  // ── Accepted state ────────────────────────────────────────
  if (active?.status === "accepted") {
    return (
      <div
        className={`rounded-2xl border border-emerald-300/40 bg-emerald-400/10 ${
          compact ? "px-3 py-2" : "px-4 py-3"
        } text-sm text-emerald-50`}
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          <span className="font-semibold">
            {isHe ? "הפרטנר/ית הצטרפ/ה" : "Your partner has joined"}
          </span>
        </div>
        <p className="mt-1 text-xs text-emerald-100/80 ltr:text-left rtl:text-right">
          {active.email}
        </p>
      </div>
    );
  }

  // ── Pending state ─────────────────────────────────────────
  if (active?.status === "pending") {
    const lastSent = formatDate(active.last_sent_at, locale);
    return (
      <div
        className={`rounded-2xl border border-fuchsia-300/40 bg-fuchsia-400/10 ${
          compact ? "p-3" : "p-4"
        } text-sm text-white/90`}
      >
        <div className="flex items-start gap-2">
          <Mail className="mt-0.5 h-4 w-4 flex-shrink-0 text-fuchsia-200" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white">
              {isHe ? "הזמנה נשלחה אל" : "Invitation sent to"}
            </p>
            <p
              className="mt-0.5 truncate font-mono text-xs text-fuchsia-100"
              dir="ltr"
            >
              {active.email}
            </p>
            <p className="mt-1 text-sm text-white/60">
              {isHe
                ? `נשלח לאחרונה ב-${lastSent}${
                    active.send_count > 1 ? ` · ${active.send_count} שליחות` : ""
                  }`
                : `Last sent ${lastSent}${
                    active.send_count > 1
                      ? ` · ${active.send_count} sends`
                      : ""
                  }`}
            </p>
            {canInvite ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={handleResend}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20 disabled:opacity-50"
                >
                  {pending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  {isHe ? "שליחה חוזרת" : "Resend"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={handleRevoke}
                  className="inline-flex items-center gap-1.5 rounded-full border border-rose-300/40 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-100 hover:bg-rose-500/20 disabled:opacity-50"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  {isHe ? "ביטול הזמנה" : "Revoke"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
        {error ? <Feedback tone="error">{error}</Feedback> : null}
        {success ? <Feedback tone="success">{success}</Feedback> : null}
      </div>
    );
  }

  // ── No invitation yet ─────────────────────────────────────
  if (!canInvite) {
    return (
      <p className="text-sm text-white/70">
        {isHe
          ? "רק בעל/ת החשבון של החלל הזוגי יכול/ה לשלוח הזמנה."
          : "Only the couple owner can send a partner invitation."}
      </p>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-white/15 bg-white/5 ${
        compact ? "p-3" : "p-4"
      } backdrop-blur`}
    >
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 h-4 w-4 text-fuchsia-200" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">
            {isHe ? "הזמנת בן/בת זוג" : "Invite your partner"}
          </p>
          <p className="mt-0.5 text-xs text-white/70">
            {isHe
              ? "מלאו את המייל של הפרטנר/ית ונשלח להם קישור להצטרפות לחלל הזוגי."
              : "Enter your partner's email - we'll send them a link to join your couple space."}
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
              dir="ltr"
              autoComplete="email"
              placeholder="partner@example.com"
              className="flex-1 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white placeholder-white/40 focus:border-fuchsia-300 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={pending || email.trim().length < 5}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-fuchsia-700 shadow hover:bg-fuchsia-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {isHe ? "שליחה" : "Send"}
            </button>
          </div>
          {error ? <Feedback tone="error">{error}</Feedback> : null}
          {success ? <Feedback tone="success">{success}</Feedback> : null}
        </div>
      </div>
    </div>
  );
}

function Feedback({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
}) {
  if (tone === "error") {
    return (
      <p className="mt-3 rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-100">
        {children}
      </p>
    );
  }
  return (
    <p className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-emerald-300/40 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-100">
      <Check className="h-3 w-3" />
      {children}
    </p>
  );
}

function formatDate(iso: string, locale: "he" | "en"): string {
  try {
    return new Date(iso).toLocaleDateString(
      locale === "he" ? "he-IL" : "en-US",
      { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
    );
  } catch {
    return iso;
  }
}

function translateError(code: string, isHe: boolean): string {
  const map: Record<string, { he: string; en: string }> = {
    login_required: {
      he: "יש להיכנס קודם לחשבון",
      en: "Please sign in first",
    },
    profile_incomplete: {
      he: "יש להשלים את פרטי הפרופיל לפני שליחת הזמנה",
      en: "Complete your profile before inviting a partner",
    },
    invalid_email: { he: "כתובת מייל לא תקינה", en: "Invalid email" },
    cant_invite_self: {
      he: "לא ניתן להזמין את עצמך",
      en: "You can't invite yourself",
    },
    not_couple_owner: {
      he: "רק בעל/ת החשבון יכול/ה לשלוח הזמנה",
      en: "Only the couple owner can invite",
    },
    couple_already_full: {
      he: "החלל הזוגי כבר מלא",
      en: "This couple is already full",
    },
    forbidden: { he: "אין הרשאה", en: "Not allowed" },
    not_found: { he: "ההזמנה לא נמצאה", en: "Invitation not found" },
    not_pending: {
      he: "ההזמנה כבר לא ממתינה",
      en: "Invitation is no longer pending",
    },
    could_not_establish_couple: {
      he: "שגיאה ביצירת חלל זוגי",
      en: "Could not create couple space",
    },
  };
  const entry = map[code];
  if (!entry) return code;
  return isHe ? entry.he : entry.en;
}
