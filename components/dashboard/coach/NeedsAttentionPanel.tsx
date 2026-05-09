/**
 * NeedsAttentionPanel
 *
 * Phase 7 — coach-side urgent surface at top of /dashboard/my-clients.
 * Lists urgent + concerning user messages from couples THIS coach is
 * linked to via expert_couples (or — for admins viewing the page —
 * from couples in their assignment).
 *
 * Server component; pulls data via getCoachUrgentMessages.
 */

import Link from "next/link";
import { AlertCircle, ExternalLink } from "lucide-react";
import {
  getCoachUrgentMessages,
  type CoachUrgentRow,
} from "@/lib/journey/coach-urgent";
import { Badge } from "@/components/ui/badge";

export async function NeedsAttentionPanel({
  expertId,
}: {
  expertId: string;
}) {
  const rows = await getCoachUrgentMessages({ expertId, limit: 20 });
  if (rows.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-emerald-300/30 p-3 text-sm" dir="rtl">
        <span className="text-emerald-700 dark:text-emerald-300">✓</span>{" "}
        אין הודעות שדורשות התייחסות מיידית כרגע. כל הזוגות במצב יציב.
      </div>
    );
  }
  return (
    <section className="bg-card rounded-lg border border-rose-300/40" dir="rtl">
      <header className="border-b border-rose-300/20 p-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="size-4 text-rose-500" />
          <h2 className="text-sm font-semibold">דורש התייחסות</h2>
          <Badge variant="destructive" className="text-[10px]">
            {rows.length}
          </Badge>
        </div>
        <p className="text-muted-foreground mt-1 text-xs">
          הודעות עדכניות מהזוגות שלכם שה-AI סימן כדורשות תשומת לב מיידית.
          Urgent קודם.
        </p>
      </header>
      <ul className="divide-border max-h-[400px] divide-y overflow-y-auto">
        {rows.map((r) => (
          <UrgentRow key={r.id} r={r} />
        ))}
      </ul>
    </section>
  );
}

function UrgentRow({ r }: { r: CoachUrgentRow }) {
  return (
    <li className="space-y-1.5 p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge
          variant={r.sentiment === "urgent" ? "destructive" : "secondary"}
          className="text-[10px]"
        >
          {r.sentiment === "urgent" ? "🚨 דחוף" : "מדאיג"}
        </Badge>
        <span className="font-semibold">{r.couple_label}</span>
        <span className="text-muted-foreground text-[11px]">
          {new Date(r.created_at).toLocaleString("he-IL", {
            month: "2-digit",
            day:   "2-digit",
            hour:  "2-digit",
            minute:"2-digit",
          })}
        </span>
        <Link
          href={r.drill_href}
          className="text-primary inline-flex items-center gap-1 text-[11px] hover:underline ms-auto"
        >
          <ExternalLink className="size-3" />
          לפתוח את הזוג
        </Link>
      </div>
      {r.auto_tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {r.auto_tags.map((t) => (
            <span
              key={t}
              className="bg-muted rounded px-1.5 py-0.5 font-mono text-[10px]"
            >
              {t}
            </span>
          ))}
        </div>
      ) : null}
      <p className="text-foreground/90 text-sm leading-snug">
        {r.body_preview}
      </p>
    </li>
  );
}
