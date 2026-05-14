"use client";

import type { JSX } from "react";
import { useCmsText } from "@/hooks/useCmsText";
import { normalizeRichText } from "@/lib/cms/render";

/**
 * Universal renderer for CMS-managed strings.
 *
 * Picks its rendering strategy from `useCmsText(key).isRich`:
 *
 *   isRich = false (plain)  → renders the value as a text node.
 *                             React escapes any `<…>` so admins who
 *                             type literal angle brackets get
 *                             literal angle brackets on the public
 *                             site — not silent HTML interpretation.
 *
 *   isRich = true  (rich)   → renders via dangerouslySetInnerHTML
 *                             after `normalizeRichText` collapses
 *                             the legacy `<br></br>` pattern. The
 *                             sanitiser on save guarantees only the
 *                             7-tag allow-list ever reaches the DB,
 *                             so the HTML we emit here can't carry
 *                             attributes or unknown tags.
 *
 * Usage replaces every `{useCmsText(key).text}` consumer in the
 * marketing components. The wrapping element comes from the `as`
 * prop (defaults to <span> for inline usage). Pass any wrapping
 * className/style as usual — typography AND colour overrides from
 * the CMS row are merged automatically into the rendered element's
 * inline `style`.
 *
 * Sprint 5 — `useCmsText` now folds `cms_texts.color_override` into
 * the returned `style.color`. The merge order below is `{...cmsStyle,
 * ...callerExtraStyle}`, so a caller that explicitly passes
 * `style={{ color: '#xxx' }}` still wins over the CMS — by design,
 * for the rare callsite that must hardcode a colour. The CMS
 * override beats whatever the className would have set, because
 * inline style takes precedence over CSS in the cascade.
 *
 * Use `useCmsText(key).text` DIRECTLY (without this component) only
 * for non-DOM consumers — `alt` attributes, `aria-label`, Counter
 * suffix props, etc. — where you need the raw string.
 */
export function CmsText({
  cmsKey,
  as: Tag = "span",
  className,
  style: extraStyle,
}: {
  cmsKey: string;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { text, isRich, style } = useCmsText(cmsKey);
  const mergedStyle =
    style || extraStyle ? { ...style, ...extraStyle } : undefined;

  // In rich mode, compose a `cms-rich` class onto whatever className
  // the caller passed. That class drives the brand styling for inline
  // <em>/<strong>/<s> via app/globals.css — see ".cms-rich em" etc.
  // Without it, an <em> inside a non-headline container (e.g. <p
  // class="ag-lead">) would render in browser-default italic with
  // no colour because the legacy rule only matches h1–h4 / .lead /
  // .display.
  const finalClassName = isRich
    ? className
      ? `${className} cms-rich`
      : "cms-rich"
    : className;

  // Cast: `Tag` is a dynamic intrinsic element. JSX.IntrinsicElements
  // entries accept className/style/dangerouslySetInnerHTML uniformly,
  // but the union of all possible attribute shapes is too wide for
  // structural inference here.
  const Element = Tag as unknown as React.ComponentType<
    | {
        className?: string;
        style?: React.CSSProperties;
        children: React.ReactNode;
      }
    | {
        className?: string;
        style?: React.CSSProperties;
        dangerouslySetInnerHTML: { __html: string };
      }
  >;

  if (isRich) {
    const html = normalizeRichText(text);
    return (
      <Element
        className={finalClassName}
        style={mergedStyle}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <Element className={finalClassName} style={mergedStyle}>
      {text}
    </Element>
  );
}
