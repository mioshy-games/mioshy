import "server-only"

export type GeoFromRequest = {
  countryCode: string | null   // ISO-2 from Vercel header, e.g. "IL", "US"
  isIsraeli: boolean           // countryCode === "IL"
  source: "vercel-header" | "fallback-env" | "unknown"
}

const FALLBACK_COUNTRY_DEV = "IL" // dev only - do NOT trust in prod

export function geoFromRequest(req: Request): GeoFromRequest {
  const headerCountry = (req.headers.get("x-vercel-ip-country") || "").trim().toUpperCase()
  if (headerCountry && /^[A-Z]{2}$/.test(headerCountry)) {
    return {
      countryCode: headerCountry,
      isIsraeli: headerCountry === "IL",
      source: "vercel-header",
    }
  }
  // Local dev / non-Vercel - allow opt-in via env. Never auto-default in prod.
  const isProd = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production"
  if (!isProd) {
    return {
      countryCode: FALLBACK_COUNTRY_DEV,
      isIsraeli: FALLBACK_COUNTRY_DEV === "IL",
      source: "fallback-env",
    }
  }
  return { countryCode: null, isIsraeli: false, source: "unknown" }
}

export function localeFromGeo(g: GeoFromRequest): "he" | "en" {
  return g.isIsraeli ? "he" : "en"
}

export function currencyFromGeo(g: GeoFromRequest): "ILS" | "USD" {
  return g.isIsraeli ? "ILS" : "USD"
}
