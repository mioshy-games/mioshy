// ============================================================
// Notification log + dispatch - slice 6 minimum viable.
//
// Two responsibilities:
//   1. Append a row to journey_notifications so the future in-app
//      inbox (slice 10) can replay history.
//   2. Send the email via Brevo:
//        - When the recipient is the expert pool, fan-out goes to a
//          single configured group address (JOURNEY_EXPERT_POOL_EMAIL).
//          Per Itzik's slice 6 brief: don't fan-out across every
//          expert by email.
//        - When the recipient is a single user, send to their auth
//          email.
//
// Brevo errors are logged but never thrown - notifications are a
// secondary effect of the post action and shouldn't fail the post.
// ============================================================

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase-admin";

export type NotificationKind =
  // slice 6 - message events
  | "item_message_user_posted"
  | "item_message_expert_replied"
  | "channel_message_user_posted"
  | "channel_message_expert_replied"
  // slice 10 - system + reminder events
  | "item_unlocked"
  | "expert_push_landed"
  | "subscription_grace_started"
  | "subscription_blocked"
  | "reminder_inactivity"
  | "reminder_unfollowed_reply"
  | "cron_failure"
  | "stuck_users_digest"
  // A3 - 7-day trial
  | "trial_ending_soon"
  | "trial_first_charge_failed"
  // 2026-07-31 — a paying subscriber received no content at all
  | "subscriber_without_content";

interface BasePayload {
  /** Stable URL to deep-link from email back into the app. */
  href?: string;
  /** Human-friendly preview of the message body (first ~140 chars). */
  preview?: string;
  /** Author name for "X posted on Y's item" framing. */
  author_label?: string;
  /** Item or channel context label. */
  context_label?: string;
}

export interface NotifyExpertPoolArgs {
  kind: NotificationKind;
  payload: BasePayload & Record<string, unknown>;
  /** Subject line for the email. */
  subject?: string;
}

export interface NotifyUserArgs {
  recipientUserId: string;
  kind: NotificationKind;
  payload: BasePayload & Record<string, unknown>;
  subject?: string;
}

/**
 * Notify the expert pool. Always logs to journey_notifications.
 * Sends one email to the configured pool address when set.
 */
export async function notifyExpertPool(args: NotifyExpertPoolArgs): Promise<void> {
  const admin = createServiceRoleClient();
  if (admin) {
    const { error } = await admin.from("journey_notifications").insert({
      recipient_kind: "expert_pool",
      recipient_user_id: null,
      kind: args.kind,
      payload: args.payload,
    });
    if (error) {
      console.warn("[notifications] expert_pool log insert failed", error);
    }
  }

  const poolEmail = process.env.JOURNEY_EXPERT_POOL_EMAIL?.trim();
  if (!poolEmail) {
    console.warn(
      "[notifications] JOURNEY_EXPERT_POOL_EMAIL not configured - skipping email send",
    );
    return;
  }
  await sendEmailBestEffort({
    to: poolEmail,
    subject: args.subject ?? `Mioshy: new ${args.kind}`,
    html: renderEmailHtml(args.payload),
  });
}

/**
 * Notify a single user (the recipient of an expert reply, typically).
 * Logs to journey_notifications and sends one email to the user's
 * auth.users.email.
 */
export async function notifyUser(args: NotifyUserArgs): Promise<void> {
  const admin = createServiceRoleClient();
  if (!admin) return;

  const { error } = await admin.from("journey_notifications").insert({
    recipient_kind: "user",
    recipient_user_id: args.recipientUserId,
    kind: args.kind,
    payload: args.payload,
  });
  if (error) {
    console.warn("[notifications] user log insert failed", error);
  }

  // Resolve the user's email for the send. admin_users_overview is
  // the project-standard place; falls back to skipping the send
  // (the in-app log row still exists for the future inbox).
  const { data: emailRow } = await admin
    .from("admin_users_overview")
    .select("email")
    .eq("user_id", args.recipientUserId)
    .maybeSingle();
  const to = (emailRow?.email as string | null) ?? null;
  if (!to) {
    console.warn("[notifications] no email for user - skipping send", {
      user_id: args.recipientUserId,
    });
    return;
  }
  await sendEmailBestEffort({
    to,
    subject: args.subject ?? "Mioshy: you have a new message",
    html: renderEmailHtml(args.payload),
  });
}

// ------------------------------------------------------------
// Email rendering + send
// ------------------------------------------------------------

interface EmailArgs {
  to: string;
  subject: string;
  html: string;
}

/**
 * Best-effort send via Brevo. The project already calls Brevo from
 * other surfaces (couple invitations, notify-unlocks); we re-use
 * the same env var contract - BREVO_API_KEY + the standard endpoint.
 *
 * Failures are logged at warn but never throw to the caller - a
 * notification is always a secondary effect.
 */
