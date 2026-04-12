"use client";

import { useLocale } from "next-intl";
import { Link, usePathname } from "@/navigation";

const locales = ["he", "en"] as const;

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 rounded-full border border-white/20 bg-white/10 p-1 text-xs font-medium text-white backdrop-blur">
      {locales.map((loc) => (
        <Link
          key={loc}
          href={pathname}
          locale={loc}
          className={`rounded-full px-3 py-1 transition ${
            locale === loc
              ? "bg-white text-fuchsia-900 shadow"
              : "text-white/90 hover:bg-white/10"
          }`}
        >
          {loc.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}
