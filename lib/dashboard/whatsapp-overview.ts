/**
 * lib/dashboard/whatsapp-overview.ts
 *
 * Server data layer for the admin WhatsApp campaign dashboard (2026-07-10).
 * READ-ONLY over public.whatsapp_messages — this file never sends anything and
 * never touches lib/whatsapp/campaign.ts. It only aggregates the journal that
 * campaign.ts + the Meta status webhook already write.
 *
 * View 1 (campaign): per-template funnel counts within a date range —
 *   sent / delivered / read (cumulative funnel), failed, would_send, and
 *   skipped broken down by reason. Templates are shown in route order.
 *
 * View 2 (per-user): the raw outbound rows for one recipient, newest first,
 *   consumed by the profile page.
 *
 * Status model (see migrations 120 + 175):
 *   queued → sent → delivered → read  (webhook overwrites the SAME row's status
 *   by wa_message_id as Meta reports each transition), plus terminal `failed`,
 *   and the safe-test journal states `would_send` / `skipped`.
 * Because a delivered message is no longer `status='sent'`, the funnel counts
 * are CUMULATIVE: sent = {sent,delivered,read}, delivered = {delivered,read},
 * read = {read}. That way "sent ≥ delivered ≥ read" always holds.
 *
 * Reasons live in `error->>reason`. campaign.ts journals skipped rows only for
 * `no-opt-in`, `no-valid-phone`, `throttled-1-per-week` (the `already-sent`
 * idempotency guard returns WITHOUT writing a row, so it never appears here).
 * would_send rows carry the mode reason (`allowlist_skip`).
 */

import { createServiceRoleClient } from "@/lib/supabase-admin";
import type { ResolvedRange } from "@/lib/dashboard/overview";

type Admin = NonNullable<ReturnType<typeof createServiceRoleClient>>;

/** The two automated campaigns, in route order (welcome → reminder). */
export const CAMPAIGN_TEMPLATES = [
  "coach_welcome",
  "intro_price_expiry_reminder",
] as const;

export type CampaignTemplate = (typeof CAMPAIGN_TEMPLATES)[number];

/** Skipped reasons campaign.ts actually journals (see file header). */
export const SKIP_REASONS = [
  "no-opt-in",
  "throttled-1-per-week",
  "no-valid-phone",
] as const;

export interface CampaignStats {
  template: CampaignTemplate;
  /** cumulative funnel — sent ≥ delivered ≥ read. */
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  wouldSend: number;
  skipped: number;
  /** skipped rows keyed by error->>reason (only the journalled reasons). */
  skippedByReason: Record<string, number>;
  /** everything journalled for this template in range (outbound). */
  total: number;
}

export interface WhatsAppCampaignData {
  rows: CampaignStats[];
  degraded: boolean;
}

const EMPTY_STATS = (template: CampaignTemplate): CampaignStats => ({
  template,
  sent: 0,
  delivered: 0,
  read: 0,
  failed: 0,
  wouldSend: 0,
  skipped: 0,
  skippedByReason: {},
  total: 0,
});

/**
 * Head-only COUNT of outbound rows for one template in [start,end) matching an
 * extra status/reason filter. Head-count (no rows pulled) so it stays correct
 * regardless of volume (a bulk row-pull would hit PostgREST's max-rows cap).
 */
function countBuilder(
  admin: Admin,
  template: CampaignTemplate,
  sIso: string,
  eIso: string,
) {
  return admin
    .from("whatsapp_messages")
    .select("id", { count: "exact", head: true })
    .eq("direction", "outbound")
    .eq("template_name", template)
    .gte("created_at", sIso)
    .lt("created_at", eIso);
}

async function statsForTemplate(
  admin: Admin,
  template: CampaignTemplate,
  sIso: string,
  eIso: string,
): Promise<CampaignStats> {
  const count = async (
    apply: (q: ReturnType<typeof countBuilder>) => ReturnType<typeof countBuilder>,
  ) => {
    const { count: c } = await apply(countBuilder(admin, template, sIso, eIso));
    return c ?? 0;
  };

  const [
    sent,
    delivered,
    read,
    failed,
    wouldSend,
    skipped,
    ...reasonCounts
  ] = await Promise.all([
    count((q) => q.in("status", ["sent", "delivered", "read"])),
    count((q) => q.in("status", ["delivered", "read"])),
    count((q) => q.eq("status", "read")),
    count((q) => q.eq("status", "failed")),
    count((q) => q.eq("status", "would_send")),
    count((q) => q.eq("status", "skipped")),
    ...SKIP_REASONS.map((reason) =>
      count((q) => q.eq("status", "skipped").eq("error->>reason", reason)),
    ),
  ]);

  const skippedByReason: Record<string, number> = {};
  SKIP_REASONS.forEach((reason, i) => {
    if (reasonCounts[i] > 0) skippedByReason[reason] = reasonCounts[i];
  });

  const total = sent + failed + wouldSend + skipped;
  return { template, sent, delivered, read, failed, wouldSend, skipped, skippedByReason, total };
}

export async function getWhatsAppCampaignData(
  r: ResolvedRange,
): Promise<WhatsAppCampaignData> {
  const admin = createServiceRoleClient();
  if (!admin) {
    return { rows: CAMPAIGN_TEMPLATES.map(EMPTY_STATS), degraded: true };
  }

  const sIso = r.start.toISOString();
  const eIso = r.end.toISOString();

  const rows = await Promise.all(
    CAMPAIGN_TEMPLATES.map((tpl) => statsForTemplate(admin, tpl, sIso, eIso)),
  );

  return { rows, degraded: false };
}

// ── View 2: per-user outbound log (consumed by the profile page) ────────────

export interface UserWhatsAppRow {
  id: string;
  templateName: string | null;
  category: string | null;
  status: string;
  reason: string | null;
  toPhone: string | null;
  waMessageId: string | null;
  createdAt: string;
}

type RawUserRow = {
  id: string;
  template_name: string | null;
  category: string | null;
  status: string;
  error: { reason?: string } | null;
  to_phone: string | null;
  wa_message_id: string | null;
  created_at: string;
};

/**
 * Every outbound WhatsApp row for one recipient, newest first. Metadata only
 * (no message body) — matches the analytics privacy approach (A).
 */
export async function getUserWhatsAppMessages(
  admin: Admin,
  userId: string,
  limit = 50,
): Promise<UserWhatsAppRow[]> {
  const { data } = await admin
    .from("whatsapp_messages")
    .select("id, template_name, category, status, error, to_phone, wa_message_id, created_at")
    .eq("recipient_user_id", userId)
    .eq("direction", "outbound")
    .order("created_at", { ascending: false })
    .limit(limit);

  return ((data ?? []) as RawUserRow[]).map((row) => ({
    id: row.id,
    templateName: row.template_name,
    category: row.category,
    status: row.status,
    reason: row.error?.reason ?? null,
    toPhone: row.to_phone,
    waMessageId: row.wa_message_id,
    createdAt: row.created_at,
  }));
}
