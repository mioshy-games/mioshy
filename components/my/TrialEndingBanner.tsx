"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Task 21 — gentle days-6-7 trial escalation on /my. One line: the deadline +
 * the day-7 price + a manage link. Shown ONLY on day 6-7 (not before), for
 * trialing users. Self-contained (fetches /api/trial/status), so /my's server
 * path is untouched. Trial is ILS/Israeli-only → he-first copy.
 */
export function TrialEndingBanner({ isHe }: { isHe: boolean }) {
  const [state, setState] = useState<{
    show: boolean; day?: number; trialEndsAt?: string; amount?: number; currency?: string;
  }>({ show: false });

  useEffect(() => {
    let alive = true;
    fetch("/api/trial/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d) setState(d); })
      .catch(() => { /* no banner */ });
    return () => { alive = false; };
  }, []);

  // Escalate only on days 6-7 (per task 21 — "לא לפני יום 6").
  if (!state.show || (state.day ?? 0) < 6) return null;

  const amountLabel = (() => {
    if (state.amount == null) return null;
    try {
      return new Intl.NumberFormat(isHe ? "he-IL" : "en-US", {
        style: "currency", currency: state.currency || "ILS", maximumFractionDigits: 0,
      }).format(state.amount);
    } catch { return `${state.currency} ${state.amount}`; }
  })();
  const dateLabel = state.trialEndsAt
    ? new Date(state.trialEndsAt).toLocaleDateString(isHe ? "he-IL" : "en-US")
    : "";

  return (
    <div
      dir={isHe ? "rtl" : "ltr"}
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-fuchsia-300/30 bg-fuchsia-500/10 px-4 py-3 text-sm text-white"
    >
      <span>
        {isHe
          ? `הניסיון מסתיים ב-${dateLabel}${amountLabel ? `, ואז ${amountLabel} לחודש` : ""}. ההתקדמות שלכם נשמרת במלואה.`
          : `Your trial ends on ${dateLabel}${amountLabel ? `, then ${amountLabel}/mo` : ""}. Your progress is fully saved.`}
      </span>
      <Link
        href="/account"
        className="shrink-0 rounded-full border border-fuchsia-300/40 bg-fuchsia-500/20 px-4 py-1.5 font-semibold text-fuchsia-50 transition hover:bg-fuchsia-500/30"
      >
        {isHe ? "ניהול המנוי" : "Manage plan"}
      </Link>
    </div>
  );
}
