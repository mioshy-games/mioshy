"use client";

/**
 * ShareHero — the wine-tinted card with the "ghost partner" avatar
 * pair, the pair code, the copy button, and four share channels
 * (WhatsApp, SMS, Email, QR).
 *
 * Two variants:
 *   - Unpaired: ghost (dashed) avatar next to the user → invite UI.
 *   - Paired:   solid amber/wine avatar with partner's initial →
 *               "you're paired with X" celebration card, no channels.
 *
 * Layout is mobile-first; the 4 channel buttons collapse to a 2-column
 * grid below 480px to keep tap targets large.
 *
 * Client component for clipboard write + the QR modal + UA detection
 * (SMS button shows only on devices where sms:// works reliably).
 */

import { useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { Check, Copy, Mail, MessageCircle, QrCode, Smartphone, X } from "lucide-react";

interface Props {
  ownerInitial: string;
  partnerInitial: string | null;
  alreadyPaired: boolean;
  partnerName: string | null;
  pairCode: string | null;
  shareUrl: string | null;
  shareMessage: string;

  isHe: boolean;

  /** CMS-controlled labels. */
  title: string;
  body: string;
  copyLabel: string;
  copiedLabel: string;
  whatsappLabel: string;
  smsLabel: string;
  emailLabel: string;
  qrLabel: string;
  pairedTitle: string;
  pairedBody: string;
  qrCaption: string;
  closeLabel: string;
  emailSubjectLabel: string;
}

export function ShareHero(props: Props) {
  const {
    ownerInitial,
    partnerInitial,
    alreadyPaired,
    partnerName,
    pairCode,
    shareUrl,
    shareMessage,
    isHe,
    title,
    body,
    copyLabel,
    copiedLabel,
    whatsappLabel,
    smsLabel,
    emailLabel,
    qrLabel,
    pairedTitle,
    pairedBody,
    qrCaption,
    closeLabel,
    emailSubjectLabel,
  } = props;

  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qrCloseRef = useRef<HTMLButtonElement | null>(null);
  const qrTriggerRef = useRef<HTMLElement | null>(null);

  // A11y: when the QR modal opens, move keyboard focus to its close
  // button. When it closes, return focus to whatever button opened it.
  // Also wire Escape to close.
  useEffect(() => {
    if (!qrOpen) return;
    const trigger =
      typeof document !== "undefined"
        ? (document.activeElement as HTMLElement | null)
        : null;
    qrTriggerRef.current = trigger;
    // Defer focus to next tick so the dialog is in the DOM.
    const id = window.setTimeout(() => qrCloseRef.current?.focus(), 0);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setQrOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", onKey);
      // Return focus to the trigger so screen reader users don't lose place.
      qrTriggerRef.current?.focus();
    };
  }, [qrOpen]);

  // sms:// only works reliably on mobile UA. We still render the button
  // on desktop but it'll prompt for an app association; cleanest is to
  // hide it when we know we're on a desktop.
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ua = navigator.userAgent || "";
    const coarse =
      typeof window !== "undefined" &&
      window.matchMedia?.("(pointer: coarse)").matches;
    setIsMobile(/iPhone|iPad|iPod|Android|Mobile/i.test(ua) || !!coarse);
  }, []);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  async function handleCopy() {
    if (!pairCode) return;
    try {
      // Copy the bare pair code only (not the link or the full message),
      // so the primary action puts just the code on the clipboard — the
      // partner types it into the code-entry screen.
      await navigator.clipboard.writeText(pairCode);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback for browsers without clipboard permission — open a
      // temporary text-area selection. Rare in modern Chrome/Safari.
      const ta = document.createElement("textarea");
      ta.value = pairCode;
      ta.setAttribute("readonly", "true");
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
      } catch {
        /* swallowed — clipboard simply unavailable */
      } finally {
        document.body.removeChild(ta);
      }
    }
  }

  // ─── PAIRED VARIANT ──────────────────────────────────────────────
  if (alreadyPaired) {
    return (
      <section
        className="relative overflow-hidden rounded-[18px] border p-6"
        style={{
          background:
            "linear-gradient(135deg, rgba(135,168,120,0.16) 0%, var(--shell-card) 100%)",
          borderColor: "rgba(135,168,120,0.32)",
        }}
      >
        <div className="mb-3.5 flex items-center">
          <div
            className="flex h-[42px] w-[42px] items-center justify-center rounded-full border-[3px] text-[16px] font-extrabold text-white"
            style={{
              background: "linear-gradient(135deg, #EC4899 0%, #B83C4D 100%)",
              borderColor: "var(--shell-card)",
            }}
          >
            {ownerInitial}
          </div>
          {partnerInitial ? (
            <div
              className="-ms-3 flex h-[42px] w-[42px] items-center justify-center rounded-full border-[3px] text-[16px] font-extrabold text-white"
              style={{
                background: "linear-gradient(135deg, #F59E0B 0%, #B83C4D 100%)",
                borderColor: "var(--shell-card)",
              }}
            >
              {partnerInitial}
            </div>
          ) : null}
        </div>
        <h2
          className="m-0 mb-2 text-[24px] font-extrabold tracking-tight"
          style={{ color: "var(--shell-text-1)" }}
        >
          {pairedTitle.replace("{name}", partnerName ?? "")}
        </h2>
        <p
          className="m-0 text-[18px] leading-[1.55]"
          style={{ color: "var(--shell-text-2)" }}
        >
          {pairedBody}
        </p>
      </section>
    );
  }

  // ─── UNPAIRED VARIANT ────────────────────────────────────────────
  // Encoded share URLs. encodeURIComponent both message and URL — the
  // protocol handler unwraps it on the partner's side.
  const encodedMsg = encodeURIComponent(shareMessage);
  const whatsappHref = `https://wa.me/?text=${encodedMsg}`;
  const smsHref = isHe
    ? // iOS uses ? before body, Android uses ?; both accept ?body=.
      `sms:?body=${encodedMsg}`
    : `sms:?body=${encodedMsg}`;
  const mailHref = `mailto:?subject=${encodeURIComponent(emailSubjectLabel)}&body=${encodedMsg}`;

  return (
    <>
      <section
        className="relative overflow-hidden rounded-[18px] border p-6"
        style={{
          background:
            "linear-gradient(135deg, rgba(236,72,153,0.16) 0%, var(--shell-card) 100%)",
          borderColor: "var(--shell-wine-edge)",
        }}
      >
        {/* faint pink halo top-right */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(236,72,153,0.30) 0%, transparent 70%)",
          }}
        />

        {/* avatar pair — solid owner + dashed-ghost partner */}
        <div className="relative z-10 mb-3.5 flex items-center">
          <div
            className="flex h-[42px] w-[42px] items-center justify-center rounded-full border-[3px] text-[16px] font-extrabold text-white"
            style={{
              background: "linear-gradient(135deg, #EC4899 0%, #B83C4D 100%)",
              borderColor: "var(--shell-card)",
            }}
            aria-hidden
          >
            {ownerInitial}
          </div>
          <div
            className="-ms-3 flex h-[42px] w-[42px] items-center justify-center rounded-full border-2 border-dashed text-[17px] font-bold"
            style={{
              background: "var(--shell-card)",
              borderColor: "var(--shell-wine-edge)",
              color: "var(--shell-text-3)",
            }}
            aria-label={isHe ? "מקום פנוי לבן/בת זוג" : "Place reserved for partner"}
          >
            +
          </div>
        </div>

        <h2
          className="relative z-10 m-0 mb-2.5 text-[24px] font-extrabold tracking-tight"
          style={{ color: "var(--shell-text-1)" }}
        >
          {title}
        </h2>
        <p
          className="relative z-10 m-0 mb-5 max-w-[500px] text-[20px] leading-[1.55]"
          style={{ color: "var(--shell-text-1)" }}
        >
          {body}
        </p>

        {/* code row + copy button */}
        {pairCode ? (
          <div className="relative z-10 mb-3.5 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <div
              className="flex-1 rounded-[11px] border px-4 py-3 text-center font-mono text-[18px] font-bold tracking-[0.1em]"
              style={{
                background: "rgba(15,4,41,0.55)",
                borderColor: "var(--shell-line-mid)",
                color: "var(--shell-text-1)",
              }}
            >
              {pairCode}
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 rounded-[11px] px-4 py-3 text-[15px] font-bold text-white transition"
              style={{ background: "var(--shell-cta-grad)" }}
              aria-live="polite"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" aria-hidden />
                  <span>{copiedLabel}</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" aria-hidden />
                  <span>{copyLabel}</span>
                </>
              )}
            </button>
          </div>
        ) : null}

        {/* Share channels — 2-col grid below 480px (always 4 buttons on
            mobile since SMS shows there), flex-1 row above 480px so the
            3-button desktop layout (no SMS) still distributes evenly. */}
        <div className="relative z-10 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <ChannelButton
            href={whatsappHref}
            label={whatsappLabel}
            icon={<MessageCircle className="h-[18px] w-[18px]" />}
            grow
          />
          {isMobile ? (
            <ChannelButton
              href={smsHref}
              label={smsLabel}
              icon={<Smartphone className="h-[18px] w-[18px]" />}
              grow
            />
          ) : null}
          <ChannelButton
            href={mailHref}
            label={emailLabel}
            icon={<Mail className="h-[18px] w-[18px]" />}
            grow
          />
          <ChannelButton
            label={qrLabel}
            icon={<QrCode className="h-[18px] w-[18px]" />}
            onClick={() => setQrOpen(true)}
            grow
          />
        </div>
      </section>

      {/* QR modal — centered, dimmed backdrop. */}
      {qrOpen && shareUrl ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={qrLabel}
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(6,2,23,0.78)" }}
          onClick={() => setQrOpen(false)}
        >
          <div
            className="w-full max-w-[360px] rounded-[18px] border p-6 text-center"
            style={{
              background: "var(--shell-card)",
              borderColor: "var(--shell-line-mid)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              ref={qrCloseRef}
              type="button"
              onClick={() => setQrOpen(false)}
              aria-label={closeLabel}
              className="ms-auto flex h-8 w-8 items-center justify-center rounded-lg text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mx-auto my-4 inline-block rounded-[12px] bg-white p-4">
              <QRCode value={shareUrl} size={192} />
            </div>
            <p
              className="m-0 text-[15px] leading-relaxed"
              style={{ color: "var(--shell-text-2)" }}
            >
              {qrCaption}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────

interface ChannelProps {
  href?: string;
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  /** When the parent uses flex-wrap on sm+, button gets flex-1 so 3 or 4
   *  buttons distribute evenly. The mobile 2-col grid ignores it. */
  grow?: boolean;
}

function ChannelButton({ href, label, icon, onClick, grow }: ChannelProps) {
  const className = [
    "flex flex-col items-center justify-center gap-1.5 rounded-[11px] border px-2 py-3 text-[14px] font-bold text-white transition hover:brightness-110",
    grow ? "sm:min-w-[120px] sm:flex-1" : "",
  ].join(" ");
  const style = {
    background: "rgba(255,255,255,0.05)",
    borderColor: "var(--shell-line-soft)",
  } as React.CSSProperties;
  const content = (
    <>
      {icon}
      <span>{label}</span>
    </>
  );
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className} style={style}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className} style={style}>
      {content}
    </button>
  );
}
