/**
 * /[locale]/journey/timeline/[scheduledId]
 *
 * Detail view for a single scheduled item. Loads the item content, the
 * owning assignment, the completion state, and the responses visible to
 * the viewer (private-filtered). Hands off to ItemDetailClient for the
 * interactive surface.
 *
 * Ownership gate: viewer must either be the assignment's user_id or a
 * member of the assignment's couple. Otherwise we render 404 so we don't
 * leak the item's existence.
 */

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/navigation";
import { ArrowLeft, ArrowRight, Compass } from "lucide-react";
import { routing } from "@/i18n/routing";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { deriveStatus, isOpenable } from "@/lib/journey-content/status";
import { logActivity } from "@/lib/journey/activity";
import type {
  JourneyAssignment,
  JourneyCategory,
  JourneyItem,
  JourneyItemCompletion,
  JourneyItemResponse,
  JourneyScheduledItem,
} from "@/lib/journey-content/types";
import { ItemDetailClient } from "@/components/journey/timeline/ItemDetailClient";
import { AssessmentItemForm } from "@/components/my/AssessmentItemForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { locale: string; scheduledId: string };
}): Promise<Metadata> {
  const isHe = params.locale === "he";
  return {
    title: `Mioshy - ${isHe ? "פרק במסע" : "Journey chapter"}`,
    robots: { index: false, follow: false },
  };
}

