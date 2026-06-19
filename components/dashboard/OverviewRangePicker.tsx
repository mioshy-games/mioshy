"use client";

/**
 * OverviewRangePicker — date-range selector for the admin overview block.
 * Quick shortcuts (24h / 7d / 30d) + a custom from/to range, persisted to the
 * URL (?range= or ?from=&to=) so the server re-fetches all metrics. Follows the
 * existing dashboard pattern (native <input type="date"> + router.replace).
 */

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { t } from "@/lib/admin/i18n";
import type { AdminLocale } from "@/lib/admin/locale";
import type { RangeKey } from "@/lib/dashboard/overview";

export function OverviewRangePicker({
  active,
  from,
  to,
  locale,
}: {
  active: RangeKey;
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

  const quicks: { key: RangeKey; label: string }[] = [
    { key: "24h", label: t(locale, "overview.range.24h") },
    { key: "7d", label: t(locale, "overview.range.7d") },
    { key: "30d", label: t(locale, "overview.range.30d") },
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
        {t(locale, "overview.range.from")}
        <input
          type="date"
          value={from ?? ""}
          onChange={(e) => push({ range: "custom", from: e.target.value || null })}
          className="bg-background h-8 rounded-md border px-2 text-sm"
        />
      </label>
      <label className="text-muted-foreground inline-flex items-center gap-1 text-xs">
        {t(locale, "overview.range.to")}
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
