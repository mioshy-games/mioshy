"use client"

import { useEffect, useState } from "react"
import { useSearchParams }     from "next/navigation"
import { useRouter }           from "next/navigation"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"

type Phase = "loading" | "activating" | "active" | "error"

export function BillingSuccessContent() {
  const searchParams  = useSearchParams()
  const sessionId     = searchParams.get("session_id") ?? ""
  const router        = useRouter()
  const [phase, setPhase] = useState<Phase>("loading")
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
        setTimeout(() => { if (!cancelled) router.replace("/") }, 3000)
        return
      }

      if (data?.status === "failed") {
        setPhase("error")
        return
      }

      setAttempts(a => {
        const next = a + 1
        if (next >= MAX_ATTEMPTS) { setPhase("active"); return next }
        setTimeout(poll, 3000)
        return next
      })
    }

    setPhase("activating")
    void poll()
    return () => { cancelled = true }
  }, [sessionId, router])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      {phase === "loading" || phase === "activating" ? (
        <>
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-fuchsia-500 border-t-transparent" />
          <h1 className="text-2xl font-bold">מעבד תשלום…</h1>
          <p className="text-muted-foreground">
            {attempts > 0 ? `בדיקה ${attempts}…` : "מאמת את התשלום עם קארדקום"}
          </p>
        </>
      ) : phase === "active" ? (
        <>
          <div className="text-6xl">🎉</div>
          <h1 className="text-3xl font-extrabold text-fuchsia-400">התשלום אושר!</h1>
          <p className="text-muted-foreground">המנוי שלך פעיל. מועבר למשחק…</p>
        </>
      ) : (
        <>
          <div className="text-6xl">⚠️</div>
          <h1 className="text-2xl font-bold text-rose-400">אירעה שגיאה</h1>
          <p className="text-muted-foreground">התשלום לא עבר. נסה שוב או פנה לתמיכה.</p>
          <a href="/" className="mt-4 underline">חזור לדף הבית</a>
        </>
      )}
    </div>
  )
}
