/**
 * CoupleStepGuide
 *
 * Phase 13 — server component that lives at the TOP of
 * /dashboard/my-clients/[coupleId] and tells the coach exactly what
 * to do for THIS couple right now.
 *
 * Re-evaluates on every page render — refresh after any action and
 * the next step appears.
 *
 * Three sub-panels:
 *   1. Current state + next action (most prominent)
 *   2. History dropdown — collapsible by-day timeline of messages,
 *      completions, scheduled items
 *   3. Stats strip — completed / scheduled / days silent / sentiment
 */

import Link from "next/link";
import {
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Activity,
  MessageSquare,
} from "lucide-react";
import { getCoupleWorkflowState } from "@/lib/journey/couple-workflow-state";
import { Badge } from "@/components/ui/badge";

export async function CoupleStepGuide({
  coupleId,
  coupleLabel,
}: {
  coupleId:    string;
  coupleLabel: string;
}) {
  const state = await getCoupleWorkflowState(coupleId);
  const ctx = state.context;

  const toneClass =
    state.urgency === "high"
      ? "border-rose-300/40 bg-rose-500/[0.05]"
      : state.urgency === "medium"
        ? "border-amber-300/40 bg-amber-500/[0.05]"
        : state.urgency === "low"
          ? "border-blue-300/40 bg-blue-500/[0.04]"
          : "border-emerald-300/30 bg-emerald-500/[0.04]";

  return (
    <section
      dir="rtl"
      className={`rounded-2xl border p-5 ${toneClass}`}
    >
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <Sparkles className="size-4 text-amber-500" />
        <h2 className="text-base font-bold">הצעד הבא</h2>
        <Badge variant="secondary" className="text-[10px]">
          {state.label_he}
        </Badge>
      </header>

      <p className="text-foreground/90 mb-4 text-[15px] leading-relaxed">
        {state.next_action_he}
      </p>

      {ctx.lastUserMessage ? (
        <div className="bg-card/40 mb-4 rounded-md border border-dashed p-3 text-[13px]">
          <div className="text-muted-foreground mb-1 text-[10px] font-bold uppercase tracking-wider">
            הודעה אחרונה מהמשתמש
            {ctx.daysSilent != null
              ? ` · לפני ${ctx.daysSilent === 0 ? "פחות מיממה" : `${ctx.daysSilent} ימים`}`
              : ""}
          </div>
          <p className="text-foreground/85 line-clamp-3 italic">
            &ldquo;{ctx.lastUserMessage}&rdquo;
          </p>
        </div>
      ) : null}

      {/* Stats strip */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          icon={<CheckCircle2 className="size-3.5 text-emerald-500" />}
          label="הושלמו"
          value={ctx.completedItemsCount}
        />
        <Stat
          icon={<Activity className="size-3.5 text-blue-500" />}
          label="בתור"
          value={ctx.scheduledItemsCount}
        />
        {ctx.topPriority ? (
          <Stat
            label="עדיפות #1"
            value={ctx.topPriority}
          />
        ) : null}
        {ctx.latestSentiment ? (
          <Stat
            icon={<MessageSquare className="size-3.5" />}
            label="טון אחרון"
            value={ctx.latestSentiment}
          />
        ) : null}
      </div>

      <Link
        href={state.next_action_href}
        className="bg-primary text-primary-foreground inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold hover:opacity-90"
      >
        <ArrowLeft className="h-3.5 w-3.5 rtl:scale-x-[-1]" />
        {state.cta_label_he}
      </Link>

      <p className="text-muted-foreground mt-3 text-[11px]">
        החיווי מתעדכן אוטומטית — אחרי שתבצעו את הצעד, רענון העמוד יציג
        את הצעד הבא. {coupleLabel}.
      </p>
    </section>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="bg-card/40 rounded-md border p-2">
      <div className="text-muted-foreground flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <div className="text-foreground mt-0.5 text-sm font-semibold tabular-nums">
        {value}
      </div>
    </div>
  );
}
