"use client";

/**
 * ClinicianResponseRow — one entry in the clinician's response inbox.
 * Phase 2D: now interactive — reply form + triage status buttons.
 *
 * Flow:
 *   1. Clinician sees the user's response (read-only block at top).
 *   2. If a previous reply exists, it shows in a separate panel with
 *      its timestamp.
 *   3. Click "Reply" → an inline textarea opens. Submit → server
 *      action saves + auto-marks the row as "resolved" unless they
 *      uncheck that box.
 *   4. Three triage buttons next to the reply: open / resolved /
 *      concerning. Each is its own server action; no reply needed.
 *
 * Tone: still calm and clinical. The reply should feel like a journal
 * note, not a chat message.
 */

import { useState, useTransition } from "react";
import { Lock, MessageCircle, ShieldCheck, Reply } from "lucide-react";
import {
  clinicianReply,
  clinicianSetStatus,
  type ClinicianStatus,
  type ClinicianActionResult,
} from "@/lib/journey-content/clinician-actions";
import type { ClinicianResponseRow as ResponseRow } from "@/lib/journey-content/clinician-responses";

const MAX_LEN = 4000;

export function ClinicianResponseRow({
  row,
  isHe,
  partnerLabel,
  coupleId,
}: {
  row: ResponseRow;
  isHe: boolean;
  partnerLabel: string;
  coupleId: string;
}) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState(row.clinicianReplyText ?? "");
  const [markResolved, setMarkResolved] = useState(true);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const remaining = MAX_LEN - replyText.length;
  const tooShort = replyText.trim().length === 0;
  const tooLong = replyText.length > MAX_LEN;

  const handleSendReply = () => {
    if (tooShort || tooLong || pending) return;
    startTransition(async () => {
      const result: ClinicianActionResult = await clinicianReply({
        responseId: row.id,
        replyText,
        coupleId,
        markResolved,
      });
      if (result.ok) {
        setShowReply(false);
        setFeedback(isHe ? "התגובה נשמרה" : "Saved");
        setTimeout(() => setFeedback(null), 4000);
      } else {
        setFeedback(result.message ?? (isHe ? "שגיאה" : "Error"));
      }
    });
  };

  const handleStatus = (status: ClinicianStatus) => {
    if (pending) return;
    startTransition(async () => {
      const result = await clinicianSetStatus({
        responseId: row.id,
        status,
        coupleId,
      });
      if (!result.ok) {
        setFeedback(result.message ?? (isHe ? "שגיאה" : "Error"));
      } else {
        setFeedback(
          isHe
            ? `סומן: ${labelForStatus(status, true)}`
            : `Marked: ${labelForStatus(status, false)}`,
        );
        setTimeout(() => setFeedback(null), 4000);
      }
    });
  };

  return (
    <article className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
      {/* Header — item title, category, status pill, timestamp */}
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{row.itemTitle}</p>
          {row.categoryName ? (
            <p className="truncate text-[11px] text-white/45">{row.categoryName}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {row.clinicianStatus ? (
            <ClinicianStatusPill status={row.clinicianStatus} isHe={isHe} />
          ) : null}
          <time
            className="text-[11px] text-white/45"
            dateTime={row.createdAt}
            title={new Date(row.createdAt).toLocaleString(isHe ? "he-IL" : "en-US")}
          >
            {formatRelative(row.createdAt, isHe)}
          </time>
        </div>
      </header>

      {/* Body — the user's response */}
      <div className="mt-2 flex items-start gap-2">
        <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/40" aria-hidden="true" />
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/80">
          {row.responseText}
        </p>
      </div>

      {/* Existing clinician reply (read-only block) */}
      {row.clinicianReplyText ? (
        <div className="mt-3 rounded-lg border border-emerald-400/15 bg-emerald-500/[0.04] p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-emerald-200/80">
              {isHe ? "תגובה ששלחת" : "Your reply"}
            </span>
            {row.clinicianRepliedAt ? (
              <time className="text-[11px] text-emerald-200/55">
                {formatRelative(row.clinicianRepliedAt, isHe)}
              </time>
            ) : null}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-emerald-50/85">
            {row.clinicianReplyText}
          </p>
        </div>
      ) : null}

      {/* Reply form (collapsed by default) */}
      {showReply ? (
        <div className="mt-3 rounded-lg border border-white/[0.08] bg-slate-950/40 p-3">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            rows={3}
            maxLength={MAX_LEN}
            placeholder={
              isHe
                ? "כתבו תגובה רגועה ומקצועית..."
                : "Write a calm, professional reply..."
            }
            className={[
              "w-full resize-y rounded-md border bg-slate-950/60 p-2",
              "text-sm text-white placeholder:text-white/30",
              "focus:outline-none focus:ring-2 focus:ring-white/20",
              tooLong ? "border-rose-500/40" : "border-white/10",
            ].join(" ")}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex items-center gap-2 text-[11px] text-white/65">
              <input
                type="checkbox"
                checked={markResolved}
                onChange={(e) => setMarkResolved(e.target.checked)}
                className="h-3 w-3 rounded border-white/20 accent-emerald-400"
              />
              {isHe ? "סמן כטופל אחרי השליחה" : "Mark as resolved on send"}
            </label>
            <span className={["text-[11px] tabular-nums", tooLong ? "text-rose-300" : "text-white/40"].join(" ")}>
              {remaining.toLocaleString()} {isHe ? "תווים" : "left"}
            </span>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowReply(false)}
              className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70 hover:border-white/25 hover:text-white"
            >
              {isHe ? "ביטול" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={handleSendReply}
              disabled={tooShort || tooLong || pending}
              className={[
                "rounded-full px-3 py-1 text-xs font-semibold",
                tooShort || tooLong || pending
                  ? "cursor-not-allowed bg-white/10 text-white/40"
                  : "bg-white text-slate-950 hover:bg-white/90",
              ].join(" ")}
            >
              {pending
                ? isHe ? "שולחים..." : "Sending..."
                : row.clinicianReplyText
                  ? isHe ? "עדכון תגובה" : "Update reply"
                  : isHe ? "שליחת תגובה" : "Send reply"}
            </button>
          </div>
        </div>
      ) : null}

      {/* Footer — partner label, private flag, action buttons */}
      <footer className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-2 text-white/55">
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-emerald-300/70" aria-hidden="true" />
            <span>{partnerLabel}</span>
          </span>
          {row.isPrivate ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.025] px-2 py-0.5 text-white/60">
              <Lock className="h-3 w-3" aria-hidden="true" />
              {isHe ? "פרטי" : "Private"}
            </span>
          ) : null}
          {feedback ? (
            <span className="text-emerald-200/80">{feedback}</span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!showReply ? (
            <button
              type="button"
              onClick={() => setShowReply(true)}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/85 hover:border-white/25 hover:text-white"
            >
              <Reply className="h-3 w-3" aria-hidden="true" />
              {row.clinicianReplyText
                ? isHe ? "עריכה" : "Edit"
                : isHe ? "תגובה" : "Reply"}
            </button>
          ) : null}
          <StatusButton
            current={row.clinicianStatus}
            target="open"
            onClick={() => handleStatus("open")}
            isHe={isHe}
            disabled={pending}
          />
          <StatusButton
            current={row.clinicianStatus}
            target="resolved"
            onClick={() => handleStatus("resolved")}
            isHe={isHe}
            disabled={pending}
          />
          <StatusButton
            current={row.clinicianStatus}
            target="concerning"
            onClick={() => handleStatus("concerning")}
            isHe={isHe}
            disabled={pending}
          />
        </div>
      </footer>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────

function StatusButton({
  current,
  target,
  onClick,
  isHe,
  disabled,
}: {
  current: ResponseRow["clinicianStatus"];
  target: ClinicianStatus;
  onClick: () => void;
  isHe: boolean;
  disabled: boolean;
}) {
  const isCurrent = current === target;
  const styles =
    target === "resolved"
      ? "border-emerald-400/30 text-emerald-200 hover:bg-emerald-500/15"
      : target === "concerning"
        ? "border-rose-400/30 text-rose-200 hover:bg-rose-500/15"
        : "border-amber-300/30 text-amber-200 hover:bg-amber-500/15";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isCurrent}
      title={labelForStatus(target, isHe)}
      className={[
        "rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        styles,
        isCurrent ? "bg-white/[0.06] opacity-70" : "",
        disabled ? "cursor-not-allowed opacity-50" : "",
      ].join(" ")}
    >
      {labelForStatus(target, isHe)}
    </button>
  );
}

