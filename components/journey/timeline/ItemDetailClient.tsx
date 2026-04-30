"use client";

// ============================================================
// ItemDetailClient - the interactive surface for a single timeline
// entry. Renders the item body (+ optional task / challenge / video),
// a one-tap complete toggle, and a shared response thread with a
// private-toggle.
//
// State updates are optimistic where the network trip is small
// (complete/uncomplete) and conservative where it might lose
// partner-visible data (response post - wait for server confirmation
// before clearing the textarea).
// ============================================================

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  CircleDashed,
  Loader2,
  Lock,
  MessageCircle,
  Play,
  Target,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  JourneyItem,
  JourneyItemCompletion,
  JourneyItemResponse,
  JourneyScheduledItem,
  ScheduledItemStatus,
} from "@/lib/journey-content/types";
import {
  markScheduledItemComplete,
  unmarkScheduledItemComplete,
  addScheduledItemResponse,
  deleteScheduledItemResponse,
} from "@/app/actions/journey-content-user";
import { CompletionCelebrationModal } from "@/components/journey/timeline/CompletionCelebrationModal";

interface Props {
  item: JourneyItem;
  scheduled: JourneyScheduledItem;
  status: ScheduledItemStatus;
  completion: JourneyItemCompletion | null;
  responses: JourneyItemResponse[];
  viewerUserId: string;
  locale: string;
}

