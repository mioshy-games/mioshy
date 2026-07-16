"use client";

/**
 * OfferPopup — results-screen coaching-offer popup (spec:
 * pull/mioshy-offer-popup-impl.md, design: pull/mioshy-offer-popup-mockup.html).
 *
 * A layer ABOVE the results screen — it changes nothing underneath; closing
 * returns the user to the normal page. Behaviour:
 *   • Trigger: IntersectionObserver on the category area — fires once.
 *   • Shown once per user (localStorage flag), only to non-subscribers who have a
 *     LIVE offer.
 *   • The countdown is anchored to the user's REAL personal-window deadline
 *     (`offerExpiresAt` = short-assessment completion + 48h, persisted
 *     server-side). It never resets on refresh, and when it passes the offer is
 *     genuinely expired (the promo stops discounting) so the popup no longer
 *     shows. This is a real deadline for a real offer — not a fake resetting
 *     timer (which would be a dark pattern).
 *   • The personal line names the couple's actual weakest category (SSOT).
 */

import { useEffect, useRef, useState } from "react";

const SEEN_KEY = "mioshy_offer_popup_seen_v1";

interface Confetto {
  x: number; y: number; vx: number; vy: number; g: number;
  s: number; c: string; r: number; vr: number; life: number;
}

export function OfferPopup({
  isHe,
  lowestCategoryName,
  offerExpiresAt,
  triggerId,
  onClaim,
}: {
  isHe: boolean;
  /** The couple's weakest category name (SSOT) for the personal line. */
  lowestCategoryName: string | null;
  /** Real offer deadline (personal window). null / past → the popup never shows. */
  offerExpiresAt: string | null;
  /** id of the element that triggers the popup when scrolled into view. */
  triggerId: string;
  /** "View the offer" — scrolls to the plans (called after the popup closes). */
  onClaim: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [remaining, setRemaining] = useState(0); // seconds to the real deadline
  const shownRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const expiresMs = offerExpiresAt ? new Date(offerExpiresAt).getTime() : null;

  // ── Trigger: show once, only for a live offer the user hasn't seen ──────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!expiresMs || Date.now() >= expiresMs) return; // offer expired → never show
    if (window.localStorage.getItem(SEEN_KEY)) return; // once per user (device)
    const el = document.getElementById(triggerId);
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !shownRef.current) {
            shownRef.current = true;
            window.localStorage.setItem(SEEN_KEY, "1");
            window.setTimeout(() => setOpen(true), 350);
            io.disconnect();
          }
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [triggerId, expiresMs]);

  // ── Countdown to the REAL deadline (refresh-safe; not a resetting timer) ────
  useEffect(() => {
    if (!open || !expiresMs) return;
    const tick = () => setRemaining(Math.max(0, Math.floor((expiresMs - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [open, expiresMs]);

  // ── Confetti burst on open ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const cv = canvasRef.current;
    const cx = cv?.getContext("2d");
    if (!cv || !cx) return;
    const size = () => {
      cv.width = window.innerWidth;
      cv.height = window.innerHeight;
    };
    size();
    const cols = ["#F43F5E", "#EC4899", "#A855F7", "#FCCA65", "#ffffff"];
    let parts: Confetto[] = [];
    for (let i = 0; i < 140; i++) {
      parts.push({
        x: window.innerWidth / 2,
        y: window.innerHeight * 0.32,
        vx: (Math.random() - 0.5) * 11,
        vy: Math.random() * -11 - 3,
        g: 0.28,
        s: 6 + Math.random() * 6,
        c: cols[i % cols.length],
        r: Math.random() * 6,
        vr: (Math.random() - 0.5) * 0.4,
        life: 120,
      });
    }
    let raf = 0;
    const loop = () => {
      cx.clearRect(0, 0, cv.width, cv.height);
      for (const p of parts) {
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= 1;
        cx.save();
        cx.translate(p.x, p.y);
        cx.rotate(p.r);
        cx.fillStyle = p.c;
        cx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
        cx.restore();
      }
      parts = parts.filter((p) => p.life > 0 && p.y < cv.height + 20);
      if (parts.length) raf = window.requestAnimationFrame(loop);
    };
    loop();
    const onResize = () => size();
    window.addEventListener("resize", onResize);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  // Escape to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  const pad = (n: number) => String(n).padStart(2, "0");
  const hh = pad(Math.floor(remaining / 3600));
  const mm = pad(Math.floor((remaining % 3600) / 60));
  const ss = pad(remaining % 60);
  const close = () => setOpen(false);
  const claim = () => { setOpen(false); onClaim(); };

  const weak = lowestCategoryName;
  const personalHe = weak
    ? `ראינו שיש מקום לחזק את ${weak} - זה הזמן.`
    : "ראינו שיש מקום לחזק את הקשר ביניכם - זה הזמן.";
  const personalEn = weak
    ? `We saw there's room to strengthen ${weak} - now is the time.`
    : "We saw there's room to strengthen your connection - now is the time.";

  return (
    <>
      <canvas ref={canvasRef} className="op-confetti" aria-hidden />
      <div
        className="op-overlay on"
        dir={isHe ? "rtl" : "ltr"}
        onClick={(e) => { if (e.target === e.currentTarget) close(); }}
      >
        <div className="op-modal" role="dialog" aria-modal="true" aria-label={isHe ? "הצעת מבצע" : "Special offer"}>
          <button className="op-close" onClick={close} aria-label={isHe ? "סגירה" : "Close"}>✕</button>
          <div className="op-hero">
            <div className="op-glow" aria-hidden />
            <span className="op-badge">{isHe ? "מבצע 48 שעות" : "48-hour offer"}</span>
            {/* Small decorative popup image; next/image is overkill inside a
                fixed one-off modal. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/sale.webp" alt="" className="op-img" />
          </div>
          <div className="op-body">
            <h2>{isHe ? "מבצע ל-48 שעות בלבד" : "48 hours only"}</h2>
            <p>{isHe ? personalHe : personalEn}</p>
            <p>
              {isHe ? (
                <>הצטרפו עכשיו לתוכנית הליווי של מיאושי, עם מומחה זוגיות <b>צמוד אליכם</b> לאורך כל הדרך.</>
              ) : (
                <>Join Mioshy&apos;s coaching plan now, with a relationship expert <b>by your side</b> the whole way.</>
              )}
            </p>
            <div className="op-once">{isHe ? "מבצע חד-פעמי שלא יחזור על עצמו." : "A one-time offer that won't repeat."}</div>
            <div className="op-clabel">{isHe ? "המבצע נגמר בעוד" : "Offer ends in"}</div>
            <div className="op-clock">
              <div className="op-seg"><b>{hh}</b><span>{isHe ? "שעות" : "hrs"}</span></div>
              <div className="op-seg"><b>{mm}</b><span>{isHe ? "דקות" : "min"}</span></div>
              <div className="op-seg"><b>{ss}</b><span>{isHe ? "שניות" : "sec"}</span></div>
            </div>
            <button className="op-cta" onClick={claim}>{isHe ? "לצפייה בהטבה" : "View the offer"}</button>
            <button className="op-later" onClick={close}>{isHe ? "אולי מאוחר יותר" : "Maybe later"}</button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .op-confetti { position: fixed; inset: 0; pointer-events: none; z-index: 60; }
        .op-overlay {
          position: fixed; inset: 0; background: rgba(20, 8, 16, 0.55);
          -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center; padding: 18px;
          z-index: 55; opacity: 0; transition: opacity 0.3s;
          font-family: var(--font-heebo), "Heebo", system-ui, sans-serif;
        }
        .op-overlay.on { opacity: 1; }
        .op-modal {
          position: relative; width: 100%; max-width: 400px; background: #fff;
          border-radius: 26px; overflow: hidden; box-shadow: 0 30px 80px rgba(20, 8, 16, 0.4);
          transform: translateY(24px) scale(0.96);
          transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.25, 1);
        }
        .op-overlay.on .op-modal { transform: none; }
        .op-close {
          position: absolute; top: 12px; inset-inline-start: 12px; z-index: 3;
          width: 34px; height: 34px; border: 0; border-radius: 50%;
          background: rgba(255, 255, 255, 0.85); color: #333; font-size: 18px;
          cursor: pointer; line-height: 1;
        }
        .op-hero {
          position: relative; height: 150px;
          background: linear-gradient(110deg, #f43f5e 0%, #ec4899 45%, #a855f7 100%);
          display: flex; align-items: center; justify-content: center; overflow: hidden;
        }
        .op-glow { position: absolute; inset: 0; background: radial-gradient(60% 90% at 50% 120%, rgba(255, 255, 255, 0.35), transparent); }
        .op-img { position: relative; z-index: 2; max-height: 110px; max-width: 78%; object-fit: contain; filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.2)); }
        .op-badge {
          position: absolute; top: 14px; inset-inline-end: 14px; background: #fff; color: #7a1f3d;
          font-weight: 800; font-size: 12px; padding: 6px 12px; border-radius: 20px; z-index: 2;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        .op-body { padding: 22px 24px 26px; text-align: center; }
        .op-body h2 { font-weight: 800; font-size: 26px; line-height: 1.2; margin-bottom: 10px; color: #170e14; }
        .op-body p { font-size: 16px; line-height: 1.55; color: #170e14; margin-bottom: 6px; }
        .op-once { color: #7a1f3d; font-weight: 700; font-size: 15px; margin: 10px 0 4px; }
        .op-clabel { color: #6b6168; font-size: 13px; margin-top: 16px; }
        .op-clock { display: flex; justify-content: center; gap: 8px; margin-top: 8px; }
        .op-seg { background: #faf1f4; border: 1px solid rgba(122, 31, 61, 0.12); border-radius: 12px; padding: 8px 6px; min-width: 58px; }
        .op-seg b { display: block; font-size: 26px; font-weight: 800; color: #7a1f3d; line-height: 1; }
        .op-seg span { font-size: 11px; color: #6b6168; }
        .op-cta {
          display: block; width: 100%; margin-top: 20px; border: 0; border-radius: 16px;
          background: linear-gradient(110deg, #f43f5e 0%, #ec4899 45%, #a855f7 100%); color: #fff;
          font-weight: 800; font-size: 19px; padding: 16px; cursor: pointer;
          box-shadow: 0 10px 24px rgba(236, 72, 153, 0.35);
        }
        .op-later { display: block; margin: 12px auto 0; background: none; border: 0; color: #6b6168; font-size: 14px; text-decoration: underline; cursor: pointer; }
        @media (prefers-reduced-motion: reduce) {
          .op-overlay, .op-modal { transition: none; }
        }
      `}</style>
    </>
  );
}
