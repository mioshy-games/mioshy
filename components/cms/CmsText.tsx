"use client";

import type { JSX } from "react";
import { useCmsText } from "@/hooks/useCmsText";
import { normalizeRichText } from "@/lib/cms/render";

/**
 * Convenience renderer for CMS-managed strings that may contain
 * inline HTML markup (`<em>`, `<strong>`, `<br>`). The text is
 * sanitized on the WRITE path (admin save action), so emitting it
 * via dangerouslySetInnerHTML is safe — only the allow-listed tags
 * ever land in the database.
 *
 * Usage:
 *   <CmsText cmsKey="homeV2.hero.headline" as="h1" className="…" />
 *
 * For plain-text consumption (no markup), call `useCmsText(key).text`
 * directly and render with `{text}` — that path doesn't dangerously
 * set HTML, which is preferable for places where the copy is known
 * to be pure text (button labels, form placeholders, etc.).
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
  const { text, style } = useCmsText(cmsKey);
  // normalizeRichText rewrites the `<br></br>` ICU-style placeholders
  // (legacy next-intl t.rich syntax that the HTML parser would otherwise
  // double-render as <br><br>) into a clean `<br />`. Cheap on every
  // render — single regex on a short string. Also runs server-side via
  // loadCmsTextsForPage so CMS-backed text is already clean by the time
  // it reaches here; this branch covers the messages/*.json fallback.
  const html = normalizeRichText(text);
  const mergedStyle = style || extraStyle ? { ...style, ...extraStyle } : undefined;

  // Cast: `Tag` is a dynamic intrinsic element. JSX.IntrinsicElements
  // entries accept className/style/dangerouslySetInnerHTML uniformly,
  // but the union of all possible attribute shapes is too wide for
  // structural inference here.
  const Element = Tag as unknown as React.ComponentType<{
    className?: string;
    style?: React.CSSProperties;
    dangerouslySetInnerHTML: { __html: string };
  }>;

  return (
    <Element
      className={className}
      style={mergedStyle}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