export function ItemDetailClient({
  item,
  scheduled,
  status: initialStatus,
  completion: initialCompletion,
  responses: initialResponses,
  viewerUserId,
  locale,
}: Props) {
  const isHe = locale === "he";
  const router = useRouter();

  // Optimistic state - completion + responses. The parent route hydrates
  // them on revalidate, but keeping local state makes the action feel
  // instant and lets us show an in-flight spinner per row.
  const [completion, setCompletion] = React.useState<
    JourneyItemCompletion | null
  >(initialCompletion);
  const [responses, setResponses] = React.useState<JourneyItemResponse[]>(
    initialResponses,
  );
  const [busyToggle, setBusyToggle] = React.useState(false);
  const [celebrationOpen, setCelebrationOpen] = React.useState(false);

  const title = isHe ? item.title_he : item.title_en ?? item.title_he;
  const body = isHe ? item.body_he : item.body_en ?? item.body_he;
  const task = isHe ? item.task_he : item.task_en ?? item.task_he;
  const challenge = isHe
    ? item.challenge_he
    : item.challenge_en ?? item.challenge_he;

  const status: ScheduledItemStatus = completion ? "completed" : initialStatus;

  async function toggleComplete() {
    if (busyToggle) return;
    setBusyToggle(true);
    try {
      if (completion) {
        // Optimistic: clear completion locally
        const snapshot = completion;
        setCompletion(null);
        const res = await unmarkScheduledItemComplete(scheduled.id);
        if (!res.ok) {
          setCompletion(snapshot);
          toast.error(errorCopy(res.error, isHe));
          return;
        }
        toast.success(isHe ? "סומן כלא הושלם" : "Marked as not done");
      } else {
        const res = await markScheduledItemComplete(scheduled.id);
        if (!res.ok) {
          toast.error(errorCopy(res.error, isHe));
          return;
        }
        setCompletion({
          scheduled_item_id: scheduled.id,
          completed_at: res.completed_at,
          completed_by: viewerUserId,
          created_at: res.completed_at,
        });
        // Skip the toast here - the celebration modal delivers the
        // emotional reinforcement; doubling up would feel noisy.
        setCelebrationOpen(true);
      }
      router.refresh();
    } finally {
      setBusyToggle(false);
    }
  }

  async function handleAddResponse(text: string, isPrivate: boolean) {
    const res = await addScheduledItemResponse({
      scheduledItemId: scheduled.id,
      text,
      isPrivate,
    });
    if (!res.ok) {
      toast.error(errorCopy(res.error, isHe));
      return false;
    }
    setResponses((prev) => [...prev, res.response]);
    toast.success(isHe ? "התגובה נשמרה" : "Response saved");
    router.refresh();
    return true;
  }

  async function handleDeleteResponse(responseId: string) {
    // Optimistic removal
    const snapshot = responses;
    setResponses((prev) => prev.filter((r) => r.id !== responseId));
    const res = await deleteScheduledItemResponse(responseId);
    if (!res.ok) {
      setResponses(snapshot);
      toast.error(errorCopy(res.error, isHe));
      return;
    }
    toast.success(isHe ? "התגובה נמחקה" : "Response deleted");
    router.refresh();
  }

  return (
    <article className="mt-4 space-y-8">
      {/* Title block */}
      <header className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-white/65">
          <StatusBadge status={status} isHe={isHe} />
          {completion ? (
            <span className="text-xs text-white/55">
              {isHe ? "הושלם ב-" : "Completed on "}
              {new Date(completion.completed_at).toLocaleDateString(
                isHe ? "he-IL" : "en-US",
                { year: "numeric", month: "short", day: "numeric" },
              )}
            </span>
          ) : null}
        </div>
      </header>

      {/* Cover image - constrained on mobile so the actionable controls
          (complete button, response form) stay above the fold. On phones
          we clamp to a 4:3 frame with a height cap; desktop keeps the
          wider cinematic 16:8 frame. */}
      {item.image_url ? (
        <div className="relative aspect-[4/3] max-h-[40vh] w-full overflow-hidden rounded-2xl border border-white/10 sm:aspect-[16/8] sm:max-h-none">
          <Image
            src={item.image_url}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 720px"
            className="object-cover"
            priority={false}
          />
        </div>
      ) : null}

      {/* Video (inline simple embed fallback for youtube / mp4) */}
      {item.video_url ? <VideoBlock url={item.video_url} isHe={isHe} /> : null}

      {/* Body - preserve paragraphs from the admin textarea */}
      <section
        dir={isHe ? "rtl" : "ltr"}
        className="whitespace-pre-wrap text-base leading-relaxed text-white/85"
      >
        {body}
      </section>

      {/* Task */}
      {task ? (
        <Callout
          icon={<Target className="h-4 w-4" />}
          title={isHe ? "המשימה שלכם" : "Your task"}
          tone="emerald"
        >
          {task}
        </Callout>
      ) : null}

      {/* Challenge */}
      {challenge ? (
        <Callout
          icon={<Play className="h-4 w-4" />}
          title={isHe ? "אתגר נוסף" : "Bonus challenge"}
          tone="amber"
        >
          {challenge}
        </Callout>
      ) : null}

      {/* Complete toggle */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold">
              {completion
                ? isHe
                  ? "הפרק הזה הושלם"
                  : "This chapter is complete"
                : isHe
                  ? "סיימתם את הפרק?"
                  : "Finished this chapter?"}
            </div>
            <p className="mt-1 max-w-md text-xs text-white/60">
              {completion
                ? isHe
                  ? "אפשר תמיד לפתוח שוב ולענות, גם אחרי שסומן."
                  : "You can reopen and add reflections anytime, even after marking it done."
                : isHe
                  ? "סמנו כשהתרגול נעשה - זה לא חייב להיות מיד. הפרק יישאר פתוח."
                  : "Mark it once the practice is done - no rush. The chapter stays open."}
            </p>
          </div>
          <Button
            type="button"
            size="lg"
            variant={completion ? "outline" : "default"}
            onClick={() => void toggleComplete()}
            disabled={busyToggle}
            className={cn(
              "min-h-[48px] w-full sm:w-auto",
              completion
                ? "border-white/25 bg-white/5 text-white hover:bg-white/10"
                : "bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500 text-white hover:brightness-110",
            )}
          >
            {busyToggle ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            ) : completion ? (
              <CircleDashed className="me-2 h-4 w-4" />
            ) : (
              <CheckCircle2 className="me-2 h-4 w-4" />
            )}
            {completion
              ? isHe
                ? "בטל סימון הושלם"
                : "Unmark done"
              : isHe
                ? "סמן כהושלם"
                : "Mark as done"}
          </Button>
        </div>
      </div>

      {/* Response thread */}
      <section className="space-y-4">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-indigo-300" />
            <h2 className="text-lg font-semibold">
              {isHe ? "תגובות ותובנות" : "Reflections"}
            </h2>
            <span className="text-xs text-white/50">
              {responses.length > 0 ? `(${responses.length})` : null}
            </span>
          </div>
        </header>

        <ResponseList
          responses={responses}
          viewerUserId={viewerUserId}
          onDelete={(id) => void handleDeleteResponse(id)}
          isHe={isHe}
        />

        <ResponseForm onSubmit={handleAddResponse} isHe={isHe} />
      </section>

      <CompletionCelebrationModal
        open={celebrationOpen}
        onOpenChange={setCelebrationOpen}
        locale={locale}
        timelineHref={`/${locale}/journey/timeline`}
      />
    </article>
  );
}

