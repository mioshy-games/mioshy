import {
  Activity,
  CheckCircle2,
  MessageSquare,
  RotateCcw,
  X,
} from "lucide-react";
import { listUserActivity, type ActivityEntry } from "@/lib/journey/activity";

const VERB_LABEL_HE: Record<ActivityEntry["verb"], string> = {
  item_opened: "פתחתם",
  item_completed: "סימנתם כבוצע",
  item_uncompleted: "ביטלתם סימון",
  response_posted: "הוספתם תגובה ל",
  response_deleted: "מחקתם תגובה ל",
};
const VERB_LABEL_EN: Record<ActivityEntry["verb"], string> = {
  item_opened: "opened",
  item_completed: "completed",
  item_uncompleted: "un-completed",
  response_posted: "replied to",
  response_deleted: "deleted reply to",
};

const VERB_ICON: Record<ActivityEntry["verb"], React.ComponentType<{ className?: string }>> = {
  item_opened: Activity,
  item_completed: CheckCircle2,
  item_uncompleted: RotateCcw,
  response_posted: MessageSquare,
  response_deleted: X,
};

function relativeTime(iso: string, isHe: boolean): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return isHe ? "ממש עכשיו" : "just now";
  if (minutes < 60) return isHe ? `לפני ${minutes} דקות` : `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return isHe ? `לפני ${hours} שעות` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return isHe ? `לפני ${days} ימים` : `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export async function UserRecentActivity({
  userId,
  isHe,
}: {
  userId: string;
  isHe: boolean;
}) {
  const events = await listUserActivity(userId, 12).catch(() => []);

  if (events.length === 0) {
    return (
      <div className="border-white/10 bg-white/5 text-white/70 rounded-2xl border p-5 text-sm">
        {isHe
          ? "עוד לא נרשמה פעילות. תתחילו עם המשימה הבאה למעלה."
          : "No activity yet - start with the next chapter above."}
      </div>
    );
  }

  const labels = isHe ? VERB_LABEL_HE : VERB_LABEL_EN;

  return (
    <ul className="border-white/10 bg-white/5 divide-white/10 divide-y rounded-2xl border backdrop-blur-sm">
      {events.map((e) => {
        const Icon = VERB_ICON[e.verb] ?? Activity;
        return (
          <li key={e.id} className="flex items-start gap-3 px-4 py-3 text-sm">
            <Icon className="mt-0.5 size-4 shrink-0 text-white/55" />
            <div className="min-w-0 flex-1 text-white/85">
              <span className="text-white/65">{labels[e.verb]}</span>{" "}
              {e.itemTitle ? (
                <span className="font-medium">{e.itemTitle}</span>
              ) : null}
            </div>
            <span className="shrink-0 text-xs text-white/45">
              {relativeTime(e.createdAt, isHe)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