async function sendEmailBestEffort(args: EmailArgs): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn("[notifications] BREVO_API_KEY missing - skipping send");
    return;
  }
  const fromEmail =
    process.env.BREVO_FROM_EMAIL?.trim() || "no-reply@mioshy.co.il";
  const fromName = process.env.BREVO_FROM_NAME?.trim() || "Mioshy";
  const replyToEmail =
    process.env.BREVO_REPLY_TO_EMAIL?.trim() || "support@mioshy.com";

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: fromEmail, name: fromName },
        replyTo: { email: replyToEmail, name: fromName },
        to: [{ email: args.to }],
        subject: args.subject,
        htmlContent: args.html,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "<unreadable>");
      console.warn("[notifications] Brevo send non-200", {
        status: res.status,
        body: text.slice(0, 400),
      });
    }
  } catch (e) {
    console.warn("[notifications] Brevo send threw", e);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderEmailHtml(payload: BasePayload & Record<string, unknown>): string {
  const author = payload.author_label
    ? `<div style="color:#666;font-size:13px;margin-bottom:6px">${escapeHtml(String(payload.author_label))}</div>`
    : "";
  const context = payload.context_label
    ? `<div style="color:#888;font-size:12px;margin-bottom:12px">${escapeHtml(String(payload.context_label))}</div>`
    : "";
  const preview = payload.preview
    ? `<div style="font-size:15px;line-height:1.5;color:#222;border-inline-start:3px solid #eee;padding-inline-start:12px">${escapeHtml(String(payload.preview))}</div>`
    : "";
  const cta = payload.href
    ? `<div style="margin-top:24px"><a href="${escapeHtml(String(payload.href))}" style="display:inline-block;padding:10px 20px;background:#10b981;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">פתחו במיאושי / Open in Mioshy</a></div>`
    : "";
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      ${author}
      ${context}
      ${preview}
      ${cta}
    </div>
  `.trim();
}

// ============================================================
// Slice 10 - admin pool + system event helpers
// ============================================================

export interface NotifyAdminPoolArgs {
  kind: NotificationKind;
  payload: BasePayload & Record<string, unknown>;
  subject?: string;
  /** Throttle email sends to one per (kind, throttleKey?) per N hours.
   *  The journey_notifications row is ALWAYS written; only the email
   *  is suppressed inside the window. Default 6h. Pass 0 to disable. */
  throttleHours?: number;
  /** Optional discriminator within `kind` - e.g. "cron_failure" rows
   *  use job_name as the throttle key so separate jobs each get one
   *  email even if both fail in the same hour. */
  throttleKey?: string;
}

/**
 * Admin pool notification - log row + (throttled) email to
 * JOURNEY_ADMIN_ALERT_EMAIL. Used for cron failures and the daily
 * stuck-user digest.
 */
export async function notifyAdminPool(args: NotifyAdminPoolArgs): Promise<void> {
  const admin = createServiceRoleClient();
  if (!admin) return;

  const { error } = await admin.from("journey_notifications").insert({
    recipient_kind: "admin_pool",
    recipient_user_id: null,
    kind: args.kind,
    payload: args.payload,
  });
  if (error) {
    console.warn("[notifications] admin_pool log insert failed", error);
  }

  // Throttle email sends. We look up recent journey_notifications of
  // the SAME kind whose payload contains the same throttle key (when
  // provided); if any are within the window, skip the email.
  const throttleHours = args.throttleHours ?? 6;
  if (throttleHours > 0) {
    const cutoffIso = new Date(
      Date.now() - throttleHours * 3600_000,
    ).toISOString();
    let q = admin
      .from("journey_notifications")
      .select("id", { head: true, count: "exact" })
      .eq("recipient_kind", "admin_pool")
      .eq("kind", args.kind)
      .gte("created_at", cutoffIso);
    if (args.throttleKey) {
      // payload @> {throttle_key: "..."} match. We store the key
      // explicitly in the row's payload so the lookup is JSON-pure.
      q = q.contains("payload", { throttle_key: args.throttleKey });
    }
    // Subtract 1 because the insert above already created a row for
    // this notification - we only want to count PRIOR rows.
    const { count } = await q;
    const priorCount = Math.max(0, (count ?? 0) - 1);
    if (priorCount > 0) {
      console.log(
        `[notifications] admin_pool email throttled (${args.kind} key=${args.throttleKey ?? "*"} prior=${priorCount} window=${throttleHours}h)`,
      );
      return;
    }
  }

  const adminEmail = process.env.JOURNEY_ADMIN_ALERT_EMAIL?.trim();
  if (!adminEmail) {
    console.warn(
      "[notifications] JOURNEY_ADMIN_ALERT_EMAIL not configured - skipping admin send",
    );
    return;
  }
  await sendEmailBestEffort({
    to: adminEmail,
    subject: args.subject ?? `Mioshy admin alert: ${args.kind}`,
    html: renderEmailHtml(args.payload),
  });
}

// ============================================================
// New-subscription admin alert (Itzik 2026-07-15)
// Fires on day-1 subscription/trial CREATION (signup / plan open) — NOT
// on the day-7 trial charge. Best-effort: this helper never throws and
// never blocks the subscription flow (its own try/catch + the Brevo send
// is best-effort). Recipient defaults to the shared admin inbox.
// ============================================================

const CADENCE_LABEL_HE: Record<string, string> = {
  monthly: "חודשי",
  quarterly: "רבעוני",
  yearly: "שנתי",
  weekly: "שבועי",
};

export interface NewSubscriptionAlertArgs {
  userId: string;
  email: string;
  /** cadence: monthly | quarterly | yearly | weekly */
  plan: string;
  coaching: boolean;
  /** "ILS" | "USD" */
  currency: string;
  /** First-period charge (promo/intro). For a trial this is the day-7 charge. */
  firstAmount: number;
  /** Regular recurring amount after any intro period. */
  regularAmount: number;
  isTrial: boolean;
  product: string;
  createdAt: Date;
}

export async function notifyAdminNewSubscription(
  args: NewSubscriptionAlertArgs,
): Promise<void> {
  try {
    const admin = createServiceRoleClient();
    // Customer name — best-effort; falls back to email only.
    let fullName: string | null = null;
    if (admin) {
      const { data } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", args.userId)
        .maybeSingle();
      fullName =
        (data as { full_name?: string | null } | null)?.full_name ?? null;
    }

    const sym = args.currency === "USD" ? "$" : "₪";
    const money = (n: number) =>
      args.currency === "USD" ? `${sym}${n}` : `${n} ${sym}`;
    const cadence = CADENCE_LABEL_HE[args.plan] ?? args.plan;
    const when = args.createdAt.toLocaleString("he-IL", {
      timeZone: "Asia/Jerusalem",
      dateStyle: "medium",
      timeStyle: "short",
    });

    const rows: Array<[string, string]> = [
      ["לקוח", fullName ? `${fullName} · ${args.email}` : args.email],
      ["מוצר", args.product],
      ["מסלול", cadence],
      ["ליווי", args.coaching ? "כן" : "לא"],
      [
        args.isTrial ? "חיוב ראשון (בתום הטריאל)" : "חיוב ראשון",
        money(args.firstAmount),
      ],
      ["חיוב רגיל (מתחדש)", money(args.regularAmount)],
      ["תאריך ושעה", when],
      ["סוג", args.isTrial ? "טריאל (7 ימים)" : "מנוי מיידי"],
    ];

    const trHtml = rows
      .map(
        ([k, v]) =>
          `<tr><td style="padding:7px 14px;color:#666;font-size:13px;white-space:nowrap;border-bottom:1px solid #efe9e0">${escapeHtml(
            k,
          )}</td><td style="padding:7px 14px;color:#111;font-size:14px;font-weight:600;border-bottom:1px solid #efe9e0">${escapeHtml(
            v,
          )}</td></tr>`,
      )
      .join("");

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:24px" dir="rtl">
        <div style="font-size:18px;font-weight:800;color:#111;margin-bottom:4px">מנוי חדש${
          args.isTrial ? " (טריאל)" : ""
        } 🎉</div>
        <div style="font-size:13px;color:#888;margin-bottom:16px">התראה אוטומטית ביום פתיחת המנוי</div>
        <table style="border-collapse:collapse;width:100%;background:#faf9f7;border-radius:10px;overflow:hidden">${trHtml}</table>
      </div>`.trim();

    const to =
      process.env.ADMIN_NEW_SUB_ALERT_EMAIL?.trim() || "mioshyoffice@gmail.com";
    const subject = `מנוי חדש${args.isTrial ? " (טריאל)" : ""}: ${cadence}${
      args.coaching ? " + ליווי" : ""
    } — ${args.email}`;

    await sendEmailBestEffort({ to, subject, html });
  } catch (err) {
    console.warn(
      "[notifications] new-subscription admin alert failed — non-fatal",
      err,
    );
  }
}

