/**
 * /dashboard/journey/items/[id]/feedback
 *
 * Per-item feedback dashboard — distribution of the 4-button user
 * feedback for ONE journey_item across every couple that has ever
 * received it.
 *
 * Read-only. No admin response. Surfaces the signal so content ops
 * can decide whether to keep, edit, or retire an item.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  getItemFeedbackSummary,
  type FeedbackRating,
} from "@/lib/journey-content/feedback";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const RATING_LABEL: Record<FeedbackRating, { he: string; en: string; tone: "good" | "neutral" | "warn" | "bad" }> = {
  helpful:           { he: "עזר",        en: "Helpful",          tone: "good"    },
  neutral:           { he: "סבבה",       en: "Neutral",          tone: "neutral" },
  not_for_us:        { he: "לא לנו",     en: "Not for us",       tone: "warn"    },
  made_things_worse: { he: "החמיר",      en: "Made things worse", tone: "bad"    },
};

const TONE_BG: Record<"good" | "neutral" | "warn" | "bad", string> = {
  good:    "bg-emerald-500",
  neutral: "bg-slate-500",
  warn:    "bg-amber-500",
  bad:     "bg-rose-500",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ItemFeedbackPage({
  params,
}: {
  params: { id: string };
}) {
  await requireAdmin();

  const admin = await createAdminClient();
  const { data: item, error } = await admin
    .from("journey_items")
    .select("id, slug, title_he, title_en, category_id")
    .eq("id", params.id)
    .maybeSingle();

  if (error || !item) notFound();

  const itemRow = item as {
    id: string;
    slug: string;
    title_he: string;
    title_en: string | null;
    category_id: string;
  };

  const summary = await getItemFeedbackSummary(itemRow.id, 50);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href={`/dashboard/journey/items/${itemRow.id}`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" />
          Back to item
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          {itemRow.title_he}
        </h1>
        {itemRow.title_en ? (
          <p className="text-muted-foreground text-sm">
            {itemRow.title_en} · <code className="font-mono text-xs">{itemRow.slug}</code>
          </p>
        ) : null}
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total responses"
          value={summary.total.toString()}
        />
        <StatCard
          label="Helpful rate"
          value={summary.total === 0 ? "—" : `${Math.round(summary.helpfulRate * 100)}%`}
          tone={summary.helpfulRate >= 0.6 ? "good" : summary.helpfulRate >= 0.3 ? "warn" : "bad"}
        />
        <StatCard
          label="Made things worse"
          value={summary.counts.made_things_worse.toString()}
          tone={summary.counts.made_things_worse > 0 ? "bad" : "good"}
        />
      </div>

      {/* Distribution bars */}
      <section className="rounded-lg border p-5">
        <h2 className="mb-4 text-sm font-semibold">Distribution</h2>
        {summary.total === 0 ? (
          <p className="text-muted-foreground text-sm">
            No feedback yet for this item. Distribution appears after the first user submits.
          </p>
        ) : (
          <div className="space-y-3">
            {(Object.keys(RATING_LABEL) as FeedbackRating[]).map((r) => {
              const count = summary.counts[r];
              const pct = summary.total === 0 ? 0 : count / summary.total;
              const meta = RATING_LABEL[r];
              return (
                <div key={r}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium">
                      {meta.he} <span className="text-muted-foreground">/ {meta.en}</span>
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {count} · {Math.round(pct * 100)}%
                    </span>
                  </div>
                  <div className="bg-muted h-2 overflow-hidden rounded-full">
                    <div
                      className={`h-full ${TONE_BG[meta.tone]} transition-all`}
                      style={{ width: `${pct * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent text feedback */}
      <section className="rounded-lg border">
        <header className="flex items-center justify-between border-b p-4">
          <h2 className="text-sm font-semibold">Recent feedback with notes</h2>
          <span className="text-muted-foreground text-xs">
            Most recent {Math.min(50, summary.recent.length)}
          </span>
        </header>
        <ul className="divide-y">
          {summary.recent.filter((r) => r.optional_text).length === 0 ? (
            <li className="text-muted-foreground p-4 text-sm">
              No free-text feedback yet. Optional notes appear here when users add them.
            </li>
          ) : (
            summary.recent
              .filter((r) => r.optional_text)
              .map((r) => {
                const meta = RATING_LABEL[r.rating];
                return (
                  <li key={r.id} className="space-y-2 p-4">
                    <div className="flex items-center justify-between text-xs">
                      <Badge
                        variant={
                          meta.tone === "good"
                            ? "default"
                            : meta.tone === "bad"
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {meta.he}
                      </Badge>
                      <time className="text-muted-foreground">
                        {fmtDate(r.created_at)}
                      </time>
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {r.optional_text}
                    </p>
                  </li>
                );
              })
          )}
        </ul>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "good" | "neutral" | "warn" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "warn"
        ? "text-amber-700 dark:text-amber-400"
        : tone === "bad"
          ? "text-rose-700 dark:text-rose-400"
          : "text-foreground";
  return (
    <div className="rounded-lg border p-4">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}
