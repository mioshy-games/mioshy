"use client";

/**
 * BackfillClassifierButton
 *
 * Phase 6 — admin-side trigger for the historical-message classifier.
 * Lives on /dashboard/journey/metrics next to the "Concerning + urgent"
 * panel. Calls POST /api/journey/classify-backfill, surfaces results
 * inline.
 *
 * Why admin trigger (not auto-cron): cost predictability — Itzik
 * decides when to spend the LLM budget. Once the backlog is cleared
 * the new-message hook handles ongoing classification.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { t } from "@/lib/admin/i18n";
import type { AdminLocale } from "@/lib/admin/locale";

interface BackfillResult {
  ok:         boolean;
  classified: number;
  failed:     number;
  remaining:  number;
  errors:     string[];
}

export function BackfillClassifierButton({
  locale = "en",
}: {
  locale?: AdminLocale;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [last, setLast] = useState<BackfillResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const trigger = () => {
    setErr(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/journey/classify-backfill", {
          method: "POST",
        });
        const json: BackfillResult = await res.json();
        if (!res.ok || !json.ok) {
          setErr(
            json.errors?.[0] ?? `HTTP ${res.status} — see server logs`,
          );
          setLast(json);
          return;
        }
        setLast(json);
        // Refresh the page so the urgent panel picks up the newly
        // classified rows.
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Network error");
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <button
        type="button"
        onClick={trigger}
        disabled={pending}
        className="bg-primary text-primary-foreground inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        {pending
          ? t(locale, "journey.backfill.classifying")
          : t(locale, "journey.backfill.button")}
      </button>

      {err ? (
        <span className="text-destructive">{err}</span>
      ) : last ? (
        <span className="text-muted-foreground">
          {t(locale, "journey.backfill.classified")}{" "}
          <strong className="text-foreground">{last.classified}</strong>
          {last.failed > 0 ? ` · ${last.failed} ${t(locale, "journey.backfill.failed")}` : ""}
          {" · "}
          <strong className="text-foreground">{last.remaining}</strong>{" "}
          {t(locale, "journey.backfill.remaining")}
          {last.remaining > 0
            ? ` ${t(locale, "journey.backfill.run_again")}`
            : ` ${t(locale, "journey.backfill.all_done")}`}
        </span>
      ) : (
        <span className="text-muted-foreground">
          {t(locale, "journey.backfill.hint")}
        </span>
      )}
    </div>
  );
}
