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

// ── BreadcrumbList ───────────────────────────────────────────────────────────
// The article, game, catalogue and mioshy-sex routes each hand-rolled their own
// breadcrumb node, which is why the pages that were never part of one of those
// templates (the homepage, /couples-assessment, /pricing, /about/founder,
// /contact and both survey pages) had none at all. This is the one builder they
// can all share.
//
// Callers pass the trail WITHOUT the home crumb — it is always position 1 and
// always the locale root, so no caller should have to remember it. `item` is
// omitted on the final crumb: Google treats a self-referencing last item as
// redundant, and leaving it off is the documented shape for "you are here".

export type BreadcrumbCrumb = { name: string; path: string };

type BreadcrumbListJsonLd = {
  "@type": "BreadcrumbList";
  itemListElement: Array<{
    "@type": "ListItem";
    position: number;
    name: string;
    item?: string;
  }>;
};

export function breadcrumbJsonLd(
  locale: "he" | "en",
  trail: BreadcrumbCrumb[],
): BreadcrumbListJsonLd {
  const base = siteUrl();
  const home = {
    name: locale === "he" ? "דף הבית" : "Home",
    path: "",
  };
  const all = [home, ...trail];
  return {
    "@type": "BreadcrumbList",
    itemListElement: all.map((crumb, i) => ({
      "@type": "ListItem" as const,
      position: i + 1,
      name: crumb.name,
      ...(i === all.length - 1
        ? {}
        : { item: `${base}/${locale}${crumb.path}` }),
    })),
  };
}

// ── Product / AggregateOffer (Journey subscription) ──────────────────────────
// Emits a Product node with an AggregateOffer whose lowPrice/highPrice span the
// ACTUAL displayed prices across enabled Journey cadences (promo first-charge
// where a promo applies, else the regular price) — never a hardcoded number.
// The caller passes an already-translated name + description so this helper
// authors no copy of its own. Returns null when no enabled cadence has a price
// (nothing to advertise) so the caller can omit the node entirely.
//
// `import type` keeps this module free of the `server-only` runtime that
// journey-subscribe-pricing pulls in — the type is fully erased at build.
type JourneyPricingLike = {
  journeyCadences: Array<{ cadence: string; price_ils: number; enabled: boolean }>;
  activePromo: {
    withoutCoaching: {
      firstChargeByCadence?: Record<string, { ils: number; usd: number }>;
    } | null;
  } | null;
};

type ProductJsonLd = {
  "@type": "Product";
  "@id": string;
  name: string;
  description?: string;
  brand: { "@type": "Brand"; name: string };
  offers: {
    "@type": "AggregateOffer";
    priceCurrency: "ILS";
    lowPrice: number;
    highPrice: number;
    offerCount: number;
    availability: "https://schema.org/InStock";
    url: string;
  };
};

export function journeyProductJsonLd(
  pricing: JourneyPricingLike,
  opts: { url: string; name: string; description?: string },
): ProductJsonLd | null {
  const promoByCadence = pricing.activePromo?.withoutCoaching?.firstChargeByCadence;
  const effective: number[] = [];
  for (const c of pricing.journeyCadences) {
    if (!c.enabled) continue;
    const promoIls = promoByCadence?.[c.cadence]?.ils;
    const price = typeof promoIls === "number" ? promoIls : c.price_ils;
    if (typeof price === "number" && price > 0) effective.push(price);
  }
  if (effective.length === 0) return null;

  return {
    "@type": "Product",
    "@id": `${opts.url}#product`,
    name: opts.name,
    description: opts.description || undefined,
    brand: { "@type": "Brand", name: "Mioshy" },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "ILS",
      lowPrice: Math.min(...effective),
      highPrice: Math.max(...effective),
      offerCount: effective.length,
      availability: "https://schema.org/InStock",
      url: opts.url,
    },
  };
}
