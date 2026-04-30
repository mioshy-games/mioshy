import { Activity, CheckCircle2, MessageSquare, RotateCcw, X } from "lucide-react";
import { listCoupleActivity, type ActivityEntry } from "@/lib/journey/activity";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const VERB_LABEL: Record<ActivityEntry["verb"], string> = {
  item_opened: "opened",
  item_completed: "completed",
  item_uncompleted: "un-completed",
  response_posted: "posted reply",
  response_deleted: "deleted reply",
};

const VERB_ICON: Record<ActivityEntry["verb"], React.ComponentType<{ className?: string }>> = {
  item_opened: Activity,
  item_completed: CheckCircle2,
  item_uncompleted: RotateCcw,
  response_posted: MessageSquare,
  response_deleted: X,
};

/**
 * Async server component — renders the last ~30 events for the couple.
 * Used inside the expert's couple-detail page; gracefully degrades to
 * an empty state when nothing has happened yet.
 */
export async function RecentActivity({ coupleId }: { coupleId: string }) {
  const events = await listCoupleActivity(coupleId, 30).catch((e) => {
    console.error("[RecentActivity] load failed", e);
    return [];
  });

  if (events.length === 0) {
    return (
      <div className="border-border bg-muted/30 text-muted-foreground rounded-lg border p-4 text-sm">
        No timeline activity yet.
      </div>
    );
  }

  return (
    <ul className="border-border divide-border bg-card divide-y rounded-lg border">
      {events.map((e) => {
        const Icon = VERB_ICON[e.verb] ?? Activity;
        return (
          <li
            key={e.id}
            className="flex items-start gap-3 px-4 py-2.5 text-sm"
          >
            <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="truncate">
                <span className="font-medium">
                  {e.userEmail ?? e.userId.slice(0, 8)}
                </span>{" "}
                <span className="text-muted-foreground">{VERB_LABEL[e.verb]}</span>{" "}
                {e.itemTitle ? (
                  <span className="truncate">{e.itemTitle}</span>
                ) : null}
                {e.payload && Object.keys(e.payload).length > 0 ? (
                  <span className="text-muted-foreground ms-1 text-xs">
                    {Object.entries(e.payload)
                      .map(([k, v]) => `${k}=${String(v)}`)
                      .join(" · ")}
                  </span>
                ) : null}
              </div>
            </div>
            <span className="text-muted-foreground shrink-0 text-xs">
              {fmtDate(e.createdAt)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
