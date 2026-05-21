"use client";

/**
 * AdultsPricingPanel - the commerce surface on the /[locale]/adults/[slug]
 * game detail page. Replaces the old single-tier PairAndPurchasePanel with
 * three tiers:
 *
 *   1. Single - one-time per-game purchase (calls stubPurchaseGame)
 *   2. Monthly - couple-scoped recurring sub (subscribeAdultsTier('monthly'))
 *   3. Annual - couple-scoped recurring sub + bonus game slot (subscribeAdultsTier('annual'))
 *
 * Keeps the existing behaviour that once a couple already owns the game
 * (via any tier), we just show the play CTA + invite-partner block. The
 * couple pairing flow is unchanged - subscribing auto-creates the couple
 * server-side the same way stubPurchaseGame does.
 */

import { useState, useTransition } from "react";
import { useRouter, Link } from "@/navigation";
import {
  Check,
  Crown,
  Flame,
  Heart,
  Lock,
  Play,
  Sparkles,
  Star,
} from "@/components/icons/Icons";
import { stubPurchaseGame } from "@/app/actions/between-us-couple";
import { subscribeAdultsTier } from "@/app/actions/adults-subscribe";
import type { AdultsPricing } from "@/lib/adults/pricing";
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

type SelectedTier = "single" | "monthly" | "annual";

