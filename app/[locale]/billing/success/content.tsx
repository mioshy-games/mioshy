"use client"

import { useEffect, useState } from "react"
import { useSearchParams }      from "next/navigation"
import { useParams }            from "next/navigation"
import { Check, Loader2, AlertTriangle } from "lucide-react"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { postPaymentTarget } from "@/lib/billing/post-payment-target"

type Phase = "loading" | "activating" | "active" | "error"

/**
 * /billing/success — premium landing page after a successful Cardcom
 * payment. Three phases:
 *
 *   1. activating  — polling checkout_sessions.status for "paid"
 *   2. active      — confirmation with auto-redirect to /my (or
 *                    return_path) after 1.4s
 *   3. error       — checkout failed, offer retry / support
 *
 * Visual language: wine + cream gradient on dark, single Lucide check
 * glyph (no emoji), generous whitespace, a clear primary CTA.
 *
 * Redesigned 2026-05-07 (Itzik #64) — old version used 🎉 emoji + a
 * rainbow gradient and read as childish.
 */
export function BillingSuccessContent() {
  const searchParams = useSearchParams()
  const params       = useParams()
  const locale       = (params?.locale as string) ?? "he"
  const isHe         = locale === "he"

  // Guard against the double-encoded session_id bug:
  // If session_id value looks like a URL path (contains "/"), extract the
  // real UUID that appears before any "?" or "/" in the value.
  const rawSessionId = searchParams.get("session_id") ?? ""
  const sessionId    = rawSessionId.split(/[?/]/)[0] ?? ""

  // Itzik 2026-05-27: return_path support intentionally removed.
  // ALL post-payment landings go to /my so the buyer immediately sees the
  // top-of-page PartnerShareCard. /api/billing/checkout/create still
  // accepts return_path in the body for backwards-compat with existing
  // callers (Adults purchase passes its slug), but billing/success
  // ignores it on purpose.

  const [phase, setPhase]       = useState<Phase>("loading")
  const [attempts, setAttempts] = useState(0)
  // F3.2 — the purchased pillar, so a journey buyer continues straight into
  // the (full) assessment instead of /my (locked decision A).
  const [product, setProduct]   = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) { setPhase("error"); return }

    const MAX_ATTEMPTS = 18
    let cancelled = false

    async function poll() {
      const supabase = createBrowserSupabaseClient()
      const { data } = await supabase
        .from("checkout_sessions")
        .select("status, product")
        .eq("id", sessionId)
        .maybeSingle()

      if (cancelled) return

      if (data?.product) setProduct(data.product as string)

      if (data?.status === "paid") {
        setPhase("active")
        return
      }

      if (data?.status === "failed") {
        setPhase("error")
        return
      }

      setAttempts(a => {
        const next = a + 1
        if (next >= MAX_ATTEMPTS) {
          // Treat as success after timeout - the webhook may still be on its way.
          setPhase("active")
          return next
        }
        setTimeout(poll, 3000)
        return next
      })
    }

    setPhase("activating")
    void poll()
    return () => { cancelled = true }
  }, [sessionId])

  // Auto-redirect once the session flips to paid.
  // Itzik 2026-05-27: ALWAYS land on /my after payment regardless of
  // return_path. Rationale: /my is the only surface that prominently
  // shows the pair_code share widget at the top, which is the very
  // next action a new subscriber needs to take. Sending them deep into
  // a product page (which is what return_path used to do for Adults
  // one-time purchases) hid that widget and lost partner-pair conversion.
  // The safeReturnPath is intentionally unused below.
  // F3.2 — journey-funnel buyers continue IMMEDIATELY into the assessment so
  // they finish the full set ("2 more minutes"); all other pillars land on /my.
  const target = postPaymentTarget(product, locale)

  useEffect(() => {
    if (phase !== "active") return
    const t = setTimeout(() => {
      window.location.assign(target)
    }, 1800)
    return () => clearTimeout(t)
  }, [phase, target])

  const t = isHe
    ? {
        activatingTitle: "מאמתים את התשלום",
        activatingSub:   (n: number) =>
          n > 0
            ? `מקבלים אישור מקארדקום… (בדיקה ${n})`
            : "מקבלים אישור מקארדקום",
        activeTitle:     "התשלום אושר",
        activeSub:       "מעבירים אתכם לחדר הפרטי שלכם",
        activeNote:      "תוכלו לבטל בכל רגע מהחשבון.",
        goAccount:       "מיאושי שלי",
        errTitle:        "התשלום לא עבר",
        errSub:          "ייתכן שהאשראי נדחה או שאירעה שגיאה זמנית. תוכלו לנסות שוב או לכתוב אלינו ונעזור.",
        errRetry:        "ניסיון נוסף",
        errSupport:      "צרו קשר",
        backHome:        "חזרה לדף הבית",
      }
    : {
        activatingTitle: "Verifying your payment",
        activatingSub:   (n: number) =>
          n > 0
            ? `Confirming with Cardcom… (check ${n})`
            : "Confirming with Cardcom",
        activeTitle:     "Payment confirmed",
        activeSub:       "Taking you to your private space",
        activeNote:      "You can cancel anytime from your account.",
        goAccount:       "Open My Mioshy",
        errTitle:        "Payment didn't go through",
        errSub:          "The card may have been declined or a temporary issue occurred. You can try again or contact us and we'll help.",
        errRetry:        "Try again",
        errSupport:      "Contact us",
        backHome:        "Back to home",
      }

  return (
    <div
      dir={isHe ? "rtl" : "ltr"}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-16 text-center"
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, #2a1620 0%, #0E0810 60%, #0E0810 100%)",
      }}
    >
      {/* Soft halo behind the card to draw the eye to the centre */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, #B83C4D 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        {phase === "loading" || phase === "activating" ? (
          <ActivatingView
            title={t.activatingTitle}
            sub={t.activatingSub(attempts)}
          />
        ) : phase === "active" ? (
          <ActiveView
            isHe={isHe}
            title={t.activeTitle}
            sub={t.activeSub}
            note={t.activeNote}
            ctaLabel={t.goAccount}
            href={target}
          />
        ) : (
          <ErrorView
            title={t.errTitle}
            sub={t.errSub}
            retryLabel={t.errRetry}
            supportLabel={t.errSupport}
            backLabel={t.backHome}
            locale={locale}
          />
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────

function ActivatingView({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center gap-6">
      <div
        className="flex h-20 w-20 items-center justify-center rounded-full border border-white/15 bg-white/[0.03]"
        style={{
          boxShadow: "0 12px 40px -16px rgba(184,60,77,0.5)",
        }}
      >
        <Loader2 className="h-9 w-9 animate-spin text-[#B83C4D]" />
      </div>
      <div className="space-y-2">
        <h1 className="text-[26px] font-extrabold leading-tight text-white sm:text-[30px]">
          {title}
        </h1>
        <p className="text-[15px] text-white/60">{sub}</p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────

function ActiveView({
  isHe,
  title,
  sub,
  note,
  ctaLabel,
  href,
}: {
  isHe: boolean
  title: string
  sub: string
  note: string
  ctaLabel: string
  href: string
}) {
  return (
    <div className="flex flex-col items-center gap-7">
      {/* Premium check glyph: solid wine circle + cream Lucide check on top.
          No emoji — emoji renders inconsistently across platforms and
          undermines the premium feel. */}
      <div className="relative">
        <div
          aria-hidden
          className="absolute inset-0 -m-4 rounded-full opacity-50 blur-2xl"
          style={{
            background:
              "radial-gradient(circle, #B83C4D 0%, transparent 70%)",
          }}
        />
        <div
          className="relative flex h-24 w-24 items-center justify-center rounded-full"
          style={{
            background: "linear-gradient(135deg, #B83C4D 0%, #6C2E40 100%)",
            boxShadow:
              "0 20px 60px -20px rgba(184,60,77,0.7), inset 0 1px 0 rgba(255,255,255,0.2)",
          }}
        >
          <Check className="h-12 w-12 text-[#FAF6F7]" strokeWidth={3} />
        </div>
      </div>

      <div className="space-y-3">
        <h1 className="font-heading text-[32px] font-extrabold leading-tight text-white sm:text-[38px]">
          {title}
        </h1>
        <p className="text-[17px] leading-relaxed text-white/75">{sub}</p>
      </div>

      <a
        href={href}
        className="group inline-flex min-h-[56px] w-full items-center justify-center gap-3 rounded-full px-8 text-[17px] font-bold text-white transition hover:brightness-110"
        style={{
          background: "linear-gradient(135deg, #B83C4D 0%, #6C2E40 100%)",
          boxShadow: "0 18px 40px -12px rgba(184,60,77,0.55)",
        }}
      >
        {ctaLabel}
        <span
          aria-hidden
          className={`inline-block transition-transform group-hover:translate-x-[-3px] ${
            isHe ? "" : "rotate-180"
          }`}
        >
          ←
        </span>
      </a>

      <p className="text-[13px] text-white/50">{note}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────

function ErrorView({
  title,
  sub,
  retryLabel,
  supportLabel,
  backLabel,
  locale,
}: {
  title: string
  sub: string
  retryLabel: string
  supportLabel: string
  backLabel: string
  locale: string
}) {
  return (
    <div className="flex flex-col items-center gap-7">
      <div
        className="flex h-20 w-20 items-center justify-center rounded-full border border-rose-300/30"
        style={{
          background: "rgba(244, 63, 94, 0.12)",
          boxShadow: "0 12px 40px -16px rgba(244,63,94,0.45)",
        }}
      >
        <AlertTriangle className="h-9 w-9 text-rose-300" />
      </div>

      <div className="space-y-3">
        <h1 className="font-heading text-[28px] font-extrabold leading-tight text-white sm:text-[32px]">
          {title}
        </h1>
        <p className="max-w-md text-[15px] leading-relaxed text-white/70">
          {sub}
        </p>
      </div>

      <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:justify-center">
        <a
          href={`/${locale}/pricing`}
          className="inline-flex min-h-[52px] flex-1 items-center justify-center rounded-full px-6 text-[15px] font-bold text-white transition hover:brightness-110"
          style={{
            background: "linear-gradient(135deg, #B83C4D 0%, #6C2E40 100%)",
          }}
        >
          {retryLabel}
        </a>
        <a
          href={`/${locale}/contact`}
          className="inline-flex min-h-[52px] flex-1 items-center justify-center rounded-full border border-white/20 bg-white/[0.03] px-6 text-[15px] font-semibold text-white/85 transition hover:bg-white/10"
        >
          {supportLabel}
        </a>
      </div>

      <a
        href={`/${locale}`}
        className="text-[13px] text-white/50 underline-offset-4 hover:text-white/70 hover:underline"
      >
        {backLabel}
      </a>
    </div>
  )
}
