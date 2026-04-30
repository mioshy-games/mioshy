import type { Metadata } from "next";
import { Mail, MessageCircleHeart, Clock } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const isHe = params.locale === "he";
  return {
    title: isHe ? "יצירת קשר - מיאושי" : "Contact - Mioshy",
    description: isHe
      ? "איך ליצור קשר עם הצוות של מיאושי"
      : "How to reach the Mioshy team",
  };
}

export default function ContactPage({
  params,
}: {
  params: { locale: string };
}) {
  const isHe = params.locale === "he";
  return (
    <main
      dir={isHe ? "rtl" : "ltr"}
      className="min-h-[70dvh] bg-[var(--mio-bg)] px-4 py-20 text-white"
    >
      <div className="mx-auto max-w-2xl">
        <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl">
          {isHe ? "יצירת קשר" : "Contact us"}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-white/75">
          {isHe
            ? "אנחנו כאן כדי לעזור. תפנו אלינו בשאלות, הצעות או תמיכה - נחזור תוך יום עסקים."
            : "We're here to help. Reach out with questions, suggestions, or support - we'll respond within one business day."}
        </p>

        <div className="mt-10 space-y-4">
          <a
            href="mailto:hello@mioshy.com"
            className="flex items-start gap-4 rounded-2xl border border-purple-500/20 bg-[var(--mio-card)] p-6 backdrop-blur-md transition hover:border-purple-400/40"
          >
            <Mail className="mt-1 h-6 w-6 text-[var(--mio-purple)]" />
            <div>
              <p className="text-lg font-bold">
                {isHe ? "מייל" : "Email"}
              </p>
              <p className="mt-1 text-sm text-white/70">
                {isHe
                  ? "לכל דבר - תמיכה, שאלות, הצעות"
                  : "For anything - support, questions, suggestions"}
              </p>
              <p className="mt-2 font-semibold text-fuchsia-300">
                hello@mioshy.com
              </p>
            </div>
          </a>

          <div className="flex items-start gap-4 rounded-2xl border border-purple-500/20 bg-[var(--mio-card)] p-6 backdrop-blur-md">
            <MessageCircleHeart className="mt-1 h-6 w-6 text-[var(--mio-rose)]" />
            <div>
              <p className="text-lg font-bold">
                {isHe ? "שאלות על המסע האישי" : "Questions about the journey"}
              </p>
              <p className="mt-1 text-sm text-white/70">
                {isHe
                  ? "אם יש לכם שאלות על השאלון, הניתוח, או התוכנית השבועית - נשמח לענות לפני שתתחייבו."
                  : "If you have questions about the questionnaire, analysis, or weekly plan - we're happy to answer before you commit."}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 rounded-2xl border border-purple-500/20 bg-[var(--mio-card)] p-6 backdrop-blur-md">
            <Clock className="mt-1 h-6 w-6 text-[var(--mio-purple)]" />
            <div>
              <p className="text-lg font-bold">
                {isHe ? "זמני מענה" : "Response times"}
              </p>
              <p className="mt-1 text-sm text-white/70">
                {isHe
                  ? "ימים א׳–ה׳, 09:00–18:00 (שעון ישראל). נחזור תוך יום עסקים אחד."
                  : "Sun–Thu, 9am–6pm (Israel time). We respond within one business day."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
