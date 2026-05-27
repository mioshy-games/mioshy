"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import QRCode from "react-qr-code";
import {
  Check,
  Copy,
  Download,
  HelpCircle,
  MessageCircle,
  QrCode,
  Smartphone,
  X,
} from "lucide-react";
import { useCmsText } from "@/hooks/useCmsText";

/**
 * PartnerShareCard
 *
 * The headline "share your code with your partner" widget that lives inside
 * the active-membership banner on /my. Visually it's a single horizontal
 * row built to slot under the existing "Status: Active member" copy.
 *
 * Why this exists vs. the old `<PairCodeWidget compact/>` already at the
 * bottom of /my: the old widget was a tiny chip buried below the pillar
 * grid. New subscribers had no obvious "now share with your partner" CTA
 * and we saw drop-off in the pair-completion rate. The new widget makes
 * the code a *first-class action* the moment a subscription goes live.
 *
 * Display contract — caller is responsible for the conditional render:
 *   - Show only when the user has an ACTIVE subscription AND
 *     `needsPartner === true`. The widget itself doesn't check this; it
 *     just renders whatever pairCode it's handed.
 *
 * The component is a Client Component because it needs:
 *   - clipboard.writeText (Copy button)
 *   - useState for the QR modal toggle
 *   - useEffect to detect mobile UA so the SMS button only renders there
 *
 * CMS strings are resolved via useCmsText so admins can A/B the copy
 * without a deploy. All keys live under the `myHub.share.*` namespace.
 */

const HOW_TO_SHARE_PATHS: Record<"he" | "en", string> = {
  he: "/how-to-share-with-partner",
  en: "/how-to-share-with-partner",
};

function buildShareLink(pairCode: string, locale: "he" | "en"): string {
  // Prefer the production origin when running in the browser so the URL
  // we put into a SMS / WhatsApp message is always absolute and clickable
  // outside the app. SSR fallback uses a relative path which will not be
  // shipped to the user because this is a Client Component — the
  // template is only ever read at click time inside the handlers below.
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://mioshy.com";
  // Code arrives on the signup page via ?code= — see SignupForm wiring
  // and app/[locale]/auth/signup/page.tsx for the prefill handshake.
  return `${origin}/${locale}/auth/signup?code=${encodeURIComponent(pairCode)}`;
}

