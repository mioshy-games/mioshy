import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["he", "en"],
  defaultLocale: "he",
  // Always include the locale prefix in URLs (/he/... and /en/...).
  // The root `/` is intercepted in middleware and redirected based on
  // geolocation / Accept-Language before next-intl ever sees it.
  localePrefix: "always",
});
