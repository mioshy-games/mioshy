"use client";

/**
 * AssessmentBar — white bottom banner that points from the survey to the
 * couples assessment.
 *
 * Mounted EXPLICITLY on the two survey surfaces only (app/[locale]/survey and
 * app/[locale]/(shell)/my/survey). It is deliberately not in a layout and does
 * no pathname matching — if it ever needs to appear somewhere else, that is a
 * new mount, not a new condition in here.
 *
 * ── When it shows ───────────────────────────────────────────────────────────
 *  • Only once a cookie decision exists. While the consent modal is up there is
 *    no `mioshy_cookie_consent` cookie and this renders nothing, so the two
 *    never stack. CookieConsentBar fires `mioshy:consent-decided` the moment a
 *    choice is stored, so the banner appears straight after without a reload.
 *  • Immediately on load otherwise — there is no "answer N questions first"
 *    threshold.
 *  • Dismissal is remembered in localStorage for 7 days.
 *
 * ── Not covering anything ───────────────────────────────────────────────────
 * Bottom-up the stack is MobileTabs → this banner → the floating WhatsApp
 * button. The banner sits at `bottom: var(--mobile-tabs-h)` so the dashboard's
 * mobile nav stays visible and tappable underneath it; on the anonymous survey
 * page there are no tabs, the variable is unset, and it falls back to the
 * bottom edge. It publishes its own measured height as `--assessment-bar-h`
 * plus `html.assessment-bar-open`, which globals.css uses to lift the WhatsApp
 * button above both. A same-height spacer keeps page content clear of it.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics";
import { CONSENT_DECIDED_EVENT } from "@/components/analytics/CookieConsentBar";

const DISMISS_KEY = "mioshy_assessment_bar_dismissed";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const CONSENT_COOKIE_RE = /(?:^|; )mioshy_cookie_consent=([^;]*)/;

function hasConsentDecision(): boolean {
  if (typeof document === "undefined") return false;
  const m = document.cookie.match(CONSENT_COOKIE_RE);
  const v = m ? decodeURIComponent(m[1]) : null;
  return v === "granted" || v === "dismissed";
}

function isDismissed(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < DISMISS_MS;
  } catch {
    return false; // storage blocked — treat as "not dismissed"
  }
}

export function AssessmentBar({ locale = "he" }: { locale?: "he" | "en" }) {
  const isHe = locale !== "en";
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(0);
  const shownFiredRef = useRef(false);

  // Decide visibility on mount, and again the moment a consent decision lands
  // (the modal stores the cookie without navigating).
  useEffect(() => {
    const evaluate = () => setVisible(hasConsentDecision() && !isDismissed());
    evaluate();
    window.addEventListener(CONSENT_DECIDED_EVENT, evaluate);
    return () => window.removeEventListener(CONSENT_DECIDED_EVENT, evaluate);
  }, []);

  // Publish the measured height + the document flag, and clean both up on
  // dismiss/unmount so the WhatsApp button drops back to its baseline.
  useEffect(() => {
    if (!visible) return;
    const measure = () => {
      const h = barRef.current?.offsetHeight ?? 0;
      setBarHeight(h);
      document.documentElement.style.setProperty("--assessment-bar-h", `${h}px`);
    };
    measure();
    document.documentElement.classList.add("assessment-bar-open");
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      document.documentElement.classList.remove("assessment-bar-open");
      document.documentElement.style.removeProperty("--assessment-bar-h");
    };
  }, [visible]);

  // One impression per mount.
  useEffect(() => {
    if (!visible || shownFiredRef.current) return;
    shownFiredRef.current = true;
    track("click", { target: "assessment_bar_shown", label: pathname });
  }, [visible, pathname]);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* storage blocked — the banner just returns next load */
    }
    track("click", { target: "assessment_bar_dismissed", label: pathname });
    setVisible(false);
  }, [pathname]);

  if (!visible) return null;

  const t = isHe
    ? {
        titleDesktop: "להצית את הזוגיות מחדש, עם מומחה זוגי צמוד",
        titleMobile: "להצית את הזוגיות מחדש",
        subDesktopBefore: "11 שאלות קצרות, ובסוף ",
        subDesktopEm: "תובנות וכלים",
        subDesktopAfter: " שמתאימים רק לכם",
        subMobileBefore: "11 שאלות, ובסוף ",
        subMobileEm: "תובנות וכלים",
        subMobileAfter: " ממומחה זוגי",
        cta: "לאבחון הזוגי · חינם",
        close: "סגירת הבאנר",
      }
    : {
        titleDesktop: "Reignite your relationship, with a dedicated couples expert",
        titleMobile: "Reignite your relationship",
        subDesktopBefore: "11 short questions, and at the end — ",
        subDesktopEm: "insights and tools",
        subDesktopAfter: " made just for you",
        subMobileBefore: "11 questions, then ",
        subMobileEm: "insights and tools",
        subMobileAfter: " from an expert",
        cta: "Start the assessment · Free",
        close: "Close the banner",
      };

  const em = { color: "#B4295F", fontWeight: 600 };

  return (
    <>
      <div
        ref={barRef}
        dir={isHe ? "rtl" : "ltr"}
        // Padding/gap are mobile values; the `sm:` pair restores the original
        // desktop metrics exactly, because the desktop bar has to stay 81px.
        className="fixed inset-x-0 z-[60] flex flex-col gap-[10px] p-[14px] pb-[calc(14px+env(safe-area-inset-bottom,0px))] sm:flex-row sm:items-center sm:gap-[14px] sm:px-[18px] sm:py-[13px] sm:pb-[calc(13px+env(safe-area-inset-bottom,0px))]"
        style={{
          // Stack above the dashboard's mobile tab bar where one exists; on the
          // anonymous survey page the variable is unset → flush to the edge.
          bottom: "var(--mobile-tabs-h, 0px)",
          background: "#FFFFFF",
          boxShadow: "0 -10px 34px rgba(20,8,40,.20)",
          borderTop: "1px solid rgba(27,16,39,.07)",
        }}
      >
        {/* Mobile row 1: the photo and the text column, centred against each
            other. `sm:contents` dissolves this wrapper above 640px, so the two
            become direct flex children of the bar again and the desktop row is
            unchanged. The left padding keeps the text clear of the ✕, which is
            absolutely positioned over this row on mobile only. */}
        <div className="flex w-full items-center gap-[12px] pl-[44px] sm:contents">
          <Image
            src="/images/itzik-barlev_new.webp"
            alt="יצחק ברלב"
            width={54}
            height={54}
            className="h-[48px] w-[48px] shrink-0 rounded-full object-cover sm:h-[54px] sm:w-[54px]"
            style={{
              border: "2px solid rgba(232,99,158,.35)",
              boxShadow: "0 3px 12px rgba(27,16,39,.14)",
            }}
          />

          <div className="min-w-0 flex-1 text-start">
            <div
              className="text-[19.5px] sm:text-[21px]"
              style={{ fontWeight: 800, color: "#1B1027", lineHeight: 1.24 }}
            >
              <span className="sm:hidden">{t.titleMobile}</span>
              <span className="hidden sm:inline">{t.titleDesktop}</span>
            </div>
            {/* The sub sits under the title inside the same column at BOTH
                breakpoints, so the photo is centred against title+sub together
                rather than against the title alone. */}
            <div
              className="text-[16px] sm:text-[17px]"
              style={{ fontWeight: 400, color: "#6A5B7A", lineHeight: 1.35 }}
            >
              <span className="sm:hidden">
                {t.subMobileBefore}
                <span style={em}>{t.subMobileEm}</span>
                {t.subMobileAfter}
              </span>
              <span className="hidden sm:inline">
                {t.subDesktopBefore}
                <span style={em}>{t.subDesktopEm}</span>
                {t.subDesktopAfter}
              </span>
            </div>
          </div>
        </div>

        <Link
          href={`/${isHe ? "he" : "en"}/couples-assessment`}
          onClick={() =>
            track("click", { target: "assessment_bar_cta", label: t.cta })
          }
          // Mobile row 2: full width and exactly 48px. The explicit height and
          // line-height are both mobile-only — the pill otherwise inherits the
          // body line-height and renders 53.7px. `sm:h-auto sm:leading-[unset]`
          // hands the desktop pill back its original metrics untouched.
          className="flex h-[48px] w-full shrink-0 items-center justify-center leading-[1.2] sm:h-auto sm:w-auto sm:leading-[unset]"
          style={{
            minHeight: 48,
            padding: "12px 24px",
            fontSize: 18,
            fontWeight: 600,
            color: "#2B1A06",
            whiteSpace: "nowrap",
            background: "linear-gradient(180deg,#F0B840,#E0A32B)",
            borderRadius: 11,
            boxShadow: "0 5px 16px rgba(224,163,43,.34)",
          }}
        >
          {t.cta}
        </Link>

        <button
          type="button"
          onClick={dismiss}
          aria-label={t.close}
          // Absolute in the mobile column layout, an ordinary flex item on
          // desktop. 44px keeps the touch target legal at an 18px glyph.
          className="absolute top-[8px] left-[10px] flex h-[44px] w-[44px] shrink-0 items-center justify-center sm:static sm:h-[44px] sm:w-[44px]"
          style={{ fontSize: 18, color: "#A093AE", lineHeight: 1 }}
        >
          <span aria-hidden>✕</span>
        </button>
      </div>

      {/* Keeps page content clear of the fixed banner. The dashboard shell
          already pads its <main> for MobileTabs, so this only needs to add the
          banner's own height on top of that. */}
      <div aria-hidden style={{ height: barHeight }} />
    </>
  );
}
