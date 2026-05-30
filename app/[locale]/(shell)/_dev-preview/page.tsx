/**
 * Dev-only smoke test page for the AppShell.
 *
 * Lets us verify the shell chrome renders end-to-end (sidebar +
 * mobile tabs + design tokens) before any real route is migrated
 * into the (shell) group. Path: /[locale]/_dev-preview.
 *
 * Remove this folder in Step 3+ once /my/today goes live as the real
 * landing page. Kept on disk until then so QA + design can poke the
 * chrome on staging without depending on the production routes.
 *
 * Hidden in production via env check — the page renders a 404 unless
 * NEXT_PUBLIC_DEV_PREVIEW=1 OR the host is mioshy.com staging.
 *
 * Added 2026-05-29 (Step 2).
 */

import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

const DEV_PREVIEW_ENABLED =
  process.env.NEXT_PUBLIC_DEV_PREVIEW === "1" ||
  process.env.VERCEL_ENV !== "production";

export const dynamic = "force-dynamic";

export default function DevPreviewPage({
  params,
}: {
  params: { locale: string };
}) {
  if (!DEV_PREVIEW_ENABLED) notFound();
  setRequestLocale(params.locale);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight text-white">
        AppShell — Dev preview
      </h1>
      <p className="mt-3 text-[18px] leading-relaxed text-white/75">
        זהו עמוד בדיקה לזירת המעטפת. אם אתם רואים את הסייד-בר מימין
        ב-desktop וה-tab-bar בתחתית במובייל — המעטפת עובדת. רוב הפריטים
        בניווט עדיין לא קיימים, לכן לחיצה תחזיר 404 עד שנעביר את הדפים
        בשלב 3.
      </p>

      <ul className="mt-8 space-y-3 text-[18px] leading-relaxed text-white/85">
        <li>✓ פלטה: רקע גרדיאנט חמים, כרטיסים סגול-יין</li>
        <li>✓ פונט: Assistant (כבר טעון ב-root layout)</li>
        <li>✓ סייד-בר ימני (lg+): CoupleCard + 7 פריטים + Logout + ExpertMini</li>
        <li>✓ מובייל: 4 טאבים תחתונים + ״עוד״, עם safe-area inset</li>
        <li>✓ אקטיב = רקע עדין + קו גרדיאנט אנכי דק (לא כפתור)</li>
      </ul>

      <div
        className="mt-8 rounded-2xl border p-5"
        style={{
          borderColor: "var(--shell-line-soft)",
          background: "var(--shell-card)",
        }}
      >
        <div className="text-[14px] font-bold uppercase tracking-widest text-[var(--shell-pink-text)]">
          טוקני CSS
        </div>
        <div className="mt-3 text-[15px] leading-relaxed text-white/75">
          כל המעטפת בסקופ <code className="rounded bg-black/30 px-1.5 py-0.5">.app-shell</code> —
          הטוקנים לא דולפים להומפייג או לעמודי משחק.
        </div>
      </div>
    </div>
  );
}
