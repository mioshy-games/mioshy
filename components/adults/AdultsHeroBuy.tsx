"use client";

/**
 * AdultsHeroBuy — the inline "BIG price + buy" block that lives directly
 * under the short_desc on /adults/[slug].
 *
 * Couple-share flow (the user-defined product spec)
 * ─────────────────────────────────────────────────
 * The buyer is NEVER asked for the partner's email/phone during purchase.
 * Instead, after successful payment we land them right back on this same
 * product page in the *entitled* state, where a 6-char pair code is shown
 * front and centre with a single copy-icon. Tapping copy puts a complete
 * invite payload on the clipboard:
 *
 *     "[partner-locale invite line]
 *      [absolute product URL]
 *      [pair code]"
 *
 * The buyer pastes that into WhatsApp / iMessage / email — whichever
 * channel they prefer. The partner clicks the link, lands on /adults/X,
 * uses the inline "Got an invite? Enter your code" entry point, signs up
 * or signs in if needed (no payment), enters the code, hits confirm, and
 * inherits the couple's entitlement to this game and any future ones.
 *
 * State branches
 * ──────────────
 * • Already entitled → "Open game" CTA + visible pair code + share-by-copy
 * • Signed in, not entitled → click fires purchase, success → back to this
 *   same product page (now in the entitled state above, with the code).
 * • Logged out → click routes to /auth?next=…?continuePurchase=1, page
 *   re-renders with that query, the auto-resume effect below fires the
 *   purchase, then drops them back onto the entitled view.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Link } from "@/navigation";
import {
  ArrowRight,
  Check,
  Copy,
  Loader2,
  Lock,
  Play,
  Sparkles,
} from "lucide-react";
import { startAdultsSinglePurchase } from "@/app/actions/between-us-couple";
import type { AdultsPricing } from "@/lib/adults/pricing";
import { RedeemCodeButton } from "@/components/between-us/RedeemCodeButton";

type Ctx = {
  user_id: string;
  couple_id: string | null;
  /** "owner" | "partner" — only owners can invite. */
  role: "owner" | "partner" | null;
  /** Six-character couple pair_code — the owner shares this with their
   *  partner via any channel (WhatsApp, in person, message). The partner
   *  redeems it via <RedeemCodeButton /> to join the couple and unlock
   *  every game the couple owns — no extra payment. */
  pair_code: string | null;
  partner_count: number;
  entitled: boolean;
};

