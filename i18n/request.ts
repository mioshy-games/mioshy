import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

/**
 * 🚨 A missing string must NEVER take a page down (Itzik 2026-07-31).
 *
 * next-intl's default `onError` THROWS on MISSING_MESSAGE. That is how the
 * assessment results screen died: `loadCmsTextsForPage` threw once, the whole
 * namespace came back empty, and ~20 keys raised MISSING_MESSAGE at the same
 * moment — so the page failed on the first attempt and worked on the second,
 * once the CMS read succeeded. The strings were never missing; the loader was
 * momentarily unavailable, and a transient read turned into a dead end at the
 * final step of the funnel.
 *
 * Same family as the Data Cache trap in CLAUDE.md: a quiet infrastructure
 * failure surfacing as broken content.
 *
 * Contract from here on: log it, fall back, keep rendering.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (
    !locale ||
    !routing.locales.includes(locale as (typeof routing.locales)[number])
  ) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,

    onError(error) {
      // MISSING_MESSAGE is survivable by definition — getMessageFallback below
      // supplies a value. Anything else is a real config error worth shouting
      // about, but still never worth a dead page.
      const code = (error as unknown as { code?: string })?.code;
      if (code === "MISSING_MESSAGE") {
        console.warn("[i18n] missing message (using fallback)", {
          message: (error as unknown as { originalMessage?: string })?.originalMessage,
        });
        return;
      }
      console.error("[i18n] error", error);
    },

    /**
     * Last human-readable resort. Never the raw dotted path — a user seeing
     * "journeyAssessment.results.h1Ready" is barely better than a crash — so we
     * surface the final segment, de-camel-cased.
     */
    getMessageFallback({ key, namespace }) {
      const leaf = key.split(".").pop() ?? key;
      const readable = leaf
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .trim();
      console.warn("[i18n] message fallback used", { namespace, key });
      return readable || key;
    },
  };
});
