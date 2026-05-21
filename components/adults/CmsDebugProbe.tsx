"use client";

import { useEffect } from "react";
import { useCmsTextContext } from "@/components/cms/CmsTextProvider";

/**
 * CmsDebugProbe — 2026-05-20 — temporary diagnostic for the
 * /mioshy-sex CRM rich-text bug.
 *
 * Earlier version dumped per-key analysis to console.log which
 * Safari truncated to ~160 messages, hiding the critical detail
 * lines. This version writes the FULL analysis to
 * `window.cmsDebug` as a structured object so the user can
 * inspect it in DevTools without log truncation:
 *
 *   window.cmsDebug.providerExists   →  true / false
 *   window.cmsDebug.rowCount         →  N
 *   window.cmsDebug.byKey            →  { [key]: {...} }
 *   window.cmsDebug.suspects         →  rows where the rich-text
 *                                       safety net would NOT
 *                                       promote to rich even
 *                                       though the row contains
 *                                       markup-shaped text.
 *
 * Just type `cmsDebug` into the console and expand the object.
 */

const RICH_MARKUP_RE = /<\/?(?:em|strong|mark|br|p|ul|li|s)\b/i;
const ENTITY_MARKUP_RE = /&lt;\/?(?:em|strong|mark|br|p|ul|li|s)\b/i;

type RowAnalysis = {
  key: string;
  is_rich: boolean;
  color_override: string | null;
  he_text_preview: string;
  en_text_preview: string;
  heRawMarkup: boolean;
  heEntityMarkup: boolean;
  enRawMarkup: boolean;
  willRenderRich: boolean;
  // Raw he_text so we can inspect bytes if needed.
  he_text_raw: string | null;
};

declare global {
  interface Window {
    cmsDebug?: {
      providerExists: boolean;
      rowCount: number;
      byKey: Record<string, RowAnalysis>;
      suspects: RowAnalysis[];
      keys: string[];
    };
  }
}

export function CmsDebugProbe() {
  const ctx = useCmsTextContext();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const tag = "[cms-debug]";

    if (!ctx) {
      window.cmsDebug = {
        providerExists: false,
        rowCount: 0,
        byKey: {},
        suspects: [],
        keys: [],
      };
      // eslint-disable-next-line no-console
      console.warn(
        `${tag} FAIL — provider missing. window.cmsDebug.providerExists = false`,
      );
      return;
    }

    const byKey: Record<string, RowAnalysis> = {};
    const suspects: RowAnalysis[] = [];

    for (const [key, row] of ctx.entries()) {
      const heText = row.he_text ?? "";
      const enText = row.en_text ?? "";
      const heRaw = RICH_MARKUP_RE.test(heText);
      const heEnt = ENTITY_MARKUP_RE.test(heText);
      const enRaw = RICH_MARKUP_RE.test(enText);
      const willRenderRich = row.is_rich || heRaw || enRaw;

      const analysis: RowAnalysis = {
        key,
        is_rich: row.is_rich,
        color_override: row.color_override ?? null,
        he_text_preview: heText.slice(0, 140),
        en_text_preview: enText.slice(0, 140),
        heRawMarkup: heRaw,
        heEntityMarkup: heEnt,
        enRawMarkup: enRaw,
        willRenderRich,
        he_text_raw: row.he_text ?? null,
      };
      byKey[key] = analysis;

      // A "suspect" is a row whose visible text contains markup
      // shape but the renderer WON'T treat it as rich. That's the
      // case Itzik reports: <strong>/<br/> showing as literal text.
      const containsMarkupShape = heRaw || heEnt || enRaw;
      if (containsMarkupShape && !willRenderRich) {
        suspects.push(analysis);
      }
    }

    const keys = (Array.from(ctx.keys()) as string[]).sort();
    window.cmsDebug = {
      providerExists: true,
      rowCount: ctx.size,
      byKey,
      suspects,
      keys,
    };

    // ONE summary log so it's not lost in truncation. Detail is in
    // window.cmsDebug.
    // eslint-disable-next-line no-console
    console.log(
      `${tag} ready · rows=${ctx.size} · suspects=${suspects.length} — type 'cmsDebug' in console for the full picture.`,
    );
    if (suspects.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `${tag} suspect keys (markup shape but plain-render): ${suspects.map((s) => s.key).join(", ")}`,
      );
    }
  }, [ctx]);

  return null;
}