// ------------------------------------------------------------
// StatusBadge
// ------------------------------------------------------------

function StatusBadge({
  status,
  isHe,
}: {
  status: ScheduledItemStatus;
  isHe: boolean;
}) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-100">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {isHe ? "הושלם" : "Completed"}
      </span>
    );
  }
  if (status === "available") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/50 bg-amber-400/15 px-2.5 py-1 text-xs font-semibold text-amber-100">
        {isHe ? "פתוח עכשיו" : "Open now"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white/60">
      <Lock className="h-3.5 w-3.5" />
      {isHe ? "נעול" : "Locked"}
    </span>
  );
}

// ------------------------------------------------------------
// Callout - task / challenge blocks
// ------------------------------------------------------------

function Callout({
  icon,
  title,
  tone,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  tone: "emerald" | "amber" | "indigo";
  children: React.ReactNode;
}) {
  const toneClasses =
    tone === "emerald"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-50"
      : tone === "amber"
        ? "border-amber-300/30 bg-amber-400/10 text-amber-50"
        : "border-indigo-400/30 bg-indigo-500/10 text-indigo-50";
  return (
    <aside
      className={cn(
        "rounded-2xl border px-4 py-4 backdrop-blur sm:px-5",
        toneClasses,
      )}
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide opacity-90">
        {icon}
        <span>{title}</span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/90">
        {children}
      </p>
    </aside>
  );
}

// ------------------------------------------------------------
// VideoBlock - minimal YouTube/MP4 embed
// ------------------------------------------------------------

function VideoBlock({ url, isHe }: { url: string; isHe: boolean }) {
  const yt = extractYouTubeId(url);
  if (yt) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
        <iframe
          src={`https://www.youtube.com/embed/${yt}`}
          title={isHe ? "סרטון" : "Video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
    );
  }
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
      <video
        src={url}
        controls
        className="absolute inset-0 h-full w-full object-contain"
      />
    </div>
  );
}

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1) || null;
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname.startsWith("/embed/")) return u.pathname.split("/")[2] || null;
      const v = u.searchParams.get("v");
      if (v) return v;
    }
    return null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------
// ResponseList
// ------------------------------------------------------------