export function PartnerShareCard({
  pairCode,
}: {
  pairCode: string;
}) {
  const locale = useLocale() as "he" | "en";
  const isHe = locale === "he";

  const titleText = useCmsText("myHub.share.title").text;
  const ledeText = useCmsText("myHub.share.lede").text;
  const copyText = useCmsText("myHub.share.copyBtn").text;
  const copiedText = useCmsText("myHub.share.copied").text;
  const whatsappText = useCmsText("myHub.share.whatsappBtn").text;
  const smsText = useCmsText("myHub.share.smsBtn").text;
  const qrText = useCmsText("myHub.share.qrBtn").text;
  const howItWorksText = useCmsText("myHub.share.howItWorks").text;
  const shareMessageTemplate = useCmsText("myHub.share.message").text;
  const qrCaptionText = useCmsText("myHub.share.qrCaption").text;
  const downloadQrText = useCmsText("myHub.share.downloadQr").text;
  const closeText = useCmsText("myHub.share.close").text;

  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Only render the SMS button on devices where `sms:` URIs reliably
  // open the messaging app. Desktop browsers will either prompt for an
  // app association (annoying) or silently no-op — so we hide the
  // button there entirely.
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ua = navigator.userAgent || "";
    const mobile =
      /iPhone|iPad|iPod|Android|Mobile/i.test(ua) ||
      (typeof window !== "undefined" &&
        window.matchMedia?.("(pointer: coarse)").matches);
    setIsMobile(!!mobile);
  }, []);

  // Build the share URL lazily on each click so SSR doesn't try to read
  // window.location.
  function getShareUrl() {
    return buildShareLink(pairCode, locale);
  }

  function getShareMessage() {
    // `{code}` and `{url}` placeholders are substituted at click time so
    // admins can rearrange the template without redeploying.
    const tpl =
      shareMessageTemplate && shareMessageTemplate.trim().length > 0
        ? shareMessageTemplate
        : isHe
          ? "היי, הצטרפ/י אליי לחוויית מיאושי. הקוד שלנו הוא {code}. הרשמה: {url}"
          : "Hey, join me on Mioshy. Our code is {code}. Sign up: {url}";
    return tpl.replace("{code}", pairCode).replace("{url}", getShareUrl());
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(pairCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Some browsers (older Safari, locked-down enterprise envs) block
      // clipboard.writeText. Fall back to selecting the code in a
      // hidden input so the user can manually Ctrl+C.
      const input = document.createElement("input");
      input.value = pairCode;
      document.body.appendChild(input);
      input.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      } catch {
        /* ignore */
      }
      document.body.removeChild(input);
    }
  }

  function handleWhatsapp() {
    const text = encodeURIComponent(getShareMessage());
    // wa.me/?text= opens the WhatsApp app or web; works on both mobile
    // and desktop without picking a recipient (the user chooses inside
    // WhatsApp).
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener");
  }

  function handleSms() {
    // iOS expects `sms:&body=`, Android prefers `sms:?body=`. The
    // `&` form is broadly compatible on iOS while Android tolerates
    // it via the body= parameter; using a query-string `?body=` works
    // on Android. We use `?` because Android is the dominant share
    // target in our analytics.
    const body = encodeURIComponent(getShareMessage());
    window.location.href = `sms:?body=${body}`;
  }

  return (
    <>
      <div
        // Visual treatment intentionally re-uses the parent banner's
        // colour family so the widget *belongs* to the banner instead
        // of being a second card glued underneath. Subtle inner border
        // + slightly stronger fill = "this is the action inside the
        // status banner".
        className="mt-4 rounded-2xl border border-white/15 bg-white/[0.07] p-4 backdrop-blur sm:p-5"
        data-cms-key="myHub.share.card"
      >
        <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap">
          <div className="min-w-0 flex-1">
            <p
              className="text-[16px] font-semibold text-white sm:text-[15px]"
              data-cms-key="myHub.share.title"
            >
              {titleText && titleText.trim().length > 0
                ? titleText
                : isHe
                  ? "שתפ/י עם בן/בת הזוג"
                  : "Share with your partner"}
            </p>
            <p
              className="mt-1 text-[14px] leading-[1.55] text-white/75 sm:text-[13px]"
              data-cms-key="myHub.share.lede"
            >
              {ledeText && ledeText.trim().length > 0
                ? ledeText
                : isHe
                  ? "הקוד הבא יאפשר לבן/בת זוגך לקבל גישה לכל התכנים, ללא תשלום נוסף — כל עוד המנוי שלך פעיל."
                  : "This code lets your partner unlock everything you have — at no extra cost — as long as your subscription stays active."}
            </p>
          </div>

          {/* The code itself — big, monospaced, copyable. Pinned to the
              end of the row on desktop so it visually anchors the
              widget. On mobile it flows below the lede for legibility. */}
          <div className="flex w-full items-center justify-center sm:w-auto">
            <button
              type="button"
              onClick={handleCopy}
              aria-label={isHe ? "העתקת הקוד" : "Copy code"}
              className="group inline-flex items-center gap-2.5 rounded-2xl border border-white/25 bg-white/10 px-4 py-2.5 transition hover:bg-white/15 hover:border-white/40"
            >
              <span
                className="font-mono text-[26px] font-bold tracking-[0.32em] text-white sm:text-[22px]"
                aria-live="polite"
              >
                {pairCode}
              </span>
              <span className="hidden h-6 w-px bg-white/15 sm:block" aria-hidden />
              {copied ? (
                <Check className="h-5 w-5 text-emerald-300" aria-hidden />
              ) : (
                <Copy className="h-5 w-5 text-white/70 transition group-hover:text-white" aria-hidden />
              )}
            </button>
          </div>
        </div>

        {/* Action row — Copy / WhatsApp / SMS (mobile) / QR.
            All buttons share one row on desktop and wrap onto a 2x2
            grid on narrow viewports. */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex h-11 min-h-[44px] items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            <span data-cms-key="myHub.share.copyBtn">
              {copied
                ? copiedText && copiedText.trim().length > 0
                  ? copiedText
                  : isHe
                    ? "הועתק"
                    : "Copied"
                : copyText && copyText.trim().length > 0
                  ? copyText
                  : isHe
                    ? "העתק/י"
                    : "Copy"}
            </span>
          </button>

          <button
            type="button"
            onClick={handleWhatsapp}
            className="inline-flex h-11 min-h-[44px] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-green-500 px-4 text-sm font-semibold text-white shadow-md transition hover:brightness-110"
          >
            <MessageCircle className="h-4 w-4" />
            <span data-cms-key="myHub.share.whatsappBtn">
              {whatsappText && whatsappText.trim().length > 0
                ? whatsappText
                : isHe
                  ? "WhatsApp"
                  : "WhatsApp"}
            </span>
          </button>

          {isMobile ? (
            <button
              type="button"
              onClick={handleSms}
              className="inline-flex h-11 min-h-[44px] items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              <Smartphone className="h-4 w-4" />
              <span data-cms-key="myHub.share.smsBtn">
                {smsText && smsText.trim().length > 0
                  ? smsText
                  : isHe
                    ? "SMS"
                    : "SMS"}
              </span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="inline-flex h-11 min-h-[44px] items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            <QrCode className="h-4 w-4" />
            <span data-cms-key="myHub.share.qrBtn">
              {qrText && qrText.trim().length > 0
                ? qrText
                : isHe
                  ? "הצג/י QR"
                  : "Show QR"}
            </span>
          </button>
        </div>

        {/* "How does this work?" link — quiet, sits under the buttons.
            Routes to the dedicated explanation page (3.4). */}
        <div className="mt-3 flex justify-end">
          <a
            href={`/${locale}${HOW_TO_SHARE_PATHS[locale]}`}
            className="inline-flex items-center gap-1 text-[12px] text-white/60 underline-offset-2 transition hover:text-white hover:underline"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span data-cms-key="myHub.share.howItWorks">
              {howItWorksText && howItWorksText.trim().length > 0
                ? howItWorksText
                : isHe
                  ? "איך זה עובד?"
                  : "How does this work?"}
            </span>
          </a>
        </div>
      </div>

      {qrOpen ? (
        <QrModal
          pairCode={pairCode}
          shareUrl={getShareUrl()}
          isHe={isHe}
          caption={qrCaptionText}
          downloadLabel={downloadQrText}
          closeLabel={closeText}
          onClose={() => setQrOpen(false)}
        />
      ) : null}
    </>
  );
}

// ─── QR Modal ────────────────────────────────────────────────────────────────
//
// react-qr-code renders an SVG. To let the user "Download as image" we
// re-serialize the SVG, draw it onto a canvas with a white background
// and a small margin, then trigger a PNG download. No extra library
// needed — Canvas + the SVG <-> Image roundtrip is enough.

function QrModal({
  pairCode,
  shareUrl,
  isHe,
  caption,
  downloadLabel,
  closeLabel,
  onClose,
}: {
  pairCode: string;
  shareUrl: string;
  isHe: boolean;
  caption: string;
  downloadLabel: string;
  closeLabel: string;
  onClose: () => void;
}) {
  const qrWrapperRef = useRef<HTMLDivElement | null>(null);

  // Trap Escape + lock body scroll while the modal is open — same
  // pattern as RedeemDialog elsewhere in the codebase.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = original;
    };
  }, [onClose]);

  async function handleDownload() {
    const svg = qrWrapperRef.current?.querySelector("svg");
    if (!svg) return;

    // 1. Serialise the SVG to a string. Need to clone first so we can
    //    safely add explicit width/height attributes for the Image
    //    constructor (some browsers fail to load an SVG without them).
    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute("width", "512");
    clone.setAttribute("height", "512");
    const xml = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    try {
      // 2. Load the SVG into an Image, then draw it onto a canvas with
      //    a white margin so the QR scans cleanly when printed against
      //    arbitrary backgrounds.
      const img = new Image();
      const PADDING = 32;
      const SIZE = 512;
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("svg load failed"));
        img.src = url;
      });

      const canvas = document.createElement("canvas");
      canvas.width = SIZE + PADDING * 2;
      canvas.height = SIZE + PADDING * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, PADDING, PADDING, SIZE, SIZE);

      // 3. Trigger the download via an anchor with .download set.
      canvas.toBlob((blob) => {
        if (!blob) return;
        const pngUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = pngUrl;
        a.download = `mioshy-pair-${pairCode}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(pngUrl);
      }, "image/png");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      dir={isHe ? "rtl" : "ltr"}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-gradient-to-br from-violet-950 via-fuchsia-950 to-rose-950 p-6 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel || (isHe ? "סגירה" : "Close")}
          className="absolute end-3 top-3 rounded-full p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center gap-4 text-center">
          <div
            ref={qrWrapperRef}
            className="rounded-2xl bg-white p-4 shadow-lg"
            // QR codes need quiet space around the modules to scan
            // reliably. The padding here is the white frame around the
            // dark modules.
          >
            <QRCode
              value={shareUrl}
              size={208}
              level="M"
              bgColor="#ffffff"
              fgColor="#0f172a"
            />
          </div>

          <div>
            <p className="font-mono text-2xl font-bold tracking-[0.32em] text-fuchsia-100">
              {pairCode}
            </p>
            <p
              className="mt-2 text-sm leading-[1.55] text-white/75"
              data-cms-key="myHub.share.qrCaption"
            >
              {caption && caption.trim().length > 0
                ? caption
                : isHe
                  ? "סרקו עם המצלמה כדי לעבור ישירות לעמוד ההרשמה — הקוד יוזן אוטומטית."
                  : "Scan with the camera to jump straight to signup — the code fills itself in."}
            </p>
          </div>

          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex h-11 min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-fuchsia-700 shadow-md transition hover:bg-fuchsia-50"
          >
            <Download className="h-4 w-4" />
            <span data-cms-key="myHub.share.downloadQr">
              {downloadLabel && downloadLabel.trim().length > 0
                ? downloadLabel
                : isHe
                  ? "הורד/י את ה-QR כתמונה"
                  : "Download QR as image"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
