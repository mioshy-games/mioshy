"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { SUPPORT_WHATSAPP_INTL } from "@/lib/constants/contact";

/**
 * WhatsAppFloatingCta — persistent floating chat button.
 *
 * Added 2026-05-19 per Itzik. Always-available customer-service hook
 * across the Hebrew marketing surfaces:
 *   • Shows ONLY when locale is `he` (per brief: "באתר בעברית").
 *   • Hides on /journey/assessment so it doesn't compete with the
 *     focused funnel CTA flow.
 *   • Hides on /dashboard / /admin (Chrome itself doesn't render on
 *     authenticated admin surfaces, so this is defensive).
 *
 * Phone: 00972 559941658 → WhatsApp URL format: 972559941658
 * (no plus, no zeros, no spaces). Number lives in lib/constants/contact.
 *
 * The pre-filled text saves the user from having to type the first
 * line — the conversation opens with "אפשר לדבר עם שירות הלקוחות של
 * מיאושי" already in the input. They send, the support team sees the
 * intent immediately.
 *
 * Positioned bottom-LEFT of the viewport (literal left, not RTL
 * inline-start), 20px from both edges per Itzik. Note: this is
 * deliberately on the LEFT side even on the Hebrew/RTL site, because
 * the design choice is "always bottom-left corner" regardless of
 * script direction — that's why we use `left` (not
 * `insetInlineStart`, which would flip to right under RTL).
 */

const PHONE_INTL = SUPPORT_WHATSAPP_INTL; // 00 prefix stripped, no plus
const PREFILL_MSG = "אפשר לדבר עם שירות הלקוחות של מיאושי";

function whatsappHref() {
  return `https://wa.me/${PHONE_INTL}?text=${encodeURIComponent(PREFILL_MSG)}`;
}

function isHidden(pathname: string): boolean {
  // Inside the assessment funnel — don't compete with the focused flow.
  if (/\/journey\/assessment(\/|$|\?)/.test(pathname)) return true;
  // /my/* and /dashboard/* — authed surfaces, customer service goes
  // through other channels for paying members.
  if (/\/(my|dashboard|admin)(\/|$)/.test(pathname)) return true;
  return false;
}

export function WhatsAppFloatingCta({ locale }: { locale: string }) {
  const pathname = usePathname();
  const ref = useRef<HTMLAnchorElement>(null);
  // This button is NOT always on screen — it hides itself on /my/*, /dashboard/*
  // and inside the assessment funnel (see isHidden). Anything else pinned to the
  // same bottom-left corner needs to know whether it actually occupies its slot,
  // so publish presence + measured size while it is rendered and take both away
  // when it isn't. Measurement only; nothing here styles the button.
  const visible = locale === "he" && !isHidden(pathname);

  useEffect(() => {
    if (!visible) return;
    const root = document.documentElement;
    const measure = () => {
      const h = ref.current?.offsetHeight ?? 0;
      root.style.setProperty("--whatsapp-fab-h", `${h}px`);
    };
    measure();
    root.classList.add("whatsapp-fab-present");
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      root.classList.remove("whatsapp-fab-present");
      root.style.removeProperty("--whatsapp-fab-h");
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <a
      ref={ref}
      href={whatsappHref()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="פתח שיחה בוואטסאפ עם שירות הלקוחות של מיאושי"
      // 2026-05-19 — pared down to a pure icon-circle per Itzik. Text
      // label removed; the WhatsApp green + glyph + aria-label carry
      // the meaning. Fixed 56px diameter (44px+ tap target floor).
      className="fixed z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-2xl shadow-[#25D366]/40 ring-1 ring-white/15 transition hover:brightness-110 hover:shadow-[#25D366]/60"
      // 2026-05-19 — moved to absolute bottom-LEFT corner, 20px from
      // both edges, per Itzik. `left` (not insetInlineStart) so the
      // position stays on the literal left side under RTL Hebrew too.
      // safe-area-inset-bottom kept so the button doesn't disappear
      // under the iPhone home-indicator strip.
      //
      // 2026-05-23 — Itzik flagged that on mobile the button was
      // sitting ON TOP of the leftmost card in <MobileServicesBar>
      // ("הסקס של מיאושי"), making its label unreadable. The bar is
      // <lg only and ~80px tall (40px icon plate + 18px label + 16px
      // padding). On mobile we lift the button above the bar; on
      // desktop the bar isn't rendered, so we stay at the original
      // 20px offset. Tailwind doesn't expose a `bottom: calc(...)`
      // utility with media-query branching that survives JIT, so we
      // express the breakpoint with two inline tokens and pick via
      // window match in a layout effect would be overkill — instead
      // we rely on the fact that on viewports <1024px the bar is
      // present, and use a CSS variable with @media to pick the
      // larger offset there.
      style={{
        bottom:
          "calc(env(safe-area-inset-bottom, 0px) + var(--whatsapp-bottom-offset, 20px))",
        left: "20px",
      }}
    >
      {/* WhatsApp logo — inline SVG so we don't need to ship a static
          file or pull a new dependency. Standard WhatsApp glyph paths. */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 32 32"
        width="28"
        height="28"
        aria-hidden="true"
        className="flex-shrink-0"
      >
        <path
          fill="currentColor"
          d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.27-.832-2.514-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.247v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.506 3.41 4.554 4.34.616.287 2.035.93 2.722.93.346 0 2.19-.43 2.19-1.16 0-.121.121-1.39-.301-1.39-.078 0-.297-.012-.553-.07Z"
        />
        <path
          fill="currentColor"
          d="M16.001 0a15.998 15.998 0 0 0-13.6 24.488L0 32l7.717-2.348A16 16 0 1 0 16.002 0Zm0 29.317a13.275 13.275 0 0 1-7.224-2.129l-.518-.31-4.583 1.395 1.42-4.46-.337-.534a13.296 13.296 0 0 1-2.054-7.118c0-7.347 5.978-13.325 13.327-13.325s13.328 5.978 13.328 13.325c-.001 7.349-5.98 13.327-13.327 13.327Z"
        />
      </svg>
    </a>
  );
}