/**
 * Slice 10 - fired from notify-unlocks after each successful email
 * dispatch. One in-app row per (recipient × scheduled item). Email is
 * already handled by the unlock notifier itself so we don't double
 * send.
 */
export async function notifyOnItemUnlocked(args: {
  recipientUserId: string;
  scheduledItemId: string;
  itemTitle: string | null;
  source: "cadence" | "expert_push" | "group" | "random" | "admin_manual" | string | null;
  locale: "he" | "en";
}): Promise<void> {
  const admin = createServiceRoleClient();
  if (!admin) return;
  const isPush = args.source === "expert_push";
  const kind: NotificationKind = isPush
    ? "expert_push_landed"
    : "item_unlocked";
  const href = `/${args.locale}/journey/timeline/${args.scheduledItemId}`;
  const { error } = await admin.from("journey_notifications").insert({
    recipient_kind: "user",
    recipient_user_id: args.recipientUserId,
    kind,
    payload: {
      href,
      preview: args.itemTitle ?? null,
      scheduled_item_id: args.scheduledItemId,
      source: args.source ?? null,
    },
  });
  if (error) {
    console.warn("[notifications] item_unlocked log insert failed", error);
  }
  // No email - notify-unlocks already sent it.
}

/**
 * Slice 10 - fired from grace-watcher pass 1 (active → grace).
 * Writes a single in-app row + email; banner UI on /my/journey
 * carries the user-facing copy already.
 */
