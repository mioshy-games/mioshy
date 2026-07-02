// ============================================================
// labels.ts - slice 10 UI mapping for notification kinds.
//
// Each kind gets a tone, an icon name, and bilingual headline copy.
// The dropdown component consumes this without doing string matching
// on its own. Unknown kinds fall back to "generic".
// ============================================================

import type { NotificationKind } from "@/lib/journey-content/notifications";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Lock,
  MessageSquare,
  Send,
  Sparkles,
} from "lucide-react";

export type NotificationTone = "neutral" | "info" | "warn" | "danger";

export interface NotificationDescriptor {
  tone: NotificationTone;
  icon: LucideIcon;
  headlineHe: string;
  headlineEn: string;
}

const DESCRIPTORS: Record<NotificationKind, NotificationDescriptor> = {
  // Per-item unlock - regular cadence pick
  item_unlocked: {
    tone: "info",
    icon: Sparkles,
    headlineHe: "פריט חדש מחכה לכם",
    headlineEn: "A new item is waiting for you",
  },
  // Per-item unlock - admin push
  expert_push_landed: {
    tone: "info",
    icon: Send,
    headlineHe: "פריט חדש מהמומחה שלכם",
    headlineEn: "A new item from your coach",
  },
  // Per-item user post (expert pool target - won't render in user inbox)
  item_message_user_posted: {
    tone: "neutral",
    icon: MessageSquare,
    headlineHe: "פוסט חדש על פריט",
    headlineEn: "New post on an item",
  },
  item_message_expert_replied: {
    tone: "info",
    icon: MessageSquare,
    headlineHe: "המומחה הגיב על פריט",
    headlineEn: "Your coach replied on an item",
  },
  channel_message_user_posted: {
    tone: "neutral",
    icon: MessageSquare,
    headlineHe: "הודעה חדשה בערוץ",
    headlineEn: "New channel message",
  },
  channel_message_expert_replied: {
    tone: "info",
    icon: MessageSquare,
    headlineHe: "המומחה השיב לערוץ שלכם",
    headlineEn: "Your coach replied in your channel",
  },
  subscription_grace_started: {
    tone: "warn",
    icon: Clock,
    headlineHe: "המנוי פג - יש לכם 14 יום",
    headlineEn: "Your plan ended - 14 days remain",
  },
  subscription_blocked: {
    tone: "danger",
    icon: Lock,
    headlineHe: "גישת המנוי נחסמה",
    headlineEn: "Your access is paused",
  },
  reminder_inactivity: {
    tone: "neutral",
    icon: Bell,
    headlineHe: "נשמח לשמוע ממכם",
    headlineEn: "We'd love to hear from you",
  },
  reminder_unfollowed_reply: {
    tone: "info",
    icon: MessageSquare,
    headlineHe: "המומחה השאיר לכם תגובה",
    headlineEn: "Your coach left you a reply",
  },
  cron_failure: {
    tone: "danger",
    icon: AlertTriangle,
    headlineHe: "כשל בעבודת רקע",
    headlineEn: "Background job failure",
  },
  stuck_users_digest: {
    tone: "warn",
    icon: AlertTriangle,
    headlineHe: "משתמשים תקועים",
    headlineEn: "Stuck-user digest",
  },
  // A3 - 7-day trial
  trial_ending_soon: {
    tone: "info",
    icon: Clock,
    headlineHe: "תקופת הניסיון מסתיימת בקרוב",
    headlineEn: "Your free trial ends soon",
  },
  trial_first_charge_failed: {
    tone: "danger",
    icon: AlertTriangle,
    headlineHe: "החיוב הראשון של הניסיון נכשל",
    headlineEn: "Trial first charge failed",
  },
};

const FALLBACK: NotificationDescriptor = {
  tone: "neutral",
  icon: Bell,
  headlineHe: "התראה חדשה",
  headlineEn: "New notification",
};

export function describeNotification(
  kind: string,
): NotificationDescriptor {
  return (DESCRIPTORS[kind as NotificationKind] ?? FALLBACK);
}

const TONE_CLASSES: Record<NotificationTone, { dot: string; chip: string }> = {
  neutral: {
    dot: "bg-slate-400",
    chip: "border-white/15 bg-white/5 text-white/85",
  },
  info: {
    dot: "bg-emerald-400",
    chip: "border-emerald-300/30 bg-emerald-500/10 text-emerald-100",
  },
  warn: {
    dot: "bg-amber-400",
    chip: "border-amber-300/30 bg-amber-500/10 text-amber-100",
  },
  danger: {
    dot: "bg-rose-500",
    chip: "border-rose-300/30 bg-rose-500/10 text-rose-100",
  },
};

export function toneClasses(tone: NotificationTone) {
  return TONE_CLASSES[tone];
}

/** Pull a "preview" line out of payload for the dropdown body row. */
export function notificationPreview(
  payload: Record<string, unknown>,
): string | null {
  const v = payload?.preview;
  if (typeof v === "string" && v.trim().length > 0) return v;
  return null;
}

export function notificationHref(
  payload: Record<string, unknown>,
): string | null {
  const v = payload?.href;
  if (typeof v === "string" && v.trim().length > 0) return v;
  return null;
}

export function notificationCheckedIcon() {
  // Used by the "marked as read" path - exported so the dropdown can
  // render a tick visual change without re-importing lucide.
  return CheckCircle2;
}
