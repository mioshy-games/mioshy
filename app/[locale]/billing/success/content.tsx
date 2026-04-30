"use client"

import { useEffect, useState } from "react"
import { useSearchParams }      from "next/navigation"
import { useParams }            from "next/navigation"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"

type Phase = "loading" | "activating" | "active" | "error"

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

  // Optional return_path - when /api/billing/checkout/create is called with
  // return_path in the body (e.g. an Adults one-time purchase asking to
  // land back on the product page), Cardcom is told to redirect here with
  // ?return_path=… in the success URL. Once payment is confirmed we auto-
  // navigate the user there instead of forcing the generic "go to library"
  // flow. The path is validated to start with "/" so a malicious upstream
  // can never redirect off-origin.
  const rawReturnPath = searchParams.get("return_path") ?? ""
  const safeReturnPath =
    rawReturnPath.startsWith("/") && !rawReturnPath.startsWith("//")
      ? rawReturnPath
      : null

  const [phase, setPhase]       = useState<Phase>("loading")
  const [attempts, setAttempts] = useState(0)

  useEffect(() => {
    if (!sessionId) { setPhase("error"); return }

    const MAX_ATTEMPTS = 18
    let cancelled = false

    async function poll() {
      const supabase = createBrowserSupabaseClient()
      const { data } = await supabase
        .from("checkout_sessions")
        .select("status")
        .eq("id", sessionId)
        .maybeSingle()

      if (cancelled) return

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

  // Auto-redirect to return_path once the session flips to paid. The short
  // 1.4s delay gives the celebratory state a beat - the user briefly sees
  // "Payment confirmed!" before we hand them to /adults/[slug] (or wherever
  // the originating buy CTA asked). If no return_path is provided, we leave
  // the user on this screen with the existing CTA buttons (legacy Journey
  // flow that lands on /journey/timeline).
  useEffect(() => {
    if (phase !== "active") return
    if (!safeReturnPath) return
    const t = setTimeout(() => {
      // Prefix the locale so next-intl middleware doesn't bounce again.
      const target = safeReturnPath.startsWith(`/${locale}/`)
        ? safeReturnPath
        : `/${locale}${safeReturnPath}`
      window.location.assign(target)
    }, 1400)
    return () => clearTimeout(t)
  }, [phase, safeReturnPath, locale])

  const t = isHe
    ? {
        activating:  "מעבד תשלום…",
        checking:    (n: number) => n > 0 ? `בדיקה ${n}…` : "מאמת את התשלום עם קארדקום",
        activeTitle: "התשלום אושר! 🎉",
        activeSub:   "המנוי שלכם פעיל. התוכנית האישית שלכם מוכנה.",
        goAccount:   "לספריה שלי",
        goJourney:   "פתיחת המסע שלכם",
        errTitle:    "אירעה שגיאה",
        errSub:      "התשלום לא עבר. נסה שוב או פנה לתמיכה.",
        errBack:     "חזרה לדף הבית",
      }
    : {
        activating:  "Processing payment…",
        checking:    (n: number) => n > 0 ? `Check ${n}…` : "Verifying payment with Cardcom",
        activeTitle: "Payment confirmed! 🎉",
        activeSub:   "Your subscription is active. Your personalized plan is ready.",
        goAccount:   "My library",
        goJourney:   "Open my journey",
        errTitle:    "Something went wrong",
        errSub:      "The payment didn't go through. Try again or contact support.",
        errBack:     "Back to home",
      }

  return (
    <div
      dir={isHe ? "rtl" : "ltr"}
      className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center"
    >
      {phase === "loading" || phase === "activating" ? (
        <>
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-fuchsia-500 border-t-transparent" />
          <h1 className="text-2xl font-bold text-white">{t.activating}</h1>
          <p className="text-white/60">{t.checking(attempts)}</p>
        </>
      ) : phase === "active" ? (
        <>
          <div className="text-7xl">🎉</div>
          <h1 className="text-3xl font-extrabold text-fuchsia-400">{t.activeTitle}</h1>
          <p className="max-w-sm text-white/75">{t.activeSub}</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <a
              href={`/${locale}/journey/timeline`}
              className="rounded-2xl bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/40 hover:brightness-110 transition"
            >
              {t.goJourney}
            </a>
            <a
              href={`/${locale}/my`}
              className="rounded-2xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
            >
              {t.goAccount}
            </a>
          </div>
        </>
      ) : (
        <>
          <div className="text-6xl">⚠️</div>
          <h1 className="text-2xl font-bold text-rose-400">{t.errTitle}</h1>
          <p className="text-white/60">{t.errSub}</p>
          <a
            href={`/${locale}`}
            className="mt-4 rounded-2xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
          >
            {t.errBack}
          </a>
        </>
      )}
    </div>
  )
}
