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
//
// Sprint 4 #3 Phase 2A migration — 36 keys under
// journeyTimeline.itemDetail.*. Includes per-error-code copy for the
// errorCopy() switch (login_required/forbidden/locked/...).
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
import { useCmsText } from "@/hooks/useCmsText";
import { CmsText } from "@/components/cms/CmsText";

interface Props {
  item: JourneyItem;
  scheduled: JourneyScheduledItem;
  status: ScheduledItemStatus;
  completion: JourneyItemCompletion | null;
  responses: JourneyItemResponse[];
  viewerUserId: string;
  locale: string;
  /** Phase 1 lesson view — when true, suppress this component's
   *  body/task/challenge sections because LessonView already rendered
   *  them upstream. The complete-toggle, response thread, and
   *  celebration modal still render. */
  hideContent?: boolean;
}

/** Resolve every errorCopy() string in one hook call. Returned object
 *  is keyed by error code; switch consumers look up by code with a
 *  default-fallback string. Hooks can't sit inside a switch, so we
 *  centralise the bundle here. */
function useErrorCopyBundle() {
  return {
    login_required: useCmsText("journeyTimeline.itemDetail.errLoginRequired").text,
    profile_incomplete: useCmsText("journeyTimeline.itemDetail.errProfileIncomplete").text,
    forbidden: useCmsText("journeyTimeline.itemDetail.errForbidden").text,
    locked: useCmsText("journeyTimeline.itemDetail.errLocked").text,
    assignment_inactive: useCmsText("journeyTimeline.itemDetail.errAssignmentInactive").text,
    empty_text: useCmsText("journeyTimeline.itemDetail.errEmptyText").text,
    text_too_long: useCmsText("journeyTimeline.itemDetail.errTextTooLong").text,
    not_found: useCmsText("journeyTimeline.itemDetail.errNotFound").text,
    default: useCmsText("journeyTimeline.itemDetail.errDefault").text,
  };
}

function errorCopy(
  code: string,
  bundle: ReturnType<typeof useErrorCopyBundle>,
): string {
  return (bundle as Record<string, string>)[code] ?? bundle.default;
}

export function ItemDetailClient({
  item,
  scheduled,
  status: initialStatus,
  completion: initialCompletion,
  responses: initialResponses,
  viewerUserId,
  locale,
  hideContent = false,
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

  // CMS strings — toasts + completed-on prefix. Other rendered strings
  // (headings, body copy) use <CmsText as="..."> inline below.
  const errBundle = useErrorCopyBundle();
  const markedNotDoneMsg = useCmsText("journeyTimeline.itemDetail.markedNotDone").text;
  const responseSavedMsg = useCmsText("journeyTimeline.itemDetail.responseSaved").text;
  const responseDeletedMsg = useCmsText("journeyTimeline.itemDetail.responseDeleted").text;
  const completedOnPrefix = useCmsText("journeyTimeline.itemDetail.completedOnPrefix").text;

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
          toast.error(errorCopy(res.error, errBundle));
          return;
        }
        toast.success(markedNotDoneMsg);
      } else {
        const res = await markScheduledItemComplete(scheduled.id);
        if (!res.ok) {
          toast.error(errorCopy(res.error, errBundle));
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
      toast.error(errorCopy(res.error, errBundle));
      return false;
    }
    setResponses((prev) => [...prev, res.response]);
    toast.success(responseSavedMsg);
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
      toast.error(errorCopy(res.error, errBundle));
      return;
    }
    toast.success(responseDeletedMsg);
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
          <StatusBadge status={status} />
          {completion ? (
            <span className="text-xs text-white/55">
              {completedOnPrefix}
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
      {item.video_url ? <VideoBlock url={item.video_url} /> : null}

      {/* Body / Task / Challenge — suppressed when LessonView is
          mounted upstream (Phase 1 — every block rendered there
          with structured pedagogy). Fallback for legacy items. */}
      {!hideContent ? (
        <>
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
              titleKey="journeyTimeline.itemDetail.taskTitle"
              tone="emerald"
            >
              {task}
            </Callout>
          ) : null}

          {/* Challenge */}
          {challenge ? (
            <Callout
              icon={<Play className="h-4 w-4" />}
              titleKey="journeyTimeline.itemDetail.challengeTitle"
              tone="amber"
            >
              {challenge}
            </Callout>
          ) : null}
        </>
      ) : null}

      {/* Complete toggle */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold">
              <CmsText
                cmsKey={
                  completion
                    ? "journeyTimeline.itemDetail.chapterCompleteHeading"
                    : "journeyTimeline.itemDetail.chapterFinishedQ"
                }
              />
            </div>
            <CmsText
              cmsKey={
                completion
                  ? "journeyTimeline.itemDetail.completeHintAfter"
                  : "journeyTimeline.itemDetail.completeHintBefore"
              }
              as="p"
              className="mt-1 max-w-md text-xs text-white/60"
            />
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
            <CmsText
              cmsKey={
                completion
                  ? "journeyTimeline.itemDetail.unmarkDone"
                  : "journeyTimeline.itemDetail.markAsDone"
              }
            />
          </Button>
        </div>
      </div>

      {/* Response thread */}
      <section className="space-y-4">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-indigo-300" />
            <CmsText
              cmsKey="journeyTimeline.itemDetail.reflectionsHeading"
              as="h2"
              className="text-lg font-semibold"
            />
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

        <ResponseForm onSubmit={handleAddResponse} />
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

function StatusBadge({ status }: { status: ScheduledItemStatus }) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-100">
        <CheckCircle2 className="h-3.5 w-3.5" />
        <CmsText cmsKey="journeyTimeline.itemDetail.statusCompleted" />
      </span>
    );
  }
  if (status === "available") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/50 bg-amber-400/15 px-2.5 py-1 text-xs font-semibold text-amber-100">
        <CmsText cmsKey="journeyTimeline.itemDetail.statusOpenNow" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white/60">
      <Lock className="h-3.5 w-3.5" />
      <CmsText cmsKey="journeyTimeline.itemDetail.statusLocked" />
    </span>
  );
}

