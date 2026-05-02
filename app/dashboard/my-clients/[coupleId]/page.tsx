/**
 * /dashboard/my-clients/[coupleId]
 *
 * The expert's view of one couple. Shows both partners, current Journey
 * assignments, and a form to prescribe new content (program / category /
 * single item). Auth: only experts linked to this couple can open it
 * (admins always pass).
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Clock,
  PauseCircle,
} from "lucide-react";
import { requireExpert } from "@/lib/auth/expert";
import {
  getExpertClientDetail,
  listAssignableSources,
} from "@/lib/experts/queries";
import { Badge } from "@/components/ui/badge";
import { AssignContentForm } from "./assign-form";
import { CoupleTimelineCsv } from "./timeline-csv";
import { RecentActivity } from "./recent-activity";
import { PartnersSplit } from "./partners-split";
import { PriorityDivergence } from "./priority-divergence";

// ── New clinical-layer modules (2026-Q2 upgrade) ──
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { adminListCategoriesWithItemCounts } from "@/lib/journey-content/queries";
import {
  buildComparisonMatrix,
  type ComparisonRow,
} from "@/lib/journey/comparison";
import {
  getPriorityLabels,
} from "@/lib/journey-content/priority-categories";
import { listFeedbackForCouple } from "@/lib/journey/feedback";
import type { Response, AnswerValue, Locale } from "@/lib/journey/types";
import { CoupleComparisonView } from "@/components/dashboard/journey/CoupleComparisonView";
import { SendInterventionModule } from "@/components/dashboard/journey/SendInterventionModule";
import {
  FeedbackList,
  FeedbackNewButton,
} from "@/components/dashboard/journey/feedback/FeedbackList";
// Phase 2C — read-only inbox of user responses to journey items
import { listClinicianResponsesForUsers } from "@/lib/journey-content/clinician-responses";
import { ClientResponsesInbox } from "@/components/dashboard/journey/ClientResponsesInbox";
// Phase 4 — user→clinician messages from the dashboard
import { listClinicianUserMessages } from "@/lib/journey-content/user-messages";
import { ClientMessagesList } from "@/components/dashboard/journey/ClientMessagesList";
// PR2 expert-onboarding — bidirectional general-channel reply UI
import { getGeneralChannelThreadForAdmin } from "@/lib/journey-content/messages";
import { GeneralChannelAdminReply } from "@/components/dashboard/journey/GeneralChannelAdminReply";

export const dynamic = "force-dynamic";

/**
 * Loads both partners' journey_responses keyed by user_id, then
 * shapes them into the Response[] format that buildComparisonMatrix
 * expects. Service role because partners only have SELECT on their
 * own rows under RLS — admin bypass is intentional here.
 *
 * Done in two queries because PostgREST's filter-on-nested-join is
 * inconsistent across Supabase client versions for `.in()` on a
 * to-one relationship. The 2-step approach is bulletproof and the
 * extra round-trip is negligible at this data volume.
 */
async function loadPartnerResponses(
  userIds: string[],
): Promise<Map<string, Response[]>> {
  const out = new Map<string, Response[]>();
  if (userIds.length === 0) return out;

  const admin = createServiceRoleClient();
  if (!admin) return out;

  // Step 1 — find every journey owned by any of these users. A user
  // can have multiple journey rows over time; we want all of them so
  // the comparison reflects the full assessment history.
  const { data: journeys } = await admin
    .from("journeys")
    .select("id, user_id")
    .in("user_id", userIds);

  if (!journeys || journeys.length === 0) return out;

  const journeyToUser = new Map<string, string>();
  for (const j of journeys) journeyToUser.set(j.id, j.user_id);
  const journeyIds = Array.from(journeyToUser.keys());

  // Step 2 — pull the responses tied to those journeys.
  const { data: rows } = await admin
    .from("journey_responses")
    .select("journey_id, question_id, answer, locale")
    .in("journey_id", journeyIds);

  if (!rows) return out;

  for (const r of rows) {
    const userId = journeyToUser.get(r.journey_id);
    if (!userId) continue;
    const list = out.get(userId) ?? [];
    list.push({
      question_id: r.question_id,
      answer: r.answer as AnswerValue,
      locale: r.locale as Locale,
    });
    out.set(userId, list);
  }
  return out;
}

