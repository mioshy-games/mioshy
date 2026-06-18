/**
 * JSON-LD helpers shared across pages.
 *
 * `safeJsonLd()` escapes the closing tag sequence so a stray `</script>` in
 * any string field cannot break out of the inline `<script>` element. The
 * fields we serialize today are server-controlled (translations, slugs),
 * but defense-in-depth is cheap and prevents future regressions if a field
 * is ever sourced from user content.
 */

export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL || "https://mioshy.com";
  return raw.replace(/\/+$/, "");
}

type OrganizationJsonLd = {
  "@context": "https://schema.org";
  "@type": "Organization";
  name: string;
  alternateName?: string;
  url: string;
  logo: string;
  sameAs?: string[];
  description?: string;
  inLanguage?: string[];
};

type WebSiteJsonLd = {
  "@context": "https://schema.org";
  "@type": "WebSite";
  name: string;
  alternateName?: string;
  url: string;
  inLanguage: string[];
  publisher: { "@type": "Organization"; name: string; url: string };
  potentialAction?: {
    "@type": "SearchAction";
    target: { "@type": "EntryPoint"; urlTemplate: string };
    "query-input": string;
  };
};

export function organizationJsonLd(): OrganizationJsonLd {
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Mioshy",
    alternateName: "מיאושי",
    url: base,
    logo: `${base}/mioshy-white.svg`,
    description:
      "Mioshy — couples games and a guided journey for relationships, in Hebrew and English.",
    inLanguage: ["he", "en"],
  };
}

export function webSiteJsonLd(locale: "he" | "en"): WebSiteJsonLd {
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Mioshy",
    alternateName: "מיאושי",
    url: `${base}/${locale}`,
    inLanguage: ["he", "en"],
    publisher: {
      "@type": "Organization",
      name: "Mioshy",
      url: base,
    },
    // Sitewide search action (preserved when centralising — was previously
    // inline on the homepage @graph). Lets engines offer a sitelinks searchbox.
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${base}/${locale}/articles?query={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

// ── FAQPage (AI-readiness P0) ────────────────────────────────────────────────
// Makes the native <details> Q&A machine-readable for AI engines + Google rich
// results. Built from the same CMS keys the FAQ section renders; the caller
// resolves + cleans the strings (plain text, no markup) before passing them.

export type FaqJsonLdItem = { question: string; answer: string };

type FaqPageJsonLd = {
  "@context": "https://schema.org";
  "@type": "FAQPage";
  mainEntity: {
    "@type": "Question";
    name: string;
    acceptedAnswer: { "@type": "Answer"; text: string };
  }[];
};

export function faqPageJsonLd(items: FaqJsonLdItem[]): FaqPageJsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.question,
      acceptedAnswer: { "@type": "Answer", text: it.answer },
    })),
  };
}