export default async function JourneyTimelineItemPage({
  params,
}: {
  params: { locale: string; scheduledId: string };
}) {
  const { locale, scheduledId } = params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  setRequestLocale(locale);

  const isHe = locale === "he";

  // ── Auth ─────────────────────────────────────────────────────────────
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth`);

  // ── Load scheduled + assignment (admin client - RLS would allow this
  // read for legit owners but admin is simpler and authorisation is
  // enforced below by explicit ownership checks).
  const admin = createServiceRoleClient();
  if (!admin) throw new Error("service role unavailable");

  const { data: scheduledRow } = await admin
    .from("journey_scheduled_items")
    .select("*")
    .eq("id", scheduledId)
    .maybeSingle();
  if (!scheduledRow) notFound();
  const scheduled = scheduledRow as JourneyScheduledItem;

  const { data: assignmentRow } = await admin
    .from("journey_assignments")
    .select("*")
    .eq("id", scheduled.assignment_id)
    .maybeSingle();
  if (!assignmentRow) notFound();
  const assignment = assignmentRow as JourneyAssignment;

  // ── Ownership gate: viewer is the user, or a member of the couple.
  let ownedByMe = false;
  let viewerCoupleRole: "owner" | "partner" | null = null;
  if (assignment.user_id && assignment.user_id === user.id) {
    ownedByMe = true;
  } else if (assignment.couple_id) {
    const { data: membership } = await admin
      .from("couple_members")
      .select("couple_id, role")
      .eq("couple_id", assignment.couple_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (membership) {
      ownedByMe = true;
      viewerCoupleRole =
        ((membership as { role: string }).role as "owner" | "partner") ?? null;
    }
  }
  if (!ownedByMe) notFound();

  // Audience gate — if this scheduled row is targeted at the OTHER partner,
  // bounce back to the timeline. ('both' is always allowed; user-owned
  // assignments are always 'both' by the migration's invariants but we still
  // check defensively for stored values.)
  if (
    assignment.couple_id &&
    scheduled.audience !== "both" &&
    scheduled.audience !== viewerCoupleRole
  ) {
    redirect(`/${locale}/journey/timeline`);
  }

  // Cancelled assignments should not surface deep-links.
  if (!assignment.is_active) {
    redirect(`/${locale}/journey/timeline`);
  }

  // ── Item + category + completion + responses ─────────────────────────
  const [itemRes, completionRes, responsesRes] = await Promise.all([
    admin.from("journey_items").select("*").eq("id", scheduled.item_id).maybeSingle(),
    admin
      .from("journey_item_completions")
      .select("*")
      .eq("scheduled_item_id", scheduledId)
      .maybeSingle(),
    admin
      .from("journey_item_responses")
      .select("*")
      .eq("scheduled_item_id", scheduledId)
      .order("created_at", { ascending: true }),
  ]);

  if (!itemRes.data) notFound();
  const item = itemRes.data as JourneyItem;

  const { data: categoryRow } = await admin
    .from("journey_categories")
    .select("id, name_he, name_en, slug")
    .eq("id", item.category_id)
    .maybeSingle();
  const category =
    (categoryRow as Pick<JourneyCategory, "id" | "name_he" | "name_en" | "slug"> | null) ??
    null;

  const completion =
    (completionRes.data as JourneyItemCompletion | null) ?? null;

  // Private-response filter: only the author sees their own private notes.
  const responses = ((responsesRes.data ?? []) as JourneyItemResponse[]).filter(
    (r) => !r.is_private || r.user_id === user.id,
  );

  // Phase 3 step 2 — for assessment-kind items, the form pre-fills
  // from the user's most-recent prior response (if any) so they can
  // revise rather than re-answer from scratch.
  const myExistingResponse =
    item.kind === "assessment"
      ? responses
          .filter((r) => r.user_id === user.id)
          .sort((a, b) =>
            (b.created_at ?? "").localeCompare(a.created_at ?? ""),
          )[0]
      : null;

  const status = deriveStatus({
    unlockAt: scheduled.unlock_at,
    hasCompletion: !!completion,
  });

  // Locked items shouldn't be reachable (TimelineList wraps them in a
  // non-link), but if someone manually hit the URL we redirect back to
  // the list rather than showing a half-functional page.
  if (!isOpenable(status)) {
    redirect(`/${locale}/journey/timeline`);
  }

  // Log item_opened for the unread-count badge on /my. Idempotent on the
  // user side — multiple visits all count as "opened" and the badge stays
  // off. Failure-tolerant (logActivity catches its own errors).
  await logActivity({
    userId: user.id,
    coupleId: assignment.couple_id ?? null,
    scheduledItemId: scheduled.id,
    verb: "item_opened",
  });

  const Arrow = isHe ? ArrowLeft : ArrowRight;

  return (
    <div
      dir={isHe ? "rtl" : "ltr"}
      className="relative min-h-[100dvh] overflow-hidden text-white"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[80vh] opacity-65 animate-aurora-drift"
        style={{
          background:
            "radial-gradient(1000px 500px at 15% -10%, rgba(99,102,241,0.22), transparent 60%), radial-gradient(800px 400px at 85% 10%, rgba(16,185,129,0.14), transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[55vh] h-[80vh] opacity-50 animate-aurora-breathe"
        style={{
          background:
            "radial-gradient(800px 400px at 80% 40%, rgba(236,72,153,0.10), transparent 60%), radial-gradient(700px 380px at 15% 65%, rgba(99,102,241,0.12), transparent 60%)",
        }}
      />

      <main className="relative mx-auto max-w-3xl px-4 pb-24 pt-10 sm:pt-14">
        <Link
          href="/journey/timeline"
          className="inline-flex items-center gap-1 text-xs font-medium text-white/55 transition hover:text-white/90"
        >
          <Arrow className="h-3 w-3 rotate-180" />
          {isHe ? "חזרה לציר המסע" : "Back to the timeline"}
        </Link>

        <div className="mt-5 flex items-center gap-2 text-xs text-white/60">
          <Compass className="h-3.5 w-3.5 text-indigo-300" />
          <span>
            {category
              ? (isHe ? category.name_he : category.name_en ?? category.name_he)
              : isHe
                ? "פרק"
                : "Chapter"}
          </span>
        </div>

        {/* Phase 3 step 2: when this is an assessment-kind item, render
            the structured form ABOVE the standard detail block. The
            standard ItemDetailClient still renders the body / category
            / past responses underneath; the assessment form is just
            a richer way to collect a response.
            For 'content' items (the existing default), the form is
            skipped — ItemDetailClient handles everything. */}
        {item.kind === "assessment" && item.assessment_payload ? (
          <div className="mt-6">
            <AssessmentItemForm
              isHe={isHe}
              scheduledItemId={scheduled.id}
              payload={item.assessment_payload}
              initialAnswers={
                myExistingResponse?.structured_answer ?? undefined
              }
              initialSummary={myExistingResponse?.response_text}
              initialPrivate={myExistingResponse?.is_private}
            />
          </div>
        ) : null}

        <ItemDetailClient
          item={item}
          scheduled={scheduled}
          status={status}
          completion={completion}
          responses={responses}
          viewerUserId={user.id}
          locale={locale}
        />
      </main>
    </div>
  );
}
