"use server";

/**
 * app/actions/journey-intervention.ts
 *
 * Couple-level admin "Send Intervention" actions. Triggered from
 * /dashboard/my-clients/[coupleId].
 *
 * Schema notes (the reason this file is more verbose than its zod
 * schema implies):
 *
 *   sent_messages   — has NO couple_id column. We persist couple
 *                     context only via the recipient's couple_members
 *                     row. `to_address` is REQUIRED (the column drives
 *                     real email/SMS delivery in /api/engagement/tick),
 *                     so we look up the recipient's email up-front.
 *                     The 'channel' enum is ('email','sms','whatsapp',
 *                     'task','insight') — we use 'insight' for the
 *                     in-app coach-message variant.
 *
 *   journey_tasks   — also no couple_id. Has BILINGUAL columns
 *                     (title_he + title_en, body_he + body_en) — the
 *                     admin enters one language; we mirror it to both
 *                     so existing user UI (which reads per-locale)
 *                     never renders empty strings.
 *
 *   journey_assignments — XOR (user_id, couple_id). source_kind is a
 *                         text discriminator ('item'|'category'|'program');
 *                         we always emit 'item' here because the form
 *                         only exposes item picking. anchor_date is
 *                         REQUIRED — we default to "now" when the admin
 *                         doesn't pick a scheduled date.
 *
 * Reflection prompts share the journey_tasks table — there's no
 * separate "reflection" table. We tag them with a "[רפלקציה] / [Reflection]"
 * title prefix so the existing user inbox UI can either render them
 * specially OR just treat them as tasks-with-an-open-question.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not_authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    throw new Error("not_admin");
  }
  return user.id;
}

// ─── Validation ───────────────────────────────────────────────────────────────

const TargetEnum = z.enum(["both", "a", "b"]);

const InterventionSchema = z.object({
  coupleId: z.string().uuid(),
  target: TargetEnum,
  adminNote: z.string().max(2000).optional(),
  payload: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("message"),
      title: z.string().min(1).max(200),
      body: z.string().min(1).max(5000),
    }),
    z.object({
      kind: z.literal("task"),
      title: z.string().min(1).max(200),
      description: z.string().max(5000).optional(),
      dueAt: z.string().datetime().optional(),
    }),
    z.object({
      kind: z.literal("reflection_prompt"),
      title: z.string().min(1).max(200),
      prompt: z.string().min(1).max(5000),
      dueAt: z.string().datetime().optional(),
    }),
    z.object({
      kind: z.literal("item_assignment"),
      itemId: z.string().uuid(),
      scheduledFor: z.string().datetime().optional(),
    }),
  ]),
});

export type InterventionInput = z.input<typeof InterventionSchema>;

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

// ─── Couple resolution ────────────────────────────────────────────────────────

interface ResolvedTarget {
  userId: string;
  email: string | null;
}

/**
 * Resolves the couple id into the list of targets for the action,
 * INCLUDING each target's email (required by sent_messages.to_address).
 *
 * "A" is the couple_members row with role='owner' if present;
 * otherwise the earliest joined member. "B" is the other one. This
 * matches the convention used by partners-split.tsx so admin sees
 * consistent A/B labels.
 */
async function resolveTargets(
  coupleId: string,
  target: "both" | "a" | "b",
): Promise<ResolvedTarget[]> {
  const admin = createServiceRoleClient();
  if (!admin) throw new Error("service_role_unavailable");

  const { data: members, error } = await admin
    .from("couple_members")
    .select("user_id, role, joined_at")
    .eq("couple_id", coupleId)
    .order("joined_at", { ascending: true });

  if (error) throw error;
  if (!members || members.length === 0) {
    throw new Error("couple_has_no_members");
  }

  const owner = members.find((m) => m.role === "owner");
  const partner = members.find((m) => m.role !== "owner");
  const aId = owner?.user_id ?? members[0].user_id;
  const bId = partner?.user_id ?? members[1]?.user_id ?? null;

  let userIds: string[];
  if (target === "a") userIds = [aId];
  else if (target === "b") {
    if (!bId) throw new Error("partner_b_not_present");
    userIds = [bId];
  } else userIds = [aId, ...(bId ? [bId] : [])];

  // Fetch emails in one round-trip — needed for sent_messages.to_address.
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email")
    .in("id", userIds);

  const emailById = new Map<string, string | null>();
  for (const p of profiles ?? []) emailById.set(p.id, p.email);

  return userIds.map((id) => ({
    userId: id,
    email: emailById.get(id) ?? null,
  }));
}

