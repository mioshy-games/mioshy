"use client";

import { useState } from "react";

/**
 * Screen 5 (dashboard landing) main content + daily-question subscribe toggle
 * (§6). Rendered inside the existing shell, so it uses the current chrome.
 * Dark theme to match the dashboard.
 */
export function PollDashboardLanding({ initialSubscribed }: { initialSubscribed: boolean }) {
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    const next = !subscribed;
    const r = await fetch("/api/poll/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscribed: next }),
    }).then((x) => x.json()).catch(() => null);
    if (r && typeof r.subscribed === "boolean") setSubscribed(r.subscribed);
    setBusy(false);
  };

  return (
    <div dir="rtl" className="mx-auto max-w-lg px-5 py-10 text-center" style={{ fontFamily: "var(--font-assistant), sans-serif" }}>
      <div className="mx-auto mb-6 grid h-[76px] w-[76px] place-items-center rounded-full text-4xl font-extrabold text-white"
        style={{ background: "linear-gradient(120deg,#b83c4d,#ec4899 55%,#f59e0b)", boxShadow: "0 16px 30px -14px rgba(236,72,153,.6)" }}>
        ✓
      </div>
      <h1 className="text-[22px] font-extrabold mb-3">נחתתם על סקר הזוגיות של ישראל</h1>
      <p className="text-[20px] leading-relaxed text-black/70 dark:text-white/75 max-w-md mx-auto">
        מעכשיו כל יום תקבלו שאלה אחת על הזוגיות, ורואים מיד מה זוגות אחרים בישראל ענו. מסביב מחכים לכם עוד השירותים שלנו.
      </p>

      <a href="/he/survey" className="mt-7 inline-block rounded-2xl px-6 py-3.5 font-extrabold text-white text-[16px]"
        style={{ background: "#D97706", boxShadow: "0 14px 28px -14px rgba(217,119,6,.7)" }}>
        לשאלה של היום ←
      </a>

      <div className="mt-8 flex items-center justify-center gap-3 text-[15px]">
        <span className="text-black/60 dark:text-white/60">קבלת שאלה יומית</span>
        <button type="button" onClick={toggle} disabled={busy}
          className={`relative h-7 w-12 rounded-full transition ${subscribed ? "bg-pink-500" : "bg-black/20 dark:bg-white/20"}`}
          aria-pressed={subscribed}>
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${subscribed ? "right-1" : "right-6"}`} />
        </button>
        <span className="font-bold">{subscribed ? "פעיל" : "כבוי"}</span>
      </div>
    </div>
  );
}