function ClinicianStatusPill({
  status,
  isHe,
}: {
  status: NonNullable<ResponseRow["clinicianStatus"]>;
  isHe: boolean;
}) {
  const COPY = {
    open: { he: "בטיפול", en: "Open", cls: "bg-amber-400/15 text-amber-100 border-amber-300/30" },
    resolved: { he: "טופל", en: "Resolved", cls: "bg-emerald-500/15 text-emerald-200 border-emerald-400/30" },
    concerning: { he: "תשומת לב", en: "Concerning", cls: "bg-rose-500/15 text-rose-200 border-rose-400/30" },
  } as const;
  const c = COPY[status];
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2 py-0.5",
        "text-[10px] font-semibold uppercase tracking-wide",
        c.cls,
      ].join(" ")}
    >
      {isHe ? c.he : c.en}
    </span>
  );
}

function labelForStatus(s: ClinicianStatus, isHe: boolean): string {
  if (s === "resolved") return isHe ? "טופל" : "Resolved";
  if (s === "concerning") return isHe ? "תשומת לב" : "Concerning";
  return isHe ? "בטיפול" : "Open";
}

function formatRelative(iso: string, isHe: boolean): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "";
  const diffMs = Date.now() - ts;
  const m = Math.round(diffMs / 60000);
  if (m < 1) return isHe ? "כעת" : "now";
  if (m < 60) return isHe ? `לפני ${m} דק'` : `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return isHe ? `לפני ${h} שעות` : `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return isHe ? `לפני ${d} ימים` : `${d}d ago`;
  const w = Math.round(d / 7);
  if (w < 5) return isHe ? `לפני ${w} שבועות` : `${w}w ago`;
  return isHe ? "לפני יותר מחודש" : "over a month ago";
}