// ─── Main entrypoint ──────────────────────────────────────────────────────────

export async function sendIntervention(
  raw: InterventionInput,
): Promise<ActionResult<{ recipients: number }>> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const parsed = InterventionSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "validation_failed",
    };
  }
  const v = parsed.data;

  let targets: ResolvedTarget[];
  try {
    targets = await resolveTargets(v.coupleId, v.target);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, error: "service_role_unavailable" };

  const adminNote =
    v.adminNote && v.adminNote.trim().length > 0 ? v.adminNote.trim() : null;

  // ── MESSAGE ────────────────────────────────────────────────────────────────
  if (v.payload.kind === "message") {
    const { title, body } = v.payload;
    // 'insight' channel = in-app coach message; the engagement worker
    // never tries to deliver these via SMS/email (it gates on channel
    // ∈ {email,sms,whatsapp}). to_address is still required by the
    // schema, so we stamp the recipient's email or a synthetic
    // placeholder. See /api/engagement/tick for delivery rules.
    const rows = targets.map((t) => ({
      user_id: t.userId,
      channel: "insight" as const,
      subject: title,
      body,
      to_address: t.email ?? `user:${t.userId}`,
      sent_by: "admin" as const,
      sent_by_admin: adminId,
      status: "sent" as const,
    }));
    const { error } = await admin.from("sent_messages").insert(rows);
    if (error) return { ok: false, error: error.message };
  }

  // ── TASK / REFLECTION PROMPT ────────────────────────────────────────────────
  // Reflection prompts go into journey_tasks (same shape) but with a
  // [רפלקציה] / [Reflection] prefix so the user UI can style them
  // differently. The body_he/body_en fields hold the question prompt.
  else if (
    v.payload.kind === "task" ||
    v.payload.kind === "reflection_prompt"
  ) {
    const isReflection = v.payload.kind === "reflection_prompt";
    const titleRaw =
      v.payload.kind === "reflection_prompt"
        ? v.payload.title
        : v.payload.title;
    const bodyRaw =
      v.payload.kind === "reflection_prompt"
        ? v.payload.prompt
        : v.payload.kind === "task"
        ? v.payload.description ?? ""
        : "";

    const titleHe = isReflection ? `[רפלקציה] ${titleRaw}` : titleRaw;
    const titleEn = isReflection ? `[Reflection] ${titleRaw}` : titleRaw;

    const due =
      v.payload.kind === "reflection_prompt"
        ? v.payload.dueAt ?? null
        : v.payload.kind === "task"
        ? v.payload.dueAt ?? null
        : null;

    const rows = targets.map((t) => ({
      user_id: t.userId,
      title_he: titleHe,
      title_en: titleEn,
      body_he: bodyRaw,
      body_en: bodyRaw,
      due_at: due,
      assigned_by: "admin" as const,
      notes: adminNote,
      status: "open" as const,
    }));
    const { error } = await admin.from("journey_tasks").insert(rows);
    if (error) return { ok: false, error: error.message };
  }

  // ── ITEM ASSIGNMENT ─────────────────────────────────────────────────────────
  // journey_assignments enforces XOR(user_id, couple_id). For a "send to
  // both partners" we insert TWO rows (one user_id each), not a single
  // couple_id row — that way each partner has its own per-user
  // engagement state.
  else if (v.payload.kind === "item_assignment") {
    const itemId = v.payload.itemId;
    const anchor = v.payload.scheduledFor ?? new Date().toISOString();
    const rows = targets.map((t) => ({
      user_id: t.userId,
      couple_id: null,
      source_kind: "item" as const,
      source_id: itemId,
      anchor_kind: "assignment" as const,
      anchor_date: anchor,
      origin: "admin_manual" as const,
      assigned_by: adminId,
      notes: adminNote,
      is_active: true,
    }));
    const { error } = await admin.from("journey_assignments").insert(rows);
    if (error) return { ok: false, error: error.message };
  }

  // Revalidate everything the coach is likely looking at after sending.
  revalidatePath(`/dashboard/my-clients/${v.coupleId}`);
  revalidatePath("/dashboard/journey/clients");
  for (const t of targets) revalidatePath(`/dashboard/users/${t.userId}`);

  return { ok: true, data: { recipients: targets.length } };
}
