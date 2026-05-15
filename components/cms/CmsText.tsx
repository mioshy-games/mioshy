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
 * className/style as usual — typography overrides from the CMS row
 * are merged automatically into the rendered element's inline
 * `style`, and the colour override is exposed via the
 * `--cms-mark-color` custom property so `<mark>` children pick it
 * up without affecting the outer element.
 *
 * Sprint 5 — `useCmsText` folds `cms_texts.color_override` into the
 * returned `style.color`. As of the mark-scoping fix, CmsText keeps
 * that value OUT of the rendered `style.color` and instead writes it
 * to `--cms-mark-color` so only descendant `<mark>` elements adopt
 * it. A caller passing `style={{ color: '#xxx' }}` still wins for
 * the outer element. Typography keys (fontSize/fontWeight/
 * lineHeight) continue to merge straight into inline `style`.
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

  // Sprint 5 — when the row carries a colour override, forward the
  // resolved value to descendant <mark> elements ONLY, via the
  // `--cms-mark-color` custom property. The outer element keeps the
  // colour its CSS would otherwise set — so an h2.media-press-title
  // stays var(--ink) and only `<mark>...</mark>` portions take on the
  // admin's chosen colour. Same for an h1 with Tailwind text colour:
  // the heading stays its design colour and the mark is highlighted.
  //
  // Earlier behaviour (2026-05) applied `style.color` to the outer
  // element AND set `--cms-mark-color`, which meant picking a colour
  // recoloured the WHOLE heading — confusing in cases where the admin
  // wrapped a single word in <mark> expecting just that word to take
  // the colour (e.g. `gamesHub.catalogueTitle: מה <mark>משחקים</mark>
  // הלילה?` with custom #0000ff). The new shape: colour override is
  // mark-only; if an admin wants the entire row recoloured they wrap
  // the whole text in <mark>. Typography overrides (font-size /
  // font-weight / line-height) still apply to the outer element.
  //
  // Cast: React.CSSProperties doesn't know about custom properties
  // (`--foo`). The standard escape hatch is `as React.CSSProperties`
  // after building the object with the extra key.
  const cmsStyleWithMarkVar: React.CSSProperties | undefined = (() => {
    if (!style) return undefined;
    if (!style.color) return style;
    const { color: markColor, ...typographyOnly } = style;
    return {
      ...typographyOnly,
      ["--cms-mark-color"]: markColor,
    } as React.CSSProperties;
  })();

  const mergedStyle =
    cmsStyleWithMarkVar || extraStyle
      ? { ...cmsStyleWithMarkVar, ...extraStyle }
      : undefined;

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
