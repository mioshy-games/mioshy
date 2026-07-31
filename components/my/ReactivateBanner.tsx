"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import {
  reactivateSubscription,
  type ReactivationOffer,
} from "@/app/actions/subscription-reactivate";

/**
 * Shown to a customer whose subscription will NOT auto-renew.
 *
 * Two steps on purpose (Itzik 2026-07-31, option א): the banner states the end
 * date and that nothing will be charged; the confirm sheet states the price and
 * that the first charge is today. Only the second button spends money.
 *
 * Copy approved verbatim. The PRICE is read from the DB and interpolated —
 * never written into the string.
 */
export function ReactivateBanner({ offer }: { offer: ReactivationOffer }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const endDate = offer.periodEnd
    ? new Date(offer.periodEnd).toLocaleDateString("he-IL", {
        day: "numeric",
        month: "long",
      })
    : null;

  const amount = Number.isInteger(offer.amount)
    ? String(offer.amount)
    : offer.amount.toFixed(2);
  const currencySymbol = offer.currency === "ILS" ? "₪" : offer.currency;

  const confirm = () =>
    startTransition(async () => {
      setError(null);
      const r = await reactivateSubscription();
      if (!r.ok) {
        setError(
          r.error === "no_payment_method"
            ? "אין אמצעי תשלום שמור. פנו אלינו ונסדר."
            : "לא הצלחנו להפעיל את המנוי. נסו שוב.",
        );
        return;
      }
      setConfirming(false);
      router.refresh();
    });

  return (
    <div className="mt-6 rounded-2xl border border-amber-300/25 bg-amber-400/[0.07] px-4 py-4">
      <div className="flex items-start gap-2.5">
        <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-amber-200/80" aria-hidden />
        <div className="min-w-0">
          <p className="text-[14px] font-bold leading-relaxed text-[#FAF6F7]">
            השירות שלכם פתוח עד {endDate ?? "סוף התקופה"}, בלי חיוב.
          </p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-[#FAF6F7]/70">
            בתום התקופה לא יתבצע חידוש ולא תחויבו. אם תרצו להמשיך, ההפעלה בידיים
            שלכם.
          </p>

          {!confirming && (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-white/[0.09] px-4 py-2.5 text-[14px] font-bold text-[#FAF6F7] transition hover:bg-white/[0.16] active:scale-[0.99] sm:w-auto sm:px-6"
            >
              להפעיל מחדש את המנוי
            </button>
          )}
        </div>
      </div>

      {confirming && (
        <div className="mt-4 rounded-xl border border-white/[0.10] bg-slate-950/50 px-4 py-4">
          <h3 className="text-[15px] font-bold text-[#FAF6F7]">הפעלה מחדש של המנוי</h3>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#FAF6F7]/75">
            המנוי יתחדש בחיוב חודשי של {amount} {currencySymbol}, והחיוב הראשון
            יתבצע היום. אפשר לעצור בכל רגע מההגדרות.
          </p>

          <div className="mt-3.5 flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={confirm}
              disabled={pending}
              className="inline-flex w-full items-center justify-center rounded-xl bg-[linear-gradient(95deg,#6C5CE7_0%,#D6409F_52%,#F79154_100%)] px-4 py-2.5 text-[14px] font-bold text-white transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60 sm:w-auto sm:px-6"
            >
              {pending ? "רגע…" : "מאשר ומפעיל"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="text-[13.5px] font-semibold text-[#FAF6F7]/60 underline underline-offset-4 transition hover:text-[#FAF6F7] disabled:opacity-60"
            >
              לא עכשיו
            </button>
          </div>

          {error && <p className="mt-2.5 text-[13px] text-rose-300">{error}</p>}
        </div>
      )}
    </div>
  );
}