export function AdultsHeroBuy({
  locale,
  gameId,
  gameSlug,
  gameTitle,
  pricing,
  ctx,
  loggedIn,
}: {
  locale: string;
  gameId: string;
  gameSlug: string;
  /** Title used in the shareable clipboard payload built by PairCodeBlock. */
  gameTitle: string;
  pricing: AdultsPricing;
  ctx: Ctx | null;
  loggedIn: boolean;
}) {
  const isHe = locale === "he";
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Guard the auto-resume effect — fire AT MOST once per mount so a
  // stuck/refreshed page can never double-charge the user.
  const continueFiredRef = useRef(false);

  const gamePath = `/adults/${gameSlug}`;
  const playPath = `/adults/${gameSlug}/play`;

  // ── Auto-resume after auth ─────────────────────────────────────────────
  // When the visitor arrives back here with `?continuePurchase=1` (set by
  // the click-while-logged-out branch below), we re-fire the purchase
  // action they tried before signing in. Adults is now one-time
  // single-game purchase only — no tier query param needed.
  useEffect(() => {
    if (continueFiredRef.current) return;
    if (!loggedIn) return;
    if (ctx?.entitled) return;
    if (searchParams.get("continuePurchase") !== "1") return;
    continueFiredRef.current = true;
    void runPurchase();
    // We intentionally don't list runPurchase / router in deps — refs +
    // closures keep this stable, and we only ever want this to fire on
    // the first render after auth-return.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn, ctx?.entitled]);

  async function runPurchase() {
    setError(null);

    console.log(
      "[AdultsHeroBuy] action.start",
      JSON.stringify({
        game_id: gameId,
        slug: gameSlug,
        locale,
        return_path: gamePath,
      }),
    );

    start(async () => {
      // startAdultsSinglePurchase has TWO success branches:
      //   • bypassed=true  → admin email; entitlement granted server-side,
      //                       no Cardcom round-trip.
      //   • bypassed=false → Cardcom LowProfile session opened; server
      //                       returned a redirect_url. After payment, the
      //                       indicator webhook writes a couple_entitlement
      //                       (source='paid') and bounces the user back to
      //                       /[locale]/adults/[slug] so the entitled state
      //                       renders with the pair code visible.
      // We narrow the discriminated union via the `bypassed` field — that's
      // why this branch checks `res.bypassed` instead of `res.redirect_url`
      // (the latter doesn't exist on the bypass variant and TS rejects it).
      const res = await startAdultsSinglePurchase({
        gameId,
        locale,
        returnPath: gamePath,
      });

      if (!res.ok) {
        console.warn(
          "[AdultsHeroBuy] action.error",
          JSON.stringify({
            game_id: gameId,
            error: res.error,
          }),
        );
        // Auth/profile gates — gracefully redirect with `next=` so the
        // visitor returns to this very page and re-fires automatically.
        if (res.error === "login_required") {
          const next = `${gamePath}?continuePurchase=1`;
          console.log(
            "[AdultsHeroBuy] auth.required → /auth",
            JSON.stringify({ next }),
          );
          router.push(`/${locale}/auth?next=${encodeURIComponent(next)}`);
          return;
        }
        if (res.error === "profile_incomplete") {
          const next = `${gamePath}?continuePurchase=1`;
          console.log(
            "[AdultsHeroBuy] profile.incomplete → /account/profile",
            JSON.stringify({ next }),
          );
          router.push(
            `/${locale}/account/profile?reason=profile_incomplete&next=${encodeURIComponent(
              next,
            )}`,
          );
          return;
        }
        setError(res.error);
        return;
      }

      // ── Branch 1: admin bypass — entitlement already exists ─────────
      if (res.bypassed) {
        console.log(
          "[AdultsHeroBuy] bypass.success → product page",
          JSON.stringify({
            game_id: gameId,
            couple_id: res.couple_id,
            entitlement_id: res.entitlement_id,
          }),
        );
        router.push(`/${locale}${gamePath}`);
        return;
      }

      // ── Branch 2: real Cardcom redirect ─────────────────────────────
      // Hard navigation (window.location) instead of router.push so we
      // exit the Next.js client router cleanly into Cardcom's domain.
      console.log(
        "[AdultsHeroBuy] cardcom.redirect → Cardcom",
        JSON.stringify({
          game_id: gameId,
          checkout_session_id: res.checkout_session_id,
          // Don't log the full URL — it has the LowProfileCode in it which
          // is sensitive. Just log the host so we can confirm the right env.
          redirect_host: tryParseHost(res.redirect_url),
        }),
      );
      window.location.assign(res.redirect_url);
    });
  }

  function handleBuyClick() {
    console.log(
      "[AdultsHeroBuy] click",
      JSON.stringify({
        game_id: gameId,
        slug: gameSlug,
        logged_in: loggedIn,
      }),
    );
    if (!loggedIn) {
      // Logged-out shortcut: skip the server round-trip and route directly
      // to /auth, so the user never sees a flash of "login_required" error.
      const next = `${gamePath}?continuePurchase=1`;
      console.log(
        "[AdultsHeroBuy] not-logged-in → /auth",
        JSON.stringify({ next }),
      );
      router.push(`/${locale}/auth?next=${encodeURIComponent(next)}`);
      return;
    }
    void runPurchase();
  }

  /** Pulls the host out of a URL string for safe logging — never throws. */
  function tryParseHost(u: string): string | null {
    try {
      return new URL(u).host;
    } catch {
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Branch 1 — already entitled.
  // ─────────────────────────────────────────────────────────────────────
  // Owners see (a) the primary "Open game" CTA, and (b) the pair code
  // box. The code is the entire share mechanism — one tap on the copy
  // icon places a fully-formed invite (greeting + product link + code)
  // on the clipboard so the buyer can paste it into ANY channel. We
  // deliberately do NOT collect the partner's email here: the spec is
  // "no partner details requested at any point".
  if (ctx?.entitled) {
    const isOwner = ctx.role === "owner" || !ctx.couple_id;
    const canInvite = isOwner && (ctx.partner_count ?? 0) < 2;

    return (
      <div className="mt-8 space-y-6">
        {/* Primary play CTA */}
        <Link
          href={playPath}
          className="group relative inline-flex min-h-[60px] items-center gap-3 overflow-hidden rounded-full px-9 text-base font-semibold text-white shadow-2xl shadow-emerald-500/30 transition hover:brightness-110"
        >
          <span
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(110deg,#10b981_0%,#14b8a6_45%,#06b6d4_100%)]"
          />
          <span className="relative z-10 inline-flex items-center gap-2">
            <Play className="h-5 w-5" />
            {isHe ? "פתחו את המשחק" : "Open game"}
            <ArrowRight
              className={`h-5 w-5 transition group-hover:translate-x-1 ${
                isHe ? "rotate-180 group-hover:-translate-x-1" : ""
              }`}
            />
          </span>
        </Link>

        {/* Couple share — single visible pair code + smart copy button.
            Partner-side flow:
              1. Receives the WhatsApp/SMS/email message the buyer pasted
              2. Taps the link → arrives at /adults/[slug] (this page)
              3. Hits "קיבלת הזמנה למשחק?" → opens the redeem dialog
              4. Auths if not yet signed in (no payment)
              5. Pastes the 6-char code, hits confirm
              6. Inherits this couple's entitlement → routed to /play */}
        {canInvite && ctx.pair_code ? (
          <PairCodeBlock
            isHe={isHe}
            pairCode={ctx.pair_code}
            gameTitle={gameTitle}
            gameSlug={gameSlug}
            locale={locale}
          />
        ) : null}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // Branch 2 — not entitled. BIG price + single one-time buy CTA.
  // ─────────────────────────────────────────────────────────────────────
  // Per spec: Adults is ONE-TIME purchase only. Site-wide access via
  // monthly/annual subscriptions belongs to Journey, not here. The
  // monthly/annual tier rows that used to live below the buy CTA have
  // been removed; users who want all-of-Adults take the Journey path.
  const singlePrice = pricing.single.displayPrice;

  return (
    <div className="mt-8">
      {/* Primary row: huge serif price + single buy CTA */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <div>
          <span
            className="block text-[12px] font-semibold uppercase tracking-[0.22em] text-rose-200/75"
          >
            {isHe ? "רכישה אישית · לצמיתות" : "Personal purchase · forever"}
          </span>
          <span
            className="mt-1 block bg-gradient-to-br from-white via-rose-100 to-amber-200 bg-clip-text text-[56px] leading-none tracking-tight text-transparent sm:text-[64px]"
            style={{
              fontFamily: "'Frank Ruhl Libre', serif",
              fontWeight: 700,
            }}
          >
            {singlePrice}
          </span>
        </div>

        <button
          type="button"
          disabled={pending}
          onClick={handleBuyClick}
          className="group relative inline-flex min-h-[60px] items-center gap-3 overflow-hidden rounded-full px-9 text-base font-semibold text-white shadow-2xl shadow-rose-600/40 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-80"
        >
          <span
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(110deg,#f43f5e_0%,#ec4899_45%,#a855f7_100%)] bg-[length:220%_100%] mio-adults-buy-shift"
          />
          <span className="relative z-10 inline-flex items-center gap-2">
            {pending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {isHe ? "מעבדים…" : "Processing…"}
              </>
            ) : (
              <>
                {!loggedIn ? <Lock className="h-4 w-4" /> : null}
                {isHe ? "קנו עכשיו" : "Buy now"}
                <ArrowRight
                  className={`h-5 w-5 transition group-hover:translate-x-1 ${
                    isHe ? "rotate-180 group-hover:-translate-x-1" : ""
                  }`}
                />
              </>
            )}
          </span>
        </button>
      </div>

      {/* Reassurance microcopy */}
      <p className="mt-4 text-[13px] leading-snug text-white/55">
        {!loggedIn ? (
          isHe
            ? "תחילה הרשמו / התחברו, ואז תועברו לעמוד התשלום, ולאחריו ישר אל המשחק."
            : "Sign up / sign in first, then complete payment, and we'll take you straight into the game."
        ) : isHe ? (
          "תשלום חד-פעמי · נשאר שלכם לצמיתות · מועברים מיד אל המשחק."
        ) : (
          "One-time payment · yours forever · taken straight to the game."
        )}
      </p>

      {/* "Got an invite?" entry point — for partners who received a
          pair code from the buyer. Clicking opens the redeem dialog;
          on success we route them straight to /adults/[slug]/play
          (instead of the generic /my hub) so they land inside the
          game they were invited to. authNext stays in the public
          gamePath so any auth/profile-completion fallback returns the
          partner to this same page (where they can re-open the redeem
          dialog) — once finished, the dialog itself routes to /play. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
        <span className="text-white/55">
          {isHe ? "קיבלת הזמנה למשחק?" : "Got an invite?"}
        </span>
        <RedeemCodeButton
          isHe={isHe}
          variant="ghost"
          label={isHe ? "הזינו את הקוד" : "Enter your code"}
          redirectTo={playPath}
          authNext={gamePath}
          className="text-rose-200 hover:text-white"
        />
      </div>

      {/* Cross-pillar tease — Journey gives full-site access (incl. all
          Adults games) for a monthly fee. Soft, single line. Goes only
          to authenticated buyers; logged-out users have enough to
          process already with the Buy + Got-an-invite affordances. */}
      {loggedIn ? (
        <div className="mt-5 border-t border-white/10 pt-5">
          <Link
            href="/journey"
            className="inline-flex items-center gap-1.5 text-[13px] text-white/70 underline-offset-4 transition hover:text-white hover:underline"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            {isHe
              ? "רוצים גישה לכל המשחקים? נסו את ליווי מיאושי — מנוי חודשי, גישה לכל האתר."
              : "Want access to everything? Try Mioshy Journey — monthly subscription, full site access."}
          </Link>
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-2xl border border-rose-300/30 bg-rose-500/15 px-4 py-2.5 text-sm text-rose-100"
        >
          {isHe ? "משהו השתבש — " : "Something went wrong — "}
          {error}
        </p>
      ) : null}

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes mio-adults-buy-shift {
              0%, 100% { background-position: 0% 50%; }
              50%      { background-position: 100% 50%; }
            }
            .mio-adults-buy-shift { animation: mio-adults-buy-shift 7s ease-in-out infinite; }
          `,
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * PairCodeBlock — visible 6-character couple pair code + smart copy
 * button. Tapping copy puts a fully-formed invite message on the
 * clipboard so the buyer can paste it into ANY channel (WhatsApp,
 * iMessage, email, Telegram) and the recipient gets context, link,
 * and code without any extra typing on the buyer's side.
 *
 * The shareable payload looks like (Hebrew):
 *
 *     הוזמנת לשחק יחד ב"<game>" 💕
 *     להצטרפות (ללא תשלום נוסף):
 *     https://mioshy.com/he/adults/<slug>
 *     הקוד שלך: ABC123
 *
 * Visual style mirrors the rose / fuchsia palette used by the entitled
 * state's surrounding card so the block reads as a single composition.
 */
function PairCodeBlock({
  isHe,
  pairCode,
  gameTitle,
  gameSlug,
  locale,
}: {
  isHe: boolean;
  pairCode: string;
  gameTitle: string;
  gameSlug: string;
  locale: string;
}) {
  const [copied, setCopied] = useState(false);

  /** Build the full invite payload that lands on the clipboard. We
   *  derive the absolute origin from `window.location` at click-time
   *  (this is a "use client" component, so window is available). When
   *  origin is missing for any reason we still produce a usable
   *  message — the share text degrades gracefully to a relative path. */
  function buildPayload(): string {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const productUrl = `${origin}/${locale}/adults/${gameSlug}`;
    if (isHe) {
      return [
        `הוזמנת לשחק יחד ב"${gameTitle}" 💕`,
        "להצטרפות (ללא תשלום נוסף):",
        productUrl,
        `הקוד שלך: ${pairCode}`,
      ].join("\n");
    }
    return [
      `You're invited to play "${gameTitle}" together 💕`,
      "Join here (no additional payment):",
      productUrl,
      `Your code: ${pairCode}`,
    ].join("\n");
  }

  async function handleCopy() {
    const payload = buildPayload();
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard API may fail on insecure origins / older browsers —
      // fall back to a manual selection prompt instead of crashing.
      try {
        window.prompt(
          isHe ? "העתיקו את הטקסט הבא:" : "Copy the text below:",
          payload,
        );
      } catch {
        /* swallow — last-resort fallback only */
      }
      setCopied(false);
    }
  }

  return (
    <div className="rounded-3xl border border-rose-300/30 bg-gradient-to-br from-rose-500/10 via-fuchsia-500/8 to-violet-600/8 p-5 backdrop-blur">
      <div className="flex items-start gap-2.5">
        <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-200" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white">
            {isHe ? "הזמינו את בן/בת הזוג" : "Invite your partner"}
          </h3>
          <p className="mt-1 text-[12.5px] leading-snug text-white/70">
            {isHe
              ? "זה הקוד ששייך אתכם. לחצו על העתקה — נשמור ללוח גם את הקוד וגם קישור הזמנה מוכן לשליחה בוואטסאפ או מייל. בן/בת הזוג נכנס/ת לקישור, מתחבר/ת, מזין/ה את הקוד — ויש להם גישה."
              : "This is the code that pairs you. Tap copy — we'll put both the code and a ready-to-send invite (link + greeting) on your clipboard. Your partner opens the link, signs in, enters the code, and gets access."}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
          {isHe ? "קוד הצימוד שלכם" : "Your pair code"}
        </p>
        <div className="flex items-stretch gap-2">
          <div
            className="flex flex-1 items-center justify-center rounded-2xl border border-rose-300/40 bg-gradient-to-br from-rose-500/15 via-fuchsia-500/15 to-violet-500/15 px-4 py-3 font-mono text-2xl font-bold tracking-[0.4em] text-white"
            dir="ltr"
            aria-label={isHe ? "קוד הצימוד" : "Pair code"}
          >
            {pairCode}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            aria-label={
              isHe
                ? "העתקת קוד וקישור הזמנה ללוח"
                : "Copy code and invite link"
            }
            className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl border border-white/15 bg-white/10 px-3 text-xs font-semibold text-white transition hover:bg-white/15"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-300" />
                {isHe ? "הועתק" : "Copied"}
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                {isHe ? "העתקה" : "Copy"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

