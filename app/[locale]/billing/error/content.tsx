"use client"

import { useSearchParams } from "next/navigation"
import Link               from "next/link"

export function BillingErrorContent() {
  const searchParams = useSearchParams()
  const sessionId    = searchParams.get("session_id")

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
      <div className="flex gap-4">
        <Link
          href="/"
          className="rounded-lg border px-4 py-2 text-sm hover:bg-white/5 transition-colors"
        >
          חזור לדף הבית
        </Link>
        <Link
          href="/?paywall=1"
          className="rounded-lg bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-500 transition-colors"
        >
          נסה שוב
        </Link>
      </div>
    </div>
  )
}
