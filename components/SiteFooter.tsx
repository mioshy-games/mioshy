"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname } from "@/navigation";
import { Sparkles, Mail, Globe } from "@/components/icons/Icons";

/**
 * Persist the user's explicit language choice as `NEXT_LOCALE` so the
 * next visit to "/" honours it. Middleware's `detectLocale` reads this
 * cookie before Geo-IP / Accept-Language. Mirrors the server-side write
 * in middleware.ts on the root rewrite. The `Secure` attribute is only
 * appended on HTTPS so the switcher still works under `pnpm dev`
 * (HTTP localhost would silently drop a Secure cookie).
 */
function setLocaleCookie(locale: "he" | "en") {
  const secure =
    window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `NEXT_LOCALE=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

export function SiteFooter() {
  const tMarketing = useTranslations("marketingHome");
  const t = useTranslations("footer");
  // Pillar labels are owned by the `nav` namespace (so they stay in sync
  // with the header). Reusing them here avoids duplicating "Online couples
  // games" / "ליווי עם מיאושי" / "למבוגרים בלבד" in two places.
  const tNav = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <footer
      dir={locale === "he" ? "rtl" : "ltr"}
      className="relative w-full bg-[#07040f] text-white"
    >
      {/* ── Top accent line ─────────────────────────────────────────────────── */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />

      {/* ── Main content ──────────────────────────────────────────────────────
          Width AND padding match SiteHeader exactly (max-w-7xl, mx-auto,
          px-4) so the header / page-content / footer share the same outer
          grid on every screen size. Previously this was full-bleed
          (`w-full px-6 lg:px-16 xl:px-24`) which let it extend beyond
          the header's right edge on wide screens. */}
      <div className="mx-auto w-full max-w-7xl px-4 py-16">
        <div className="flex flex-col gap-12 lg:flex-row lg:items-start lg:justify-start lg:gap-24">

          {/* Brand column - mobile sizes bumped to 16px tagline + 15px email
              for legibility. Was 13px / 12px which forced users to zoom. */}
          <div className="max-w-sm shrink-0 space-y-4">
            {/* Brand logomark - replaces the previous "Mioshy" text-set
                wordmark so the footer matches SiteHeader and the rest of
                the site visually. The footer always sits on a dark plate
                (`bg-[#07040f]`), so the white SVG can paint directly with
                no filter (unlike the header which inverts on light scroll). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/mioshy-white.svg"
              alt="Mioshy"
              width={171}
              height={81}
              className="h-12 w-auto"
            />
            <p className="text-base leading-relaxed text-[#D8CFE6] md:text-sm">
              {t("tagline")}
            </p>

            {/* Email */}
            <a
              href="mailto:support@mioshy.com"
              className="inline-flex items-center gap-2 text-[15px] text-[#D8CFE6] transition-colors hover:text-white md:text-sm"
            >
              <Mail className="h-4 w-4 md:h-3.5 md:w-3.5" />
              support@mioshy.com
            </a>
          </div>

          {/* Links grid - 3 columns. The middle Services column is new
              (Itzik 2026-05-06: the footer was missing a clear "what we
              sell" block). Pillar labels are pulled from the `nav`
              namespace so they stay in lockstep with the header. */}
          <div className="grid grid-cols-2 gap-x-10 gap-y-8 sm:grid-cols-3">

            {/* Explore */}
            <div className="space-y-3">
              <p className="text-[13px] font-semibold uppercase tracking-widest text-[#D8CFE6] md:text-xs">
                {t("exploreTitle")}
              </p>
              <ul className="space-y-3 text-[13px] md:space-y-2.5 md:text-xs">
                <li><Link href="/"          className="text-[#D8CFE6] transition-colors hover:text-white">{t("home")}</Link></li>
                <li><Link href="/pricing"   className="text-[#D8CFE6] transition-colors hover:text-white">{tMarketing("footer.links.pricing" as never)}</Link></li>
                <li><Link href="/articles"  className="text-[#D8CFE6] transition-colors hover:text-white">{tMarketing("footer.links.articles" as never)}</Link></li>
                <li><Link href="/account"   className="text-[#D8CFE6] transition-colors hover:text-white">{tMarketing("footer.links.account" as never)}</Link></li>
              </ul>
            </div>

            {/* Services - the three pillars, mirrors the header nav. */}
            <div className="space-y-3">
              <p className="text-[13px] font-semibold uppercase tracking-widest text-[#D8CFE6] md:text-xs">
                {t("servicesTitle")}
              </p>
              <ul className="space-y-3 text-[13px] md:space-y-2.5 md:text-xs">
                <li><Link href="/couples-assessment" className="text-[#D8CFE6] transition-colors hover:text-white">{t("servicesAssessment")}</Link></li>
                <li><Link href="/games"   className="text-[#D8CFE6] transition-colors hover:text-white">{tNav("games")}</Link></li>
                <li><Link href="/journey" className="text-[#D8CFE6] transition-colors hover:text-white">{tNav("journey")}</Link></li>
                <li><Link href="/mioshy-sex"  className="text-[#D8CFE6] transition-colors hover:text-white">{tNav("adults")}</Link></li>
              </ul>
            </div>

            {/* Legal / info */}
            <div className="space-y-3">
              <p className="text-[13px] font-semibold uppercase tracking-widest text-[#D8CFE6] md:text-xs">
                {t("infoTitle")}
              </p>
              <ul className="space-y-3 text-[13px] md:space-y-2.5 md:text-xs">
                <li><Link href="/contact" className="text-[#D8CFE6] transition-colors hover:text-white">{t("contact")}</Link></li>
                <li><Link href="/terms"   className="text-[#D8CFE6] transition-colors hover:text-white">{t("terms")}</Link></li>
                <li><Link href="/privacy" className="text-[#D8CFE6] transition-colors hover:text-white">{t("privacy")}</Link></li>
              </ul>
            </div>

          </div>
        </div>
      </div>

      {/* ── Legal row ─────────────────────────────────────────────────────────
          Single horizontal row at the bottom of the footer with all 4 legal
          links. Wraps on narrow viewports; in RTL the visual order reads
          right→left automatically because the document direction is set on
          <html>. Items separated by middle-dot. */}
      <div className="border-t border-white/[0.04]">
        <nav
          aria-label={t("legalLinks.ariaLabel")}
          className="mx-auto w-full max-w-7xl px-4 py-5"
        >
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs text-[#D8CFE6]">
            <Link
              href="/terms"
              className="transition-colors hover:text-white"
            >
              {t("legalLinks.terms")}
            </Link>
            <span aria-hidden className="text-white/25">·</span>
            <Link
              href="/refund-policy"
              className="transition-colors hover:text-white"
            >
              {t("legalLinks.refund")}
            </Link>
            <span aria-hidden className="text-white/25">·</span>
            <Link
              href="/privacy"
              className="transition-colors hover:text-white"
            >
              {t("legalLinks.privacy")}
            </Link>
            <span aria-hidden className="text-white/25">·</span>
            <Link
              href="/accessibility"
              className="transition-colors hover:text-white"
            >
              {t("legalLinks.accessibility")}
            </Link>
            <span aria-hidden className="text-white/25">·</span>
            <span className="text-[#B7AECF]">
              {t("legalLinks.copyright", { year: new Date().getFullYear() })}
            </span>
          </div>
        </nav>
      </div>

      {/* ── Bottom bar - language switch + brand line ───────────────────── */}
      <div className="border-t border-white/[0.04]">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-3 px-4 py-5 text-[13px] text-[#D8CFE6] sm:flex-row sm:items-center md:text-xs">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <p>{tMarketing("footer.copyright")}</p>
            <span aria-hidden className="text-white/15">·</span>
            <span className="inline-flex items-center gap-1.5 text-[#B7AECF]">
              <Globe className="h-3 w-3" />
              <Link
                href={pathname}
                locale="he"
                onClick={() => setLocaleCookie("he")}
                className={`transition-colors hover:text-white/70 ${
                  locale === "he"
                    ? "text-white/80 underline underline-offset-4 decoration-white/40"
                    : "text-[#D8CFE6]"
                }`}
              >
                {t("hebrew")}
              </Link>
              <span aria-hidden className="text-white/15">/</span>
              <Link
                href={pathname}
                locale="en"
                onClick={() => setLocaleCookie("en")}
                className={`transition-colors hover:text-white/70 ${
                  locale === "en"
                    ? "text-white/80 underline underline-offset-4 decoration-white/40"
                    : "text-[#D8CFE6]"
                }`}
              >
                {t("english")}
              </Link>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-purple-400/70" />
            <span className="bg-gradient-to-r from-purple-400/70 to-pink-400/70 bg-clip-text text-transparent">
              {tMarketing("footer.brandLine")}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
