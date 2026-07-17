"use client";

/**
 * CtaRangePicker — date-range selector for /dashboard/cta-clicks.
 *
 * Quick shortcuts (today / yesterday / 7 days) + a custom from/to range,
 * persisted to the URL (?range= or ?from=&to=) so the server re-queries. Same
 * pattern as OverviewRangePicker (native <input type="date"> + router.replace),
 * but with the today/yesterday presets this dashboard's spec calls for.
 */

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { t } from "@/lib/admin/i18n";
import type { AdminLocale } from "@/lib/admin/locale";
import type { CtaRangeKey } from "@/lib/dashboard/cta-clicks";

export function CtaRangePicker({
  active,
  from,
  to,
  locale,
}: {
  active: CtaRangeKey;
  from: string | null;
  to: string | null;
  locale: AdminLocale;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const push = (patches: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patches)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  const quicks: { key: CtaRangeKey; label: string }[] = [
    { key: "today", label: t(locale, "cta.range.today") },
    { key: "yesterday", label: t(locale, "cta.range.yesterday") },
    { key: "7d", label: t(locale, "cta.range.7d") },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2" aria-busy={isPending}>
      <div className="inline-flex rounded-md border p-0.5">
        {quicks.map((q) => (
          <button
            key={q.key}
            type="button"
            onClick={() => push({ range: q.key, from: null, to: null })}
            className={
              "rounded px-3 py-1 text-xs font-medium transition " +
              (active === q.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent")
            }
          >
            {q.label}
          </button>
        ))}
      </div>
      <label className="text-muted-foreground inline-flex items-center gap-1 text-xs">
        {t(locale, "cta.range.from")}
        <input
          type="date"
          value={from ?? ""}
          onChange={(e) => push({ range: "custom", from: e.target.value || null })}
          className="bg-background h-8 rounded-md border px-2 text-sm"
        />
      </label>
      <label className="text-muted-foreground inline-flex items-center gap-1 text-xs">
        {t(locale, "cta.range.to")}
        <input
          type="date"
          value={to ?? ""}
          onChange={(e) => push({ range: "custom", to: e.target.value || null })}
          className="bg-background h-8 rounded-md border px-2 text-sm"
        />
      </label>
    </div>
  );
}
