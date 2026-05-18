import {
  Activity,
  CheckCircle2,
  MessageSquare,
  RotateCcw,
  X,
} from "lucide-react";
import { listUserActivity, type ActivityEntry } from "@/lib/journey/activity";
import { getCmsTranslations } from "@/lib/cms/getCmsTranslations";

const VERB_ICON: Record<ActivityEntry["verb"], React.ComponentType<{ className?: string }>> = {
  item_opened: Activity,
  item_completed: CheckCircle2,
  item_uncompleted: RotateCcw,
  response_posted: MessageSquare,
  response_deleted: X,
};

/**
 * Maps internal verb codes to the corresponding CMS key under
 * journeyTimeline.activity.verb*. Kept here so the loop body stays
 * a clean lookup.
 */
const VERB_TO_KEY: Record<ActivityEntry["verb"], string> = {
  item_opened: "verbItemOpened",
  item_completed: "verbItemCompleted",
  item_uncompleted: "verbItemUncompleted",
  response_posted: "verbResponsePosted",
  response_deleted: "verbResponseDeleted",
};

function relativeTime(
  iso: string,
  isHe: boolean,
  copy: {
    justNow: string;
    minutesAgoTpl: string;
    hoursAgoTpl: string;
    daysAgoTpl: string;
  },
): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return copy.justNow;
  if (minutes < 60) return copy.minutesAgoTpl.replace("{n}", String(minutes));
  const hours = Math.round(minutes / 60);
  if (hours < 24) return copy.hoursAgoTpl.replace("{n}", String(hours));
  const days = Math.round(hours / 24);
  if (days < 7) return copy.daysAgoTpl.replace("{n}", String(days));
  return new Date(iso).toLocaleDateString(isHe ? "he-IL" : undefined, {
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
  const [events, t] = await Promise.all([
    listUserActivity(userId, 12).catch(() => []),
    getCmsTranslations({
      locale: isHe ? "he" : "en",
      namespace: "journeyTimeline.activity",
      page: "journey",
    }),
  ]);

  if (events.length === 0) {
    return (
      <div className="border-white/10 bg-white/5 text-white/70 rounded-2xl border p-5 text-sm">
        {t("empty")}
      </div>
    );
  }

  const timeCopy = {
    justNow: t("timeJustNow"),
    minutesAgoTpl: t("timeMinutesAgo"),
    hoursAgoTpl: t("timeHoursAgo"),
    daysAgoTpl: t("timeDaysAgo"),
  };

  return (
    <ul className="border-white/10 bg-white/5 divide-white/10 divide-y rounded-2xl border backdrop-blur-sm">
      {events.map((e) => {
        const Icon = VERB_ICON[e.verb] ?? Activity;
        const verbLabel = t(VERB_TO_KEY[e.verb]);
        return (
          <li key={e.id} className="flex items-start gap-3 px-4 py-3 text-sm">
            <Icon className="mt-0.5 size-4 shrink-0 text-white/55" />
            <div className="min-w-0 flex-1 text-white/85">
              <span className="text-white/65">{verbLabel}</span>{" "}
              {e.itemTitle ? (
                <span className="font-medium">{e.itemTitle}</span>
              ) : null}
            </div>
            <span className="shrink-0 text-xs text-white/45">
              {relativeTime(e.createdAt, isHe, timeCopy)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
