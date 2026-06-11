"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCmsTextContext } from "@/components/cms/CmsTextProvider";
import { resolveColorOverride } from "@/lib/cms/colors";
import type { CmsTextResult } from "@/lib/cms/types";

/**
 * Matches any opening or closing tag from the 8-tag rich-text
 * allow-list (em / strong / mark / br / p / ul / li / s).
 *
 * Used as a defensive safety net in `useCmsText` — see the
 * `effectiveIsRich` derivation below for the full reasoning. Kept
 * in sync with `RICH_ALLOWED_TAGS` in `lib/cms/sanitize.ts`.
 */
const RICH_MARKUP_RE = /<\/?(?:em|strong|mark|br|p|ul|li|s)\b/i;

/**
 * useCmsText — single point of truth for reading editable copy.
 *
 * Resolution order, in order of precedence:
 *
 *   1. CMS row from the page-level provider, for the active locale,
 *      iff the value is set AND non-empty. Per-language typography
 *      overrides on the same row turn into an inline-style return.
 *
 *   2. next-intl JSON fallback via `useTranslations()`. This means
 *      pages that haven't been wrapped in <CmsTextProvider> yet —
 *      or keys that haven't been seeded into cms_texts — continue
 *      to render the legacy translation as if nothing changed.
 *
 * Never throws. If the key doesn't exist in either source, returns
 * the key itself (next-intl's default missing-message behaviour).
 *
 * The returned `style` is `undefined` when no typography is set on
 * the active locale — so consumers can render `<span style={style}>`
 * without polluting the DOM with an empty style attribute.
 */
export function useCmsText(key: string): CmsTextResult {
  const ctx = useCmsTextContext();
  const locale = useLocale();
  // Empty namespace so the key is treated as fully-qualified, e.g.
  // `useCmsText("homeV2.hero.tag")` resolves the root-relative path.
  const t = useTranslations();

  const row = ctx?.get(key);

  const cmsValue = locale === "he" ? row?.he_text : row?.en_text;
  const trimmed = cmsValue?.trim();

  // The CMS value wins ONLY if it's a non-empty string. Empty or
  // NULL flows to JSON fallback — by design, so an admin who blanks
  // a row doesn't break the site.
  const text =
    trimmed && trimmed.length > 0
      ? cmsValue!
      : safeT(t, key);

  const fontSize = locale === "he" ? row?.he_font_size : row?.en_font_size;
  const fontWeight =
    locale === "he" ? row?.he_font_weight : row?.en_font_weight;
  const lineHeight =
    locale === "he" ? row?.he_line_height : row?.en_line_height;

  // Sprint 5 — colour override is locale-independent (one column, not
  // a he_/en_ pair) by design: a brand colour means the same thing in
  // both languages. Resolve preset name → HEX/rgba here so the
  // returned style object is consumer-ready.
  const resolvedColor = resolveColorOverride(row?.color_override ?? null);

  const style: CmsTextResult["style"] = {};
  if (fontSize) style.fontSize = fontSize;
  if (fontWeight) style.fontWeight = fontWeight;
  if (lineHeight) style.lineHeight = lineHeight;
  if (resolvedColor) style.color = resolvedColor;

  // ── isRich resolution (with safety-net) ─────────────────────────
  //
  // declaredIsRich is the authoritative answer from cms_texts.is_rich
  // (or false if the row isn't in the provider — e.g. a JSON-only key
  // that hasn't been seeded yet, or a page that hasn't been wrapped
  // in <CmsTextProvider>).
  //
  // Sprint 5+ defensive `markupDetected` — production regression
  // 2026-05-15 on `homeV2.media.headline`: the row was loaded into
  // the SSR provider correctly (cms-rich class made it into the
  // server-rendered HTML), AND the row was present in the RSC
  // payload sent to the client (verified by inspecting __next_f
  // chunks), AND the row carries is_rich=true in the DB — yet on
  // the client the headline rendered as a text node, exposing the
  // admin's `<em>` tags as literal characters. Hero/Problem with
  // the same shape rendered fine. We never fully root-caused why
  // the client computed isRich=false for that one row, but the
  // symptom was that the public site showed "<em>ואז שוב.</em>" as
  // text instead of italic span.
  //
  // The defensive layer below: if the resolved `text` contains any
  // tag from the rich-text allow-list, render as rich regardless of
  // what `declaredIsRich` says. Justified because:
  //
  //   (a) every key in messages/*.json that contains markup is
  //       intentionally rich — there is no key in the codebase that
  //       ships markup-shaped strings as plain text on purpose
  //       (audited 2026-05-15: 30 such keys, all listed in
  //       migration 083 as is_rich=true).
  //
  //   (b) showing literal `<em>` characters to a visitor is always
  //       a bug. Even if a future "tutorial about HTML" key wanted
  //       to display tags as text, it would use entity escapes
  //       (&lt;em&gt;) which won't trigger this regex.
  //
  //   (c) the SSR computes the same value (this hook runs on the
  //       server too via React's RSC + client-component path), so
  //       no hydration mismatch is introduced by the safety net.
  //
  // The diagnostic `console.warn` fires only when the safety net
  // CHANGES the answer (declared=false but markup detected). That
  // gives us a per-key telemetry signal in Vercel runtime logs (and
  // the browser console for client renders) so we can chase the
  // root cause without leaving the bug user-visible.
  const declaredIsRich = row?.is_rich ?? false;
  const markupDetected = RICH_MARKUP_RE.test(text);
  const isRich = declaredIsRich || markupDetected;

  if (markupDetected && !declaredIsRich) {
    // eslint-disable-next-line no-console
    console.warn(
      `[cms] safety-net rich detected for key "${key}" — row.is_rich=${row ? "false" : "missing"}, but rendered text contains markup. Rendering as rich. Investigate cms_texts and CmsTextProvider rows.`,
    );
  }

  return {
    text,
    isRich,
    style: Object.keys(style).length > 0 ? style : undefined,
  };
}

/**
 * Calls `t(key)` but catches the IntlError next-intl throws when the
 * key is missing. We log to console (so the admin notices the orphan)
 * and return the key string itself, matching next-intl's prod default.
 */
function safeT(t: ReturnType<typeof useTranslations>, key: string): string {
  try {
    return t(key);
  } catch (err) {
    // next-intl's t() THROWS when a JSON value contains rich-text
    // markup (<p>, <em>, …) and no tag handlers are passed — the
    // documented "<em>/<p> JSON pitfall". This bit /games FAQ answers
    // (gamesHub.faq.item*A) which ship `<p>…</p>` in messages and have
    // no cms_texts row to win first. Fall back to the RAW message so
    // the HTML survives; CmsText's markup safety-net then renders it
    // as rich. (2026-06-09)
    try {
      const raw = t.raw(key);
      if (typeof raw === "string" && raw.length > 0) return raw;
    } catch {
      /* key genuinely missing — fall through to returning the key */
    }
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(`[cms] missing translation for key "${key}"`, err);
    }
    return key;
  }
}
