import type { JSX } from "react";

/**
 * MaybeRichText — server-side renderer for admin-editable strings
 * that DON'T flow through the cms_texts pipeline.
 *
 * Use this for values pulled from settings tables, game/post DB
 * columns, or any other admin-editable source where the admin can
 * type rich-text markup but the value never reaches CmsText. Without
 * this helper such strings render via JSX `{value}` and the markup
 * (e.g. `<strong>`, `<br>`, `<mark>`) shows up as literal characters.
 *
 * Pipeline mirrors `useCmsText` exactly:
 *   - same 8-tag allow-list regex (em / strong / mark / br / p / ul /
 *     li / s) drives the rich/plain decision
 *   - same `<br></br>` → `<br />` repair
 *   - same `\n` → `<br />` lift when no block tags are present
 *   - same `cms-rich` className composed onto the wrapper in rich mode
 *     so globals.css's `.cms-rich em` / `.cms-rich mark` styling kicks
 *     in identically to a CmsText render
 *
 * Server-rendered, zero hydration cost.
 *
 * Safety: callers must only feed this with strings that are
 * sanitised/admin-authored — never raw user input. Sources we've
 * approved: experience_settings, experience_games (DB columns
 * editable only via admin).
 */

const RICH_TAGS_RE = /<\/?(?:em|strong|mark|br|p|ul|li|s)\b/i;
const BROKEN_BR_RE = /<br\s*\/?\s*><\/br\s*>/gi;
const BLOCK_TAG_RE = /<\/?(?:p|ul|ol|li|div|h[1-6])\b/i;

export function MaybeRichText({
  value,
  as: Tag = "span",
  className,
  style,
}: {
  value: string | null | undefined;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  style?: React.CSSProperties;
}) {
  const text = value ?? "";
  const isRich = RICH_TAGS_RE.test(text);

  // Cast: dynamic intrinsic element. JSX.IntrinsicElements entries
  // accept className/style/children/dangerouslySetInnerHTML uniformly
  // but the structural union is too wide for inference here.
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

  if (!isRich) {
    return (
      <Element className={className} style={style}>
        {text}
      </Element>
    );
  }

  // Same normalisation as lib/cms/render.ts: repair `<br></br>` to
  // `<br />`; then if the admin didn't structure with block tags,
  // lift `\n` to `<br />` so plain-mode line breaks survive.
  let html = text.replace(BROKEN_BR_RE, "<br />");
  if (!BLOCK_TAG_RE.test(html)) {
    html = html.replace(/\n/g, "<br />");
  }

  const richClassName = className ? `${className} cms-rich` : "cms-rich";

  return (
    <Element
      className={richClassName}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
