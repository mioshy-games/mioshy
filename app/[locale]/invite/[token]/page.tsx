import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Heart, Mail, Sparkles } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getInvitationDisplay } from "@/lib/between-us/invitations";
import { InviteClaimClient } from "@/components/invite/InviteClaimClient";
import { getOtpConsentCopy } from "@/lib/auth/otp-consent";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { locale: string; token: string };
}): Promise<Metadata> {
  const isHe = params.locale === "he";
  return {
    title: `Mioshy - ${isHe ? "הזמנה לחלל הזוגי" : "Couple invitation"}`,
    description: isHe
      ? "הוזמנת להצטרף לחלל הזוגי במיאושי."
      : "You've been invited to join a couple space on Mioshy.",
    robots: { index: false, follow: false },
  };
}

export default async function InviteClaimPage({
  params,
}: {
  params: { locale: string; token: string };
}) {
  const { locale, token } = params;
  const isHe = locale === "he";

  console.log("[invite:VIEW] page hit", {
    locale,
    token_length: token?.length,
    token_preview: token?.slice(0, 8) + "…",
  });

  const display = await getInvitationDisplay(token);
  // ONE approved consent wording for every account-creation point (same source
  // as the signup screen).
  const consent = await getOtpConsentCopy(locale === "en" ? "en" : "he");

  // ── Token invalid / missing ─────────────────────────────────────
  if (!display) {
    console.warn("[invite:NOT_FOUND] token has no row in couple_invitations");
    return (
      <InvalidInvitation
        isHe={isHe}
        reason="not_found"
        locale={locale}
      />
    );
  }

  const { invitation, inviter_full_name } = display;
  console.log("[invite:VIEW] invitation loaded", {
    invitation_id: invitation.id,
    couple_id: invitation.couple_id,
    status: invitation.status,
    expires_at: invitation.expires_at,
    inviter_name: inviter_full_name,
    invitee_email: invitation.invitee_email,
  });

  if (invitation.status === "accepted") {
    // Already accepted - if this is the same user logged in, send to library
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user && user.id === invitation.accepted_by_user_id) {
      redirect(`/${locale}/my`);
    }
    return (
      <InvalidInvitation
        isHe={isHe}
        reason="already_accepted"
        locale={locale}
      />
    );
  }
  if (invitation.status === "revoked") {
    return <InvalidInvitation isHe={isHe} reason="revoked" locale={locale} />;
  }
  if (
    invitation.status === "expired" ||
    new Date(invitation.expires_at).getTime() < Date.now()
  ) {
    return <InvalidInvitation isHe={isHe} reason="expired" locale={locale} />;
  }

  // ── Token valid & pending - show claim flow ─────────────────────
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentUserEmail: string | null = null;
  let currentUserAlreadyInCouple = false;
  if (user) {
    currentUserEmail = user.email ?? null;
    const { data: membership } = await supabase
      .from("couple_members")
      .select("couple_id")
      .eq("user_id", user.id)
      .maybeSingle();
    currentUserAlreadyInCouple = !!membership;
  }

  return (
    <div
      dir={isHe ? "rtl" : "ltr"}
      className="min-h-[100dvh] bg-gradient-to-b from-violet-950 via-fuchsia-950 to-rose-950 text-white"
    >
      <main className="mx-auto flex min-h-[100dvh] max-w-lg flex-col justify-center px-4 py-12">
        <div className="text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 via-purple-500 to-pink-500 shadow-xl shadow-fuchsia-500/30">
            <Heart className="h-7 w-7 text-white" />
          </span>
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-fuchsia-200" />
            <span className="text-white/85">
              {isHe ? "הזמנה אישית" : "Personal invitation"}
            </span>
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            {isHe
              ? `${inviter_full_name || "בן/בת הזוג"} מחכה לך 💜`
              : `${inviter_full_name || "Your partner"} is waiting for you 💜`}
          </h1>
          <p className="mt-3 text-white/80">
            {isHe
              ? "הוזמנת להצטרף לחלל הזוגי במיאושי - כל המשחקים שנרכשו כבר מחכים לשניכם שם."
              : "You've been invited to join a couple space on Mioshy - every game you've both bought is already waiting inside."}
          </p>
        </div>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Mail className="h-4 w-4 text-fuchsia-200" />
            <span>
              {isHe ? "הזמנה נשלחה אל" : "Invitation sent to"}
              <span className="ms-1 font-mono text-white">
                {invitation.invitee_email}
              </span>
            </span>
          </div>

          <div className="mt-6">
            <InviteClaimClient
              isHe={isHe}
              token={token}
              invitedEmail={invitation.invitee_email}
              currentUserEmail={currentUserEmail}
              currentUserAlreadyInCouple={currentUserAlreadyInCouple}
              locale={locale}
              consent={consent}
            />
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-white/50">
          {isHe
            ? "לא ציפית להזמנה? אפשר פשוט לסגור את החלון."
            : "Wasn't expecting this? You can just close this tab."}
        </p>
      </main>
    </div>
  );
}

function InvalidInvitation({
  isHe,
  reason,
  locale,
}: {
  isHe: boolean;
  reason: "not_found" | "expired" | "revoked" | "already_accepted";
  locale: string;
}) {
  const messages: Record<typeof reason, { title: string; body: string }> = {
    not_found: {
      title: isHe ? "הקישור לא תקף" : "This link isn't valid",
      body: isHe
        ? "לא מצאנו הזמנה שמתאימה לקישור הזה. אולי הוא הוקלד לא נכון או שההזמנה נמחקה."
        : "We couldn't find an invitation for this link. It may have been mistyped or removed.",
    },
    expired: {
      title: isHe ? "ההזמנה פגה" : "This invitation has expired",
      body: isHe
        ? "ההזמנה פגה תוקף. בקש/י מבן/בת הזוג לשלוח הזמנה חדשה."
        : "Ask your partner to send a fresh invitation.",
    },
    revoked: {
      title: isHe ? "ההזמנה בוטלה" : "This invitation was revoked",
      body: isHe
        ? "ההזמנה בוטלה על ידי השולח/ת. אפשר לבקש ממנו/ה לשלוח שוב."
        : "The sender revoked this invitation. You can ask them to send another one.",
    },
    already_accepted: {
      title: isHe ? "ההזמנה כבר נוצלה" : "This invitation was already used",
      body: isHe
        ? "ההזמנה כבר שומשה על ידי חשבון אחר. אם זה טעות, פנה/י למי שהזמין אותך."
        : "Another account has already redeemed this invitation.",
    },
  };

  const msg = messages[reason];

  return (
    <div
      dir={isHe ? "rtl" : "ltr"}
      className="min-h-[100dvh] bg-gradient-to-b from-violet-950 via-fuchsia-950 to-rose-950 text-white"
    >
      <main className="mx-auto flex min-h-[100dvh] max-w-lg flex-col justify-center px-4 py-12 text-center">
        <h1 className="text-3xl font-bold tracking-tight">{msg.title}</h1>
        <p className="mt-3 text-white/75">{msg.body}</p>
        <a
          href={`/${locale}`}
          className="mx-auto mt-8 inline-flex items-center justify-center rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-fuchsia-700 shadow hover:bg-fuchsia-100"
        >
          {isHe ? "חזרה למיאושי" : "Back to Mioshy"}
        </a>
      </main>
    </div>
  );
}
