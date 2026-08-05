import type { Metadata } from "next";
import { Mail, MessageCircle, Clock } from "lucide-react";
import { buildAlternates, buildOgLocale } from "@/lib/seo/alternates";
import { breadcrumbJsonLd, safeJsonLd } from "@/lib/seo/jsonLd";
import { SUPPORT_WHATSAPP_INTL } from "@/lib/constants/contact";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const locale = params.locale === "he" ? "he" : "en";
  const isHe = locale === "he";
  const title = isHe ? "יצירת קשר - מיאושי" : "Contact - Mioshy";
  const description = isHe
    ? "איך ליצור קשר עם הצוות של מיאושי — אימייל וואטסאפ, מענה תוך 48 שעות"
    : "How to reach the Mioshy team — email, WhatsApp, reply within 48 hours";
  return {
    title,
    description,
    alternates: buildAlternates(locale, "/contact"),
    openGraph: {
      ...buildOgLocale(locale),
      type: "website",
      title,
      description,
      siteName: "Mioshy",
    },
  };
}

/**
 * /contact — refreshed per Itzik 2026-05-07.
 *
 *   • Background flipped from the dark site bg to the cream palette
 *     (#FBF5F2) used on /journey, /mioshy-sex marketing wrappers — the
 *     contact page is editorial, not utility-dark.
 *   • Email is now `support@mioshy.com` (was hello@mioshy.com).
 *   • Removed the "Sun–Thu 9-18 Israel time" availability box — replaced
 *     with a calmer "we reply within 48h" line.
 *   • Added a WhatsApp option to +972 559941658 — opens wa.me with a
 *     preset Hebrew message so the user doesn't have to type from
 *     scratch.
 */
export default function ContactPage({
  params,
}: {
  params: { locale: string };
}) {
  const isHe = params.locale === "he";

  // wa.me expects digits-only phone with country code, no plus sign.
  const waPhone = SUPPORT_WHATSAPP_INTL;
  // Optional pre-filled message — encoded for the URL.
  const waMessage = encodeURIComponent(
    isHe
      ? "שלום מיאושי, יש לי שאלה על השירות:"
      : "Hi Mioshy, I have a question about the service:",
  );
  const waUrl = `https://wa.me/${waPhone}?text=${waMessage}`;

  return (
    <main
      dir={isHe ? "rtl" : "ltr"}
      className="min-h-[70dvh] bg-[#FBF5F2] px-4 py-20 text-[#170E14]"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd({
            "@context": "https://schema.org",
            ...breadcrumbJsonLd(isHe ? "he" : "en", [
              { name: isHe ? "יצירת קשר" : "Contact", path: "/contact" },
            ]),
          }),
        }}
      />
      <div className="mx-auto max-w-2xl">
        {/* Eyebrow + headline */}
        <span className="inline-flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.22em] text-[#8B2638]">
          <span className="h-[7px] w-[7px] rounded-sm bg-[#B83C4D] shadow-[0_0_0_3px_rgba(184,60,77,0.18)]" />
          {isHe ? "יצירת קשר" : "Contact"}
        </span>
        <h1
          className="mt-5 text-[44px] leading-[1.05] tracking-[-0.02em] sm:text-[56px]"
          style={{
            fontFamily:
              "var(--font-frank-ruhl), 'Frank Ruhl Libre', serif",
            fontWeight: 600,
          }}
        >
          {isHe ? "מדברים?" : "Let's talk."}
        </h1>
        <p className="mt-5 max-w-xl text-[19px] leading-[1.65] text-[#4A3A45]">
          {isHe
            ? "אנחנו כאן כדי לענות. שאלות, תמיכה, רעיונות — תכתבו לנו במייל או בוואטסאפ. מענה תוך 48 שעות, ולפעמים מהר יותר."
            : "We're here to answer. Questions, support, ideas — email us or send a WhatsApp. We reply within 48 hours, often sooner."}
        </p>

        <div className="mt-10 space-y-4">
          {/* Email */}
          <a
            href="mailto:support@mioshy.com"
            className="group flex items-start gap-4 rounded-2xl border border-[#EAE0E3] bg-white p-6 shadow-sm transition hover:border-[#B83C4D]/40 hover:shadow-lg"
          >
            <span className="mt-1 grid size-11 shrink-0 place-items-center rounded-full bg-[#FBE9EC] text-[#B83C4D] transition group-hover:bg-[#B83C4D] group-hover:text-white">
              <Mail className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-bold text-[#170E14]">
                {isHe ? "מייל" : "Email"}
              </p>
              <p className="mt-1 text-[15px] leading-[1.55] text-[#7A6A75]">
                {isHe
                  ? "לכל דבר — תמיכה, שאלות, הצעות, החזר כספי."
                  : "For anything — support, questions, suggestions, refunds."}
              </p>
              <p className="mt-3 text-[18px] font-semibold text-[#B83C4D] underline-offset-4 group-hover:underline">
                support@mioshy.com
              </p>
            </div>
          </a>

          {/* WhatsApp */}
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-4 rounded-2xl border border-[#EAE0E3] bg-white p-6 shadow-sm transition hover:border-emerald-500/40 hover:shadow-lg"
          >
            <span className="mt-1 grid size-11 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700 transition group-hover:bg-emerald-500 group-hover:text-white">
              <MessageCircle className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-bold text-[#170E14]">
                {isHe ? "וואטסאפ" : "WhatsApp"}
              </p>
              <p className="mt-1 text-[18px] leading-[1.55] text-[#7A6A75]">
                {isHe
                  ? "מהיר וכיף. שלחו הודעה ונחזור אליכם."
                  : "Fast and friendly. Send a message and we'll come back to you."}
              </p>
              {/* CTA pill replaces the raw phone number. Itzik
                  2026-05-21: don't expose +972 55-994-1658 inline —
                  visitors should land directly in WhatsApp's send-
                  message flow instead of dialling. The outer <a>
                  already points at wa.me with a pre-filled message,
                  so this span is purely visual; click-through is
                  whole-card. */}
              <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-[18px] font-semibold text-white shadow-sm transition group-hover:bg-emerald-700">
                <MessageCircle className="size-4" />
                {isHe ? "שליחת הודעה" : "Send a message"}
              </span>
            </div>
          </a>

          {/* Response-time card — calm, no clock face */}
          <div className="flex items-start gap-4 rounded-2xl border border-[#EAE0E3] bg-[#FBE9EC]/40 p-6">
            <span className="mt-1 grid size-11 shrink-0 place-items-center rounded-full bg-white text-[#8B2638]">
              <Clock className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-bold text-[#170E14]">
                {isHe ? "זמן מענה" : "Response time"}
              </p>
              <p className="mt-1 text-[15px] leading-[1.55] text-[#4A3A45]">
                {isHe
                  ? "מענה תוך 48 שעות — בכל יום, גם בסופי שבוע. אם זה דחוף, וואטסאפ הוא הדרך המהירה."
                  : "We reply within 48 hours — every day, including weekends. If it's urgent, WhatsApp is the fastest way."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