/**
 * Pulls every active journey_item for the intervention picker. We
 * filter to active items only — admin can re-activate retired items
 * via /dashboard/journey/items if they need to be assignable here.
 */
async function loadAssignableItems() {
  const admin = createServiceRoleClient();
  if (!admin) return [] as Array<{ id: string; title_he: string | null; title_en: string | null }>;
  const { data } = await admin
    .from("journey_items")
    .select("id, title_he, title_en")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(500);
  return data ?? [];
}

/** Couples list — used by the per-question feedback dialog dropdown. */
async function loadAllCouples() {
  const admin = createServiceRoleClient();
  if (!admin)
    return [] as Array<{
      id: string;
      display_name: string | null;
      pair_code: string;
    }>;
  const { data } = await admin
    .from("couples")
    .select("id, display_name, pair_code")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(500);
  return data ?? [];
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function CoupleDetailPage({
  params,
}: {
  params: { coupleId: string };
}) {
  const session = await requireExpert();

  const detail = await getExpertClientDetail({
    expertId: session.user.id,
    isAdmin: session.isAdmin,
    coupleId: params.coupleId,
  });
  if (!detail) notFound();

  // Resolve A/B partner ids for the new clinical modules. We follow
  // the same convention as journey-intervention.ts: A = owner if
  // present, otherwise the earliest joined member; B = the other.
  const ownerMember = detail.members.find((m) => m.role === "owner");
  const partnerMember = detail.members.find((m) => m.role !== "owner");
  const partnerAId = ownerMember?.userId ?? detail.members[0]?.userId ?? null;
  const partnerBId =
    partnerMember?.userId ?? detail.members[1]?.userId ?? null;

  const partnerAEmail =
    detail.members.find((m) => m.userId === partnerAId)?.email ?? null;
  const partnerBEmail = partnerBId
    ? detail.members.find((m) => m.userId === partnerBId)?.email ?? null
    : null;

  const partnerALabel =
    partnerAEmail ?? (partnerAId ? `${partnerAId.slice(0, 6)}…` : "Partner A");
  const partnerBLabel =
    partnerBEmail ?? (partnerBId ? `${partnerBId.slice(0, 6)}…` : "Partner B");

  const partnerUserIds = [partnerAId, partnerBId].filter(
    (v): v is string => !!v,
  );

  const [
    sources,
    responsesByUser,
    items,
    couplesAll,
    categoriesAll,
    feedbackForCouple,
    journeyItemResponses,
  ] = await Promise.all([
    listAssignableSources(),
    loadPartnerResponses(partnerUserIds),
    loadAssignableItems(),
    loadAllCouples(),
    adminListCategoriesWithItemCounts(),
    listFeedbackForCouple(detail.coupleId).catch(() => ({
      rows: [],
      total: 0,
    })),
    // Phase 2C — read-only inbox of journey-item responses by both partners
    listClinicianResponsesForUsers({
      userIds: partnerUserIds,
      limit: 50,
      isHe: true,
    }),
  ]);

  // Phase 4 — free-text messages from JourneyExpertMessage. Loaded
  // separately (not in the big Promise.all) to keep the diff clean
  // and to make it easy to fail-soft if the migration isn't applied
  // yet on this environment.
  const journeyUserMessages = await listClinicianUserMessages({
    userIds: partnerUserIds,
    limit: 50,
  }).catch(() => []);

  // PR2 expert-onboarding — per-partner general-channel threads.
  // One fetch per partner; the channel is per-user, never shared.
  const channelThreadsByUser = await Promise.all(
    partnerUserIds.map(async (uid) => ({
      userId: uid,
      messages: await getGeneralChannelThreadForAdmin(uid).catch(() => []),
    })),
  );

  // Map user_id → human label (email or "Partner A/B"), used by the
  // inbox component to attribute each response.
  const partnerLabelsById = new Map<string, string>();
  if (partnerAId) partnerLabelsById.set(partnerAId, partnerALabel);
  if (partnerBId) partnerLabelsById.set(partnerBId, partnerBLabel);

  // Build the comparison matrix once, server-side. Empty arrays for
  // missing partners — the matrix builder treats them as "not answered".
  const responsesA = partnerAId ? responsesByUser.get(partnerAId) ?? [] : [];
  const responsesB = partnerBId ? responsesByUser.get(partnerBId) ?? [] : [];
  // v3 slice 1: priority labels come from the DB (journey_categories
  // assessment_priority_key seed) rather than the dropped constant maps.
  const priorityLabels = await getPriorityLabels();
  const comparisonRows: ComparisonRow[] = buildComparisonMatrix(
    responsesA,
    responsesB,
    priorityLabels,
    { locale: "he" },
  );

  // Schema asymmetry note: journey_categories has name_he/name_en
  // (different from journey_items which uses title_he/title_en).
  // We surface the real columns to the components verbatim; they
  // expect this exact shape now.
  const categoriesForForms = categoriesAll.map((c) => ({
    id: c.id,
    name_he: c.name_he ?? null,
    name_en: c.name_en ?? null,
  }));

  const memberSummary =
    detail.members.length === 0
      ? `Couple · ${detail.coupleId.slice(0, 8)}`
      : detail.members
          .map((m) => m.email ?? m.userId.slice(0, 8))
          .join(" & ");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href="/dashboard/my-clients"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" />
          Back to My Clients
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          {detail.displayName || memberSummary}
        </h1>
        <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-sm">
          {detail.pairCode ? (
            <Badge variant="outline" className="font-mono text-[10px]">
              {detail.pairCode}
            </Badge>
          ) : null}
          <span className="font-mono text-xs">
            couple:{detail.coupleId.slice(0, 12)}…
          </span>
        </div>
      </div>

      {/* Per-partner split view — left/right with separate demographics,
          priority ranking, diagnostic, audience-filtered progress, and
          activity history. */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Partners (split view)
        </h2>
        <PartnersSplit coupleId={detail.coupleId} />
      </section>

      {/* Priority alignment — both partners' rankings side by side with
          a gap badge per category. Renders an empty state when only one
          partner has ranked so far. */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Priority alignment
        </h2>
        <PriorityDivergence coupleId={detail.coupleId} />
      </section>

      {/* ── NEW ── Side-by-side question matrix.
          Aligns every question both partners answered, with a per-row
          divergence badge. Annotate-button on each row opens a feedback
          dialog pre-bound to (couple, partner-A, question_id) so the
          coach can write a clinical note tied to a specific moment in
          the assessment. */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Synchronized assessment
        </h2>
        <CoupleComparisonView
          rows={comparisonRows}
          partnerALabel={partnerALabel}
          partnerBLabel={partnerBLabel}
          coupleId={detail.coupleId}
          partnerAUserId={partnerAId ?? ""}
          couples={couplesAll}
          categories={categoriesForForms}
        />
      </section>

      {/* ── NEW ── Send Intervention module.
          The "prescription" surface — message / task / reflection-prompt
          / item-assignment to BOTH | only A | only B in 1-2 clicks. Sits
          on top of "Prescribe content" (which is the older program/
          category bulk-assign form) so the coach picks granular
          interventions here and macro program flows below. */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Send intervention
        </h2>
        <SendInterventionModule
          coupleId={detail.coupleId}
          partnerALabel={partnerALabel}
          partnerBLabel={partnerBLabel}
          items={items}
          hasPartnerB={!!partnerBId}
        />
      </section>

      {/* ── Phase 2C ── Inbox: what the clients said about the items
          they've already opened. Read-only for now; the clinician
          reads to decide what to send next via "Send intervention"
          above. Reply / status workflow ships in Phase 2D. */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Client responses
        </h2>
        <ClientResponsesInbox
          isHe={true}
          rows={journeyItemResponses}
          partners={partnerLabelsById}
          coupleId={detail.coupleId}
        />
      </section>

      {/* ── Phase 4 ── Free-text messages the clients typed via
          JourneyExpertMessage on /my/journey. One-way channel —
          the clinician acts via assignments + interventions. */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Messages from clients
        </h2>
        <ClientMessagesList
          rows={journeyUserMessages}
          partners={partnerLabelsById}
        />
      </section>

      {/* ── PR2 expert-onboarding ── Per-partner general channel.
          Threaded view + composer. Each tab is one partner's PRIVATE
          channel — partners never see each other's. Sits with the
          same visual weight as the per-item reply UI above so the
          on-duty clinician can pick the right surface in one glance. */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Reply in private channel
        </h2>
        <GeneralChannelAdminReply
          partners={channelThreadsByUser.map((t) => ({
            userId: t.userId,
            label: partnerLabelsById.get(t.userId) ?? "Partner",
            messages: t.messages,
          }))}
        />
      </section>

      {/* Assign content */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Prescribe content (program / category bulk)
        </h2>
        <AssignContentForm coupleId={detail.coupleId} sources={sources} />
      </section>

      {/* Per-couple timeline CSV — download / upload */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Custom timeline (CSV)
        </h2>
        <CoupleTimelineCsv coupleId={detail.coupleId} />
      </section>

      {/* Current assignments */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Active timeline
        </h2>
        {detail.assignments.length === 0 ? (
          <div className="border-border bg-muted/30 text-muted-foreground rounded-lg border p-6 text-center text-sm">
            No content assigned yet — use the form above to prescribe a
            program, category, or single item.
          </div>
        ) : (
          <ul className="divide-border border-border overflow-hidden rounded-lg border divide-y">
            {detail.assignments.map((a) => {
              const pct =
                a.scheduledTotal > 0
                  ? Math.round(
                      (a.scheduledCompleted / a.scheduledTotal) * 100,
                    )
                  : 0;
              return (
                <li
                  key={a.id}
                  className="bg-card flex flex-wrap items-center gap-3 p-4"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
                    {a.isActive ? (
                      a.scheduledTotal > 0 &&
                      a.scheduledCompleted >= a.scheduledTotal ? (
                        <CheckCircle2 className="size-4 text-emerald-500" />
                      ) : (
                        <Clock className="size-4" />
                      )
                    ) : (
                      <PauseCircle className="size-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">
                        {a.sourceTitle ??
                          `${a.sourceKind}:${a.sourceId.slice(0, 8)}`}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {a.sourceKind}
                      </Badge>
                      {!a.isActive ? (
                        <Badge variant="secondary" className="text-[10px]">
                          paused
                        </Badge>
                      ) : null}
                    </div>
                    <div className="text-muted-foreground mt-0.5 text-xs">
                      Anchor {fmtDate(a.anchorDate)} · created{" "}
                      {fmtDate(a.createdAt)}
                    </div>
                  </div>
                  <div className="text-xs">
                    <div className="font-semibold">
                      {a.scheduledCompleted}/{a.scheduledTotal}
                    </div>
                    <div className="text-muted-foreground text-[10px]">
                      {pct}% done
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Recent activity */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Recent activity
        </h2>
        <RecentActivity coupleId={detail.coupleId} />
      </section>

      {/* ── NEW ── Clinical feedback timeline (couple-scoped).
          Surfaces every journey_feedback row attached to this couple,
          newest first. The "New note" button opens the feedback form
          with the couple already preselected. This is the second-most-
          used surface in the workspace (after the comparison matrix)
          for a coach mid-session. */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Clinical notes ({feedbackForCouple.total})
          </h2>
          <FeedbackNewButton
            couples={couplesAll}
            categories={categoriesForForms}
          />
        </div>
        <FeedbackList
          rows={feedbackForCouple.rows}
          view="timeline"
          couples={couplesAll}
          categories={categoriesForForms}
          page={1}
          totalPages={1}
        />
      </section>

      {/* Per-partner audience reminder */}
      <div className="border-border bg-muted/30 text-muted-foreground rounded-lg border p-4 text-xs">
        <CircleAlert className="me-1 inline size-3.5" />
        Per-partner content visibility is live: each item carries an{" "}
        <code>audience</code> of <em>both</em> / <em>owner</em> /{" "}
        <em>partner</em>. To prescribe a custom per-partner mix for this couple
        without editing the global catalog, use the <strong>Custom timeline
        CSV</strong> above.
      </div>
    </div>
  );
}
