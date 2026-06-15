/**
 * SubscriptionBillingBanner — global "payment failed" alert bar.
 *
 * Mounted once in the root locale layout so it appears on every page for
 * a signed-in user whose subscription is past_due or blocked. Renders
 * nothing otherwise. Fixed copy, no countdown (per product decision
 * 2026-06-14: past_due cuts access immediately — we don't promise a
 * grace window). The CTA points to /account for now; the dedicated
 * payment-method update flow (task #7) is deferred.
 *
 * Server component — purely presentational, no interactivity.
 */
import { AlertTriangle, Lock } from "lucide-react";
import type { BillingBannerState } from "@/lib/billing/failure-banner";

// Customer-service WhatsApp line (0559941658 → intl 972559941658). The
// CTA opens a chat with a generic prefilled message — NO personal data
// in the URL. Same target for past_due and blocked.
const SUPPORT_WA_NUMBER = "972559941658";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.978-1.057zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413z" />
    </svg>
  );
}

const COPY: Record<
  BillingBannerState,
  { he: string; en: string }
> = {
  past_due: {
    he: "התשלום נכשל, הגישה הושעתה — פנו לשירות הלקוחות בוואטסאפ להסדרת אמצעי התשלום.",
    en: "Payment failed and access is suspended — contact support on WhatsApp to sort out your payment method.",
  },
  blocked: {
    he: "החשבון חסום עקב כשלי חיוב — פנו לשירות הלקוחות בוואטסאפ להסדרת אמצעי התשלום.",
    en: "Your account is blocked due to billing failures — contact support on WhatsApp to sort out your payment method.",
  },
};

export function SubscriptionBillingBanner({
  state,
  isHe,
}: {
  state: BillingBannerState | null;
  isHe: boolean;
}) {
  if (state !== "past_due" && state !== "blocked") return null;

  const Icon = state === "blocked" ? Lock : AlertTriangle;
  const message = isHe ? COPY[state].he : COPY[state].en;
  const cta = isHe ? "פנייה לשירות לקוחות" : "Contact support";

  // Generic prefilled message — no name/email/PII.
  const waMessage = isHe
    ? "היי, אשמח לעדכן את אמצעי התשלום שלי במיאושי"
    : "Hi, I'd like to update my payment method on Mioshy";
  const waHref = `https://wa.me/${SUPPORT_WA_NUMBER}?text=${encodeURIComponent(waMessage)}`;

  // Light text tones — the app chrome is dark, so the original *-900
  // shades were unreadable. Background + border stay as-is.
  const tone =
    state === "blocked"
      ? "border-rose-500/40 bg-rose-500/10 text-rose-100"
      : "border-amber-500/40 bg-amber-500/10 text-amber-100";
  const button =
    state === "blocked"
      ? "bg-rose-600 hover:bg-rose-700"
      : "bg-amber-600 hover:bg-amber-700";

  return (
    <div
      dir={isHe ? "rtl" : "ltr"}
      role="alert"
      className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5 ${tone}`}
    >
      <div className="flex min-w-0 items-start gap-2.5 text-sm">
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span className="font-medium">{message}</span>
      </div>
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold text-white transition ${button}`}
      >
        <WhatsAppIcon className="size-3.5" />
        {cta}
      </a>
    </div>
  );
}