function ResponseList({
  responses,
  viewerUserId,
  onDelete,
  isHe,
}: {
  responses: JourneyItemResponse[];
  viewerUserId: string;
  onDelete: (id: string) => void;
  isHe: boolean;
}) {
  if (responses.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/15 bg-white/2 px-4 py-6 text-center text-sm text-white/50">
        {isHe
          ? "עדיין אין תגובות. תוסיפו ראשונים 👇"
          : "No responses yet. Be the first 👇"}
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {responses.map((r) => {
        const mine = r.user_id === viewerUserId;
        return (
          <li
            key={r.id}
            className={cn(
              "rounded-xl border px-4 py-3 backdrop-blur",
              mine
                ? "border-indigo-400/30 bg-indigo-500/8"
                : "border-white/10 bg-white/4",
            )}
          >
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-semibold text-white/80">
                {mine
                  ? isHe
                    ? "אני"
                    : "Me"
                  : isHe
                    ? "בן/בת הזוג"
                    : "Partner"}
              </span>
              <div className="flex items-center gap-2 text-white/40">
                {r.is_private ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2 py-0.5 text-xs uppercase tracking-wide">
                    <Lock className="h-3 w-3" />
                    {isHe ? "פרטי" : "Private"}
                  </span>
                ) : null}
                <time dateTime={r.created_at}>
                  {new Date(r.created_at).toLocaleString(
                    isHe ? "he-IL" : "en-US",
                    {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                  )}
                </time>
                {mine ? (
                  <button
                    type="button"
                    onClick={() => onDelete(r.id)}
                    className="text-white/45 transition hover:text-red-300"
                    aria-label={isHe ? "מחק תגובה" : "Delete response"}
                    title={isHe ? "מחק תגובה" : "Delete response"}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/90">
              {r.response_text}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

// ------------------------------------------------------------
// ResponseForm
// ------------------------------------------------------------

const RESPONSE_MAX_LEN = 4000;

function ResponseForm({
  onSubmit,
  isHe,
}: {
  onSubmit: (text: string, isPrivate: boolean) => Promise<boolean>;
  isHe: boolean;
}) {
  const [text, setText] = React.useState("");
  const [isPrivate, setIsPrivate] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const disabled = busy || text.trim().length === 0;
  const remaining = RESPONSE_MAX_LEN - text.length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;
    setBusy(true);
    const ok = await onSubmit(text, isPrivate);
    setBusy(false);
    if (ok) {
      setText("");
      setIsPrivate(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, RESPONSE_MAX_LEN))}
        placeholder={
          isHe
            ? "שתפו מחשבה, תובנה או שאלה. התגובות משותפות עם בן/בת הזוג - אלא אם תסמנו פרטי."
            : "Share a thought, insight or question. Responses are shared with your partner unless you mark them private."
        }
        rows={3}
        className="bg-white/5 text-white placeholder:text-white/40 border-white/15"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id="response-private"
              checked={isPrivate}
              onCheckedChange={setIsPrivate}
            />
            <Label htmlFor="response-private" className="text-sm text-white/70">
              {isHe ? "פרטי (רק אני רואה)" : "Private (only me)"}
            </Label>
          </div>
          <span className="text-sm text-white/40">
            {isHe
              ? `${remaining} תווים נותרו`
              : `${remaining} characters left`}
          </span>
        </div>
        <Button
          type="submit"
          size="lg"
          disabled={disabled}
          className="min-h-[44px] bg-gradient-to-r from-indigo-500 via-emerald-500 to-teal-500 px-6 text-white hover:brightness-110"
        >
          {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
          {isHe ? "שליחה" : "Send"}
        </Button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------
// Error copy
// ------------------------------------------------------------

function errorCopy(code: string, isHe: boolean): string {
  switch (code) {
    case "login_required":
      return isHe ? "צריך להתחבר קודם." : "Please sign in first.";
    case "profile_incomplete":
      return isHe
        ? "השלימו את הפרופיל כדי להשתתף."
        : "Complete your profile to participate.";
    case "forbidden":
      return isHe
        ? "אין לכם גישה לפריט הזה."
        : "You don't have access to this item.";
    case "locked":
      return isHe
        ? "הפריט עדיין נעול - חזרו כשייפתח."
        : "This item is still locked.";
    case "assignment_inactive":
      return isHe
        ? "הקצאת המסע הזה בוטלה."
        : "This journey assignment was cancelled.";
    case "empty_text":
      return isHe ? "כתבו משהו לפני השליחה." : "Write something before sending.";
    case "text_too_long":
      return isHe ? "הטקסט ארוך מדי." : "Text is too long.";
    case "not_found":
      return isHe ? "הפריט לא נמצא." : "Item not found.";
    default:
      return isHe ? "משהו השתבש. נסו שוב." : "Something went wrong. Try again.";
  }
}
