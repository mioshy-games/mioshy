/**
 * SettingsRow — generic clickable row in a settings list.
 *
 * Used by /my/settings and any other shell page that needs a tap-to-
 * navigate list of items with icon + title + sub-line + (optional)
 * right-aligned status badge or chevron.
 *
 * Renders as a <Link> when href is internal, an <a> when external
 * (e.g. invoices hosted on the billing provider), and a <div> when
 * neither — useful for non-interactive informational rows.
 */

import { Link } from "@/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

interface Props {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  subtitle?: string | null;
  /** Internal href (locale-aware via @/navigation). */
  href?: string;
  /** External href, opens in new tab. */
  externalHref?: string;
  /** Status badge text — e.g. "פעיל". Null = no badge. */
  badgeLabel?: string | null;
  /** "active" tints the badge sage, "neutral" uses muted card tone. */
  badgeTone?: "active" | "neutral";
  /** When true, the document is RTL — picks the back-arrow direction. */
  isHe: boolean;
}

export function SettingsRow({
  Icon,
  title,
  subtitle,
  href,
  externalHref,
  badgeLabel,
  badgeTone = "neutral",
  isHe,
}: Props) {
  const Chevron = isHe ? ChevronLeft : ChevronRight;
  const inner = (
    <>
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]"
        style={{
          background: "rgba(255,255,255,0.05)",
          color: "var(--shell-text-2)",
        }}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="truncate text-[15px] font-bold"
          style={{ color: "var(--shell-text-1)" }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            className="mt-0.5 truncate text-[14px]"
            style={{ color: "var(--shell-text-3)" }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
      {badgeLabel ? (
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[12px] font-bold"
          style={
            badgeTone === "active"
              ? {
                  background: "var(--shell-sage-soft)",
                  color: "var(--shell-sage)",
                }
              : {
                  background: "rgba(255,255,255,0.06)",
                  color: "var(--shell-text-2)",
                }
          }
        >
          {badgeLabel}
        </span>
      ) : href || externalHref ? (
        <span className="shrink-0" style={{ color: "var(--shell-text-3)" }}>
          <Chevron className="h-3.5 w-3.5" aria-hidden />
        </span>
      ) : null}
    </>
  );

  const wrapperClass =
    "flex items-center gap-3 rounded-[12px] border p-3.5 transition";
  const wrapperStyle: React.CSSProperties = {
    background: "var(--shell-card)",
    borderColor: "var(--shell-line-soft)",
  };

  if (href) {
    return (
      <Link
        href={href}
        className={`${wrapperClass} hover:brightness-110`}
        style={wrapperStyle}
      >
        {inner}
      </Link>
    );
  }
  if (externalHref) {
    return (
      <a
        href={externalHref}
        target="_blank"
        rel="noopener noreferrer"
        className={`${wrapperClass} hover:brightness-110`}
        style={wrapperStyle}
      >
        {inner}
      </a>
    );
  }
  return (
    <div className={wrapperClass} style={wrapperStyle}>
      {inner}
    </div>
  );
}
