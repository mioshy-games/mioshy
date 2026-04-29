"use client";

import { useState, useTransition } from "react";
import { useRouter, Link } from "@/navigation";
import { stubPurchaseGame } from "@/app/actions/between-us-couple";
import { Heart, Lock, Play } from "lucide-react";
import {
  InvitePartnerByEmail,
  type InvitationSummary,
} from "@/components/between-us/InvitePartnerByEmail";

type Ctx = {
  user_id: string;
  couple_id: string | null;
  role: "owner" | "partner" | null;
  pair_code: string | null;
  display_name: string | null;
  partner_count: number;
  entitled: boolean;
};

export function PairAndPurchasePanel({
  locale,
  gameId,
  gameTitle,
  priceLabel,
  ctx,
  loggedIn,
  loginHref,
  pendingInvitation,
}: {
  locale: string;
  gameId: string;
  gameTitle: string;
  priceLabel: string | null;
  ctx: Ctx | null;
  loggedIn: boolean;
  loginHref: string;
  pendingInvitation: InvitationSummary | null;
}) {
  const isHe = locale === "he";
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!loggedIn) {
    return (
      <div className="rounded-3xl border border-white/15 bg-white/5 p-6 backdrop-blur">
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 h-5 w-5 text-fuchsia-200" />
          <div>
            <h3 className="text-lg font-semibold">
              {isHe ? "התחברות נדרשת" : "Sign in required"}
            </h3>
            <p className="mt-1 text-sm text-white/75">
              {isHe
                ? "התחברו כדי לרכוש את המשחק ולשתף אותו עם הפרטנר/ית."
                : "Sign in to purchase this game and share it with your partner."}
            </p>
            <a
              href={loginHref}
              className="mt-4 inline-block rounded-full bg-fuchsia-500 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-fuchsia-400"
            >
              {isHe ? "התחברות" : "Sign in"}
            </a>
          </div>
        </div>
      </div>
    );
  }

  const isOwner = !ctx?.couple_id || ctx.role === "owner";
  const canInvite = isOwner && (ctx?.partner_count ?? 0) < 2;

  // ── Already entitled → single "Play at My Mioshy" CTA ──────────
  if (ctx?.entitled) {
    return (
      <div className="space-y-4">
        <Link
          href="/my"
          className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 via-purple-500 to-pink-500 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-fuchsia-500/30 transition hover:brightness-110"
        >
          <Play className="h-5 w-5" />
          {isHe ? "לשחק במיאושי שלי" : "Play in My Mioshy"}
        </Link>

        {(ctx.partner_count < 2 || pendingInvitation) && (
          <div className="rounded-3xl border border-white/15 bg-white/5 p-6 backdrop-blur">
            <h4 className="text-sm font-semibold text-white">
              {isHe
                ? "רוצים לשחק יחד? הזמינו את הפרטנר/ית"
                : "Want to play together? Invite your partner"}
            </h4>
            <p className="mt-1 text-xs text-white/70">
              {isHe
                ? "כל התכנים ייפתחו גם עבורו/ה ברגע שיצטרפו."
                : "They'll unlock the full game too the moment they join."}
            </p>
            <div className="mt-4">
              <InvitePartnerByEmail
                locale={isHe ? "he" : "en"}
                isHe={isHe}
                invitation={pendingInvitation}
                canInvite={canInvite}
                gameTitle={gameTitle}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  function handleGatedError(err: string, nextPath: string): boolean {
    if (err === "profile_incomplete") {
      router.push(
        `/account/profile?reason=profile_incomplete&next=${encodeURIComponent(
          nextPath,
        )}`,
      );
      return true;
    }
    if (err === "login_required") {
      router.push(`/auth?next=${encodeURIComponent(nextPath)}`);
      return true;
    }
    return false;
  }

  async function handleBuy() {
    setError(null);
    setInfo(null);
    start(async () => {
      const res = await stubPurchaseGame(gameId);
      if (!res.ok) {
        if (handleGatedError(res.error, window.location.pathname)) return;
        setError(res.error);
        return;
      }
      setInfo(
        isHe
          ? res.already_owned
            ? "כבר היה לכם גישה למשחק הזה — מעבירים ל'מיאושי שלי'…"
            : "הרכישה הושלמה — מעבירים ל'מיאושי שלי'…"
          : res.already_owned
            ? "You already owned this game — taking you to My Mioshy…"
            : "Purchase complete — taking you to My Mioshy…",
      );
      // Send buyer straight into their library so the purchase
      // "lands" on the content they just unlocked.
      setTimeout(
        () => router.push(`/my?purchased=${encodeURIComponent(gameId)}`),
        650,
      );
    });
  }

  return (
    <div className="space-y-4">
      {/* Buy block */}
      <div className="rounded-3xl border border-fuchsia-300/40 bg-gradient-to-br from-fuchsia-500/20 to-violet-500/10 p-6 backdrop-blur">
        <div className="flex items-start gap-3">
          <Heart className="mt-0.5 h-5 w-5 text-fuchsia-200" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold">
              {isHe ? "רכישה לזוג" : "Unlock for you two"}
            </h3>
            <p className="mt-1 text-sm text-white/80">
              {isHe
                ? "רכישה חד-פעמית מעניקה לשניכם גישה מלאה לכל התכנים של המשחק."
                : "A single purchase unlocks the entire game for both of you."}
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={handleBuy}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-fuchsia-700 shadow hover:bg-fuchsia-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending
                ? isHe
                  ? "מעבדים…"
                  : "Processing…"
                : isHe
                  ? `רכישה${priceLabel ? ` · ${priceLabel}` : ""}`
                  : `Buy${priceLabel ? ` · ${priceLabel}` : ""}`}
            </button>
            <p className="mt-3 text-sm text-white/55">
              {isHe
                ? "* בשלב זה מדובר ברכישת הדגמה (ללא חיוב אמיתי)."
                : "* Demo checkout — no real charge is made yet."}
            </p>
          </div>
        </div>
      </div>

      {/* Partner preview — even before purchase the owner can already
          line up who the game is for. Without a couple yet we just
          show a hint; once they buy, a couple is auto-created. */}
      {ctx?.couple_id && (ctx.partner_count < 2 || pendingInvitation) ? (
        <div className="rounded-3xl border border-white/15 bg-white/5 p-6 backdrop-blur">
          <h4 className="text-sm font-semibold text-white">
            {isHe ? "הזמינו את הפרטנר/ית" : "Invite your partner"}
          </h4>
          <p className="mt-1 text-xs text-white/70">
            {isHe
              ? "הפרטנר/ית יקבלו קישור להצטרף לחלל הזוגי. כל רכישה תהיה פתוחה לשניכם."
              : "They'll get a link to join your couple space. Every purchase is shared."}
          </p>
          <div className="mt-4">
            <InvitePartnerByEmail
              locale={isHe ? "he" : "en"}
              isHe={isHe}
              invitation={pendingInvitation}
              canInvite={canInvite}
              gameTitle={gameTitle}
            />
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="rounded-2xl border border-emerald-300/40 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          {info}
        </p>
      ) : null}
    </div>
  );
}
