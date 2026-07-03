"use client"

import { useState }        from "react"
import { useSearchParams, useParams } from "next/navigation"
import Link                from "next/link"
import { retryCheckout }   from "@/lib/billing/retry-checkout"

export function BillingErrorContent() {
  const searchParams = useSearchParams()
  const params       = useParams()
  const locale       = (params?.locale as string) ?? "he"
  const sessionId    = searchParams.get("session_id")

  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Task 26 #3 — mint a NEW session and go straight back to Cardcom's payment
  // page, instead of dropping the user on the home paywall.
  const onRetry = async () => {
    if (!sessionId) return
    setBusy(true)
    setError(null)
    const { redirectUrl } = await retryCheckout(sessionId, locale)
    if (redirectUrl) {
      window.location.href = redirectUrl
      return
    }
    setBusy(false)
    setError("לא הצלחנו לפתוח את עמוד התשלום מחדש. נסו שוב מעמוד התוצאות.")
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="text-6xl">❌</div>
      <h1 className="text-2xl font-bold text-rose-400">התשלום לא הושלם</h1>
      <p className="max-w-md text-muted-foreground">
        התשלום בוטל או נכשל. לא חויב כלום. תוכל לנסות שוב בכל עת.
      </p>
      {sessionId && (
        <p className="text-xs text-white/30">
          מזהה: {sessionId}
        </p>
      )}
      {error && <p className="max-w-md text-sm text-rose-300">{error}</p>}
      <div className="flex gap-4">
        <Link
          href="/"
          className="rounded-lg border px-4 py-2 text-sm hover:bg-white/5 transition-colors"
        >
          חזור לדף הבית
        </Link>
        <button
          type="button"
          onClick={onRetry}
          disabled={busy || !sessionId}
          className="rounded-lg bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-fuchsia-500 disabled:opacity-60"
        >
          {busy ? "רגע…" : "נסה שוב"}
        </button>
      </div>
    </div>
  )
}