export async function notifyOnGraceStarted(args: {
  recipientUserId: string;
  graceUntil: string;
  locale: "he" | "en";
}): Promise<void> {
  const isHe = args.locale === "he";
  await notifyUser({
    recipientUserId: args.recipientUserId,
    kind: "subscription_grace_started",
    subject: isHe
      ? "Mioshy: המנוי פג - יש לכם 14 יום"
      : "Mioshy: your plan ended - 14 days remain",
    payload: {
      href: `/${args.locale}/my/journey`,
      grace_until: args.graceUntil,
      preview: isHe
        ? "התוכן שכבר קיבלתם נשאר זמין לעוד 14 יום. חידוש פותח את הכל מחדש."
        : "Content you've already received stays available for 14 more days. Renew to unlock everything.",
    },
  });
}

/**
 * Slice 10 - fired from grace-watcher pass 2 (grace → blocked).
 * Same shape as grace-started but rose-tone copy.
 */
export async function notifyOnBlocked(args: {
  recipientUserId: string;
  locale: "he" | "en";
}): Promise<void> {
  const isHe = args.locale === "he";
  await notifyUser({
    recipientUserId: args.recipientUserId,
    kind: "subscription_blocked",
    subject: isHe
      ? "Mioshy: גישת המנוי נחסמה - חידוש מחזיר הכל"
      : "Mioshy: your access is paused - renew to restore",
    payload: {
      href: `/${args.locale}/journey`,
      preview: isHe
        ? "כל ההיסטוריה שלכם שמורה. חידוש מחזיר את הגישה לכל מה שצברתם."
        : "Your full history is preserved. Renew to restore access to everything.",
    },
  });
}

/**
 * Slice 10 - fired from the daily reminders cron when a user has
 * been idle ≥ 5 days with no response on their last delivered item.
 */
export async function notifyOnReminderInactivity(args: {
  recipientUserId: string;
  locale: "he" | "en";
  lastItemTitle: string | null;
  lastItemHref: string;
}): Promise<void> {
  const isHe = args.locale === "he";
  await notifyUser({
    recipientUserId: args.recipientUserId,
    kind: "reminder_inactivity",
    subject: isHe ? "Mioshy: הפריט האחרון מחכה לכם" : "Mioshy: your last item is waiting",
    payload: {
      href: args.lastItemHref,
      preview: args.lastItemTitle ?? undefined,
      context_label: isHe
        ? "5 ימים בלי תגובה - נשמח לשמוע ממכם"
        : "5 days without a response - we'd love to hear from you",
    },
  });
}

/**
 * Slice 10 - fired when the latest expert reply on a per-item thread
 * is older than 24h and the user hasn't followed up. In-app only
 * (no email - too noisy per the brief).
 */
export async function notifyOnReminderUnfollowedReply(args: {
  recipientUserId: string;
  scheduledItemId: string;
  locale: "he" | "en";
}): Promise<void> {
  const admin = createServiceRoleClient();
  if (!admin) return;
  const { error } = await admin.from("journey_notifications").insert({
    recipient_kind: "user",
    recipient_user_id: args.recipientUserId,
    kind: "reminder_unfollowed_reply",
    payload: {
      href: `/${args.locale}/journey/timeline/${args.scheduledItemId}`,
      preview:
        args.locale === "he"
          ? "המומחה השאיר לכם תגובה. שווה לחזור לקרוא."
          : "Your coach left you a reply. Worth a look.",
      scheduled_item_id: args.scheduledItemId,
    },
  });
  if (error) {
    console.warn("[notifications] reminder_unfollowed_reply log insert failed", error);
  }
}