export function AdultsPricingPanel({
  locale,
  gameId,
  gameSlug,
  gameTitle,
  pricing,
  ctx,
  loggedIn,
  loginHref,
  pendingInvitation,
}: {
  locale: string;
  gameId: string;
  /** Slug of the game - required so the post-purchase CTA can route the
   *  owner straight into the gated play surface (`/adults/[slug]/play`). */
  gameSlug: string;
  gameTitle: string;
  pricing: AdultsPricing;
  ctx: Ctx | null;
  loggedIn: boolean;
  loginHref: string;
  pendingInvitation: InvitationSummary | null;
}) {
  const isHe = locale === "he";
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<SelectedTier>(
    // Default to the "flagship" tier visible to the user. Prefer annual
    // (the featured plan) when enabled; else monthly; else single.
    pricing.annual.enabled
      ? "annual"
      : pricing.monthly.enabled
        ? "monthly"
        : "single",
  );
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const isOwner = !ctx?.couple_id || ctx?.role === "owner";
  const canInvite = isOwner && (ctx?.partner_count ?? 0) < 2;

  // ── Not signed in ────────────────────────────────────────────────
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
                ? "התחברו כדי לפתוח את המשחק ולשתף אותו עם הפרטנר/ית."
                : "Sign in to unlock this game and share it with your partner."}
            </p>
            <a
              href={loginHref}
              className="mt-4 inline-block rounded-full bg-gradient-to-r from-rose-500 to-amber-500 px-5 py-2 text-sm font-semibold text-white shadow hover:brightness-110"
            >
              {isHe ? "התחברות" : "Sign in"}
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── Already entitled → play CTA + invite partner ─────────────────
  if (ctx?.entitled) {
    return (
      <div className="space-y-4">
        <Link
          // Route the owner straight into THIS game's gated play surface,
          // not the global hub. They came here for one specific game; one
          // click away from the actual product is the correct UX.
          href={`/mioshy-sex/${gameSlug}/play`}
          className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-rose-500 via-red-500 to-amber-500 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-rose-500/30 transition hover:brightness-110"
        >
          <Play className="h-5 w-5" />
          {isHe ? "פתחו את המשחק" : "Open game"}
        </Link>

        {(ctx.partner_count < 2 || pendingInvitation) && (
          <div className="rounded-3xl border border-white/15 bg-white/5 p-6 backdrop-blur">
            <h4 className="text-sm font-semibold text-white">
              {isHe
                ? "רוצים לשחק יחד? הזמינו את הפרטנר/ית"
                : "Want to play together? Invite your partner"}
            </h4>
            <p className="mt-1 text-sm text-white/70">
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

  async function handlePurchase() {
    setError(null);
    setInfo(null);
    start(async () => {
      if (selected === "single") {
        const res = await stubPurchaseGame(gameId);
        if (!res.ok) {
          if (handleGatedError(res.error, window.location.pathname)) return;
          setError(res.error);
          return;
        }
        setInfo(
          isHe
            ? res.already_owned
              ? "כבר היה לכם גישה למשחק הזה - מעבירים ל'מיאושי שלי'…"
              : "הרכישה הושלמה - מעבירים ל'מיאושי שלי'…"
            : res.already_owned
              ? "You already owned this game - taking you to My Mioshy…"
              : "Purchase complete - taking you to My Mioshy…",
        );
        setTimeout(
          () => router.push(`/my?purchased=${encodeURIComponent(gameId)}`),
          650,
        );
        return;
      }

      // monthly / annual
      const res = await subscribeAdultsTier(selected);
      if (!res.ok) {
        if (handleGatedError(res.error, window.location.pathname)) return;
        setError(res.error);
        return;
      }
      setInfo(
        isHe
          ? selected === "annual"
            ? "המינוי הזוגי השנתי הופעל - מעבירים ל'מיאושי שלי'…"
            : "המינוי הזוגי הופעל - מעבירים ל'מיאושי שלי'…"
          : selected === "annual"
            ? "Annual couple plan active - taking you to My Mioshy…"
            : "Couple plan active - taking you to My Mioshy…",
      );
      setTimeout(() => router.push(`/my?subscribed=${selected}`), 650);
    });
  }

  const ctaLabel =
    pending
      ? isHe
        ? "מעבדים…"
        : "Processing…"
      : selected === "single"
        ? isHe
          ? `רכישה אישית · ${pricing.single.displayPrice}`
          : `Buy · ${pricing.single.displayPrice}`
        : selected === "monthly"
          ? isHe
            ? `מינוי זוגי · ${pricing.monthly.displayPrice}${pricing.monthly.periodLabel}`
            : `Couple plan · ${pricing.monthly.displayPrice}${pricing.monthly.periodLabel}`
          : isHe
            ? `מינוי זוגי שנתי · ${pricing.annual.displayPrice}${pricing.annual.periodLabel}`
            : `Annual couple plan · ${pricing.annual.displayPrice}${pricing.annual.periodLabel}`;

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-rose-300/30 bg-gradient-to-br from-rose-600/20 via-red-600/10 to-amber-500/10 p-6 backdrop-blur">
        <div className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-rose-200" />
          <h3 className="text-lg font-semibold">
            {isHe ? "בחרו מסלול" : "Pick your plan"}
          </h3>
        </div>
        <p className="mt-1 text-sm text-white/75">
          {isHe
            ? "רכישה אישית חד-פעמית, או מינוי זוגי - שניכם נהנים."
            : "One-time personal purchase, or a couple plan - both of you enjoy it."}
        </p>

        <div className="mt-5 space-y-3">
          {pricing.single.enabled ? (
            <TierOption
              selected={selected === "single"}
              onSelect={() => setSelected("single")}
              icon={<Star className="h-4 w-4" />}
              title={isHe ? "רכישה אישית" : "Personal purchase"}
              price={pricing.single.displayPrice}
              period=""
              hint={
                isHe
                  ? "גישה למשחק אחד - לכם אישית, לצמיתות"
                  : "Access to this one game - yours forever"
              }
            />
          ) : null}
          {pricing.monthly.enabled ? (
            <TierOption
              selected={selected === "monthly"}
              onSelect={() => setSelected("monthly")}
              icon={<Sparkles className="h-4 w-4" />}
              title={isHe ? "מינוי זוגי" : "Couple plan"}
              price={pricing.monthly.displayPrice}
              period={pricing.monthly.periodLabel}
              hint={
                isHe
                  ? "כל אחד פותח משחק אחד בחודש · 2 משחקים ביחד · ניתן לעצור בכל עת"
                  : "Each of you unlocks 1 game/month · 2 together · cancel anytime"
              }
            />
          ) : null}
          {pricing.annual.enabled ? (
            <TierOption
              selected={selected === "annual"}
              onSelect={() => setSelected("annual")}
              icon={<Crown className="h-4 w-4" />}
              title={isHe ? "מינוי זוגי שנתי" : "Annual couple plan"}
              price={pricing.annual.displayPrice}
              period={pricing.annual.periodLabel}
              hint={
                isHe
                  ? "כמו החודשי · 24 משחקים לשניכם בשנה + בונוס"
                  : "Like monthly · 24 games together per year + a bonus game"
              }
              featured
            />
          ) : null}
        </div>

        <button
          type="button"
          disabled={pending}
          onClick={handlePurchase}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-rose-500 via-red-500 to-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-500/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {selected === "annual" ? <Crown className="h-4 w-4" /> : null}
          {ctaLabel}
        </button>
        <p className="mt-3 text-sm text-white/55">
          {isHe
            ? "* בשלב זה מדובר ברכישת הדגמה - ללא חיוב אמיתי."
            : "* Demo checkout - no real charge yet."}
        </p>
      </div>

      {/* Partner invitation surface (owner only, before couple is full). */}
      {ctx?.couple_id && (ctx.partner_count < 2 || pendingInvitation) ? (
        <div className="rounded-3xl border border-white/15 bg-white/5 p-6 backdrop-blur">
          <h4 className="text-sm font-semibold text-white">
            {isHe ? "הזמינו את הפרטנר/ית" : "Invite your partner"}
          </h4>
          <p className="mt-1 text-sm text-white/70">
            {isHe
              ? "הפרטנר/ית יקבלו קישור להצטרף לחלל הזוגי. כל מה שתרכשו פתוח לשניכם."
              : "They'll get a link to join your couple space. Everything you buy is shared."}
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

      <p className="text-center text-sm text-white/50">
        <Flame className="me-1 inline h-3 w-3" />
        {isHe
          ? selected === "single"
            ? "רכישה אישית - גישה מלאה למשחק הזה."
            : "מינוי זוגי - ביטול בכל עת, בלי התחייבות."
          : selected === "single"
            ? "Personal purchase - full access to this game."
            : "Couple plan - cancel anytime, no commitment."}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function TierOption({
  selected,
  onSelect,
  icon,
  title,
  price,
  period,
  hint,
  featured,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  price: string;
  period: string;
  hint: string;
  featured?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative flex w-full items-start gap-3 rounded-2xl border p-4 text-start transition ${
        selected
          ? "border-amber-300/60 bg-white/10 ring-2 ring-amber-400/40"
          : "border-white/15 bg-white/[0.04] hover:border-white/30 hover:bg-white/[0.08]"
      }`}
    >
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          selected
            ? "bg-gradient-to-br from-amber-400 to-rose-500 text-white"
            : "bg-white/10 text-white/80"
        }`}
      >
        {selected ? <Check className="h-4 w-4" /> : icon}
      </span>
      <span className="flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold text-white">{title}</span>
          <span className="inline-flex items-baseline gap-0.5 text-base font-bold text-white">
            {price}
            {period ? (
              <span className="text-xs font-medium text-white/65">
                {period}
              </span>
            ) : null}
          </span>
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-white/70">
          {hint}
        </span>
      </span>
      {featured ? (
        <span className="absolute -top-2 end-3 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-rose-500 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-white shadow">
          <Crown className="h-2.5 w-2.5" />
          Best
        </span>
      ) : null}
    </button>
  );
}