// ------------------------------------------------------------
// Callout - task / challenge blocks
// ------------------------------------------------------------

function Callout({
  icon,
  titleKey,
  tone,
  children,
}: {
  icon: React.ReactNode;
  titleKey: string;
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
        <CmsText cmsKey={titleKey} as="span" />
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

function VideoBlock({ url }: { url: string }) {
  const yt = extractYouTubeId(url);
  const videoTitle = useCmsText("journeyTimeline.itemDetail.videoTitle").text;
  if (yt) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
        <iframe
          src={`https://www.youtube.com/embed/${yt}`}
          title={videoTitle}
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
  const deleteResponseLabel = useCmsText("journeyTimeline.itemDetail.deleteResponse").text;

  if (responses.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/15 bg-white/2 px-4 py-6 text-center text-sm text-white/50">
        <CmsText cmsKey="journeyTimeline.itemDetail.noResponsesYet" />
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
                <CmsText
                  cmsKey={
                    mine
                      ? "journeyTimeline.itemDetail.responseAuthorMe"
                      : "journeyTimeline.itemDetail.responseAuthorPartner"
                  }
                />
              </span>
              <div className="flex items-center gap-2 text-white/40">
                {r.is_private ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2 py-0.5 text-xs uppercase tracking-wide">
                    <Lock className="h-3 w-3" />
                    <CmsText cmsKey="journeyTimeline.itemDetail.responsePrivate" />
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
                    aria-label={deleteResponseLabel}
                    title={deleteResponseLabel}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/90">
              {r.response_text}
            </p>
            {r.clinician_reply_text ? (
              <ClinicianReplyPanel
                replyText={r.clinician_reply_text}
                repliedAt={r.clinician_replied_at ?? null}
                isHe={isHe}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ClinicianReplyPanel - read-only inset showing the clinician's reply.
// ─────────────────────────────────────────────────────────────────────

function ClinicianReplyPanel({
  replyText,
  repliedAt,
  isHe,
}: {
  replyText: string;
  repliedAt: string | null;
  isHe: boolean;
}) {
  return (
    <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.05] p-3">
      <div className="flex items-center justify-between gap-2">
        <CmsText
          cmsKey="journeyTimeline.itemDetail.clinicianReplyLabel"
          as="span"
          className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200/85"
        />
        {repliedAt ? (
          <time
            className="text-[11px] text-emerald-200/55"
            dateTime={repliedAt}
            title={new Date(repliedAt).toLocaleString(isHe ? "he-IL" : "en-US")}
          >
            {new Date(repliedAt).toLocaleDateString(isHe ? "he-IL" : "en-US", {
              month: "short",
              day: "numeric",
            })}
          </time>
        ) : null}
      </div>
      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-emerald-50/95">
        {replyText}
      </p>
    </div>
  );
}

// ------------------------------------------------------------
// ResponseForm
// ------------------------------------------------------------

const RESPONSE_MAX_LEN = 4000;

function ResponseForm({
  onSubmit,
}: {
  onSubmit: (text: string, isPrivate: boolean) => Promise<boolean>;
}) {
  const [text, setText] = React.useState("");
  const [isPrivate, setIsPrivate] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const placeholder = useCmsText("journeyTimeline.itemDetail.responsePlaceholder").text;
  const charactersLeftTpl = useCmsText("journeyTimeline.itemDetail.charactersLeft").text;

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
        placeholder={placeholder}
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
              <CmsText cmsKey="journeyTimeline.itemDetail.privateOnlyMe" />
            </Label>
          </div>
          <span className="text-sm text-white/40">
            {charactersLeftTpl.replace("{n}", String(remaining))}
          </span>
        </div>
        <Button
          type="submit"
          size="lg"
          disabled={disabled}
          className="min-h-[44px] bg-gradient-to-r from-indigo-500 via-emerald-500 to-teal-500 px-6 text-white hover:brightness-110"
        >
          {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
          <CmsText cmsKey="journeyTimeline.itemDetail.sendResponse" />
        </Button>
      </div>
    </form>
  );
}
