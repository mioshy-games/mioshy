"use client"

import { useEffect, useState }         from "react"
import { useSearchParams, useParams }  from "next/navigation"
import Link                            from "next/link"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { retryCheckout }               from "@/lib/billing/retry-checkout"

export function BillingErrorContent() {
  const searchParams = useSearchParams()
  const params       = useParams()
  const locale       = (params?.locale as string) ?? "he"
  const isHe         = locale !== "en"
  const sessionId    = searchParams.get("session_id")

  const [busy, setBusy]     = useState(false)
  const [error, setError]   = useState<string | null>(null)
  // Task 33 — detect the one-time-trial-already-used case so we don't loop the
  // user back into the same block; we offer a direct paid subscription instead.
  const [trialUsed, setTrialUsed] = useState(false)

  useEffect(() => {
    if (!sessionId) return
    let alive = true
    void (async () => {
      const supabase = createBrowserSupabaseClient()
      const { data } = await supabase
        .from("checkout_sessions")
        .select("failure_reason")
        .eq("id", sessionId)
        .maybeSingle()
      if (alive && data?.failure_reason === "trial_already_used") setTrialUsed(true)
    })()
    return () => { alive = false }
  }, [sessionId])

  // Retry: for the trial-already-used case, force a regular subscription (no
  // trial); otherwise reuse the failed flow. Both mint a fresh session and go
  // straight back to Cardcom.
  const onAction = async () => {
    if (!sessionId) return
    setBusy(true)
    setError(null)
    const { redirectUrl } = await retryCheckout(sessionId, locale, trialUsed ? "regular" : "auto")
    if (redirectUrl) {
      window.location.href = redirectUrl
      return
    }
    setBusy(false)
    setError(isHe
      ? "לא הצלחנו לפתוח את עמוד התשלום מחדש. נסו שוב מעמוד התוצאות."
      : "We couldn't reopen the payment page. Please try again from the results page.")
  }

  const t = trialUsed
    ? {
        title: isHe ? "כבר ניצלתם את תקופת הניסיון" : "You've already used your free trial",
        body: isHe
          ? "תקופת הניסיון ניתנת פעם אחת, וכבר השתמשתם בה. אפשר להצטרף עכשיו למנוי, וכל התכנים ייפתחו לכם מיד."
          : "The free trial is given once, and you've already used it. You can join the subscription now, and everything opens for you right away.",
        cta: isHe ? "הצטרפו למנוי" : "Join the subscription",
      }
    : {
        title: isHe ? "התשלום לא הושלם" : "Payment didn't complete",
        body: isHe
          ? "התשלום בוטל או נכשל. לא חויב כלום. תוכל לנסות שוב בכל עת."
          : "The payment was cancelled or failed. Nothing was charged. You can try again anytime.",
        cta: isHe ? "נסה שוב" : "Try again",
      }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-2xl font-bold text-rose-400">{t.title}</h1>
      <p className="max-w-md text-muted-foreground">{t.body}</p>
      {error && <p className="max-w-md text-sm text-rose-300">{error}</p>}
      <div className="flex gap-4">
        <Link
          href="/"
          className="rounded-lg border px-4 py-2 text-sm transition-colors hover:bg-white/5"
        >
          {isHe ? "חזרה לדף הבית" : "Back home"}
        </Link>
        <button
          type="button"
          onClick={onAction}
          disabled={busy || !sessionId}
          className="rounded-lg bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-fuchsia-500 disabled:opacity-60"
        >
          {busy ? (isHe ? "רגע…" : "One sec…") : t.cta}
        </button>
      </div>
    </div>
  )
}
