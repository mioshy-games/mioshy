/**
 * /dashboard/journey/feedback
 *
 * Clinical feedback browser. The PRD's "feedback intelligence layer" -
 * the central analytical surface where coaches author and review notes
 * about users / couples.
 *
 * Architecture:
 *   - Server component: handles auth (requireAdmin), parses URL search
 *     params into a filter, executes the query, and renders the layout.
 *   - Client component: <FeedbackList> renders the rows with expand/
 *     collapse, severity badges, and a "new note" dialog.
 *
 * Why URL-driven filters: bookmarkable + shareable + works with the
 * existing Next.js navigation. No client-side state to lose on refresh.
 */

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin";
import { listFeedback } from "@/lib/journey/feedback";
import { adminListCategoriesWithItemCounts } from "@/lib/journey-content/queries";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import {
  FeedbackList,
  FeedbackNewButton,
} from "@/components/dashboard/journey/feedback/FeedbackList";
import { FeedbackFilterBar } from "@/components/dashboard/journey/feedback/FeedbackFilterBar";

export const dynamic = "force-dynamic";

interface SearchParams {
  coupleId?: string;
  userId?: string;
  categoryId?: string;
  itemId?: string;
  severity?: string;
  q?: string;
  page?: string;
  view?: "list" | "timeline";
}

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await requireAdmin();

  const sp = searchParams ?? {};
  const page = Number.parseInt(sp.page ?? "1", 10) || 1;
  const view: "list" | "timeline" = sp.view === "timeline" ? "timeline" : "list";

  // Hydrate filter values from URL - only pass the ones that are set.
  const filter = {
    coupleId: sp.coupleId,
    userId: sp.userId,
    categoryId: sp.categoryId,
    itemId: sp.itemId,
    severity: (sp.severity as
      | "observation"
      | "insight"
      | "concern"
      | "urgent"
      | undefined) ?? undefined,
    q: sp.q,
    page,
    pageSize: 50,
  };

  const [{ rows, total }, categories, couples] = await Promise.all([
    listFeedback(filter),
    adminListCategoriesWithItemCounts(),
    listAllCouplesForAdmin(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / 50));

  // The form components want exactly { id, name_he, name_en } - strip
  // the heavier JourneyCategory shape down to that for safe transfer
  // across the server→client boundary.
  const categoriesForForm = categories.map((c) => ({
    id: c.id,
    name_he: c.name_he ?? null,
    name_en: c.name_en ?? null,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/dashboard/journey"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="size-4" />
            Back to Journey overview
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Clinical Feedback
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            Coach-authored interpretations on users and couples. Distinct
            from user-authored item responses - these are NEVER shown to
            the subject.
          </p>
        </div>
        <FeedbackNewButton couples={couples} categories={categoriesForForm} />
      </div>

      <FeedbackFilterBar
        couples={couples}
        categories={categoriesForForm}
        currentFilter={filter}
        currentView={view}
        totalCount={total}
      />

      <FeedbackList
        rows={rows}
        view={view}
        couples={couples}
        categories={categoriesForForm}
        page={page}
        totalPages={totalPages}
      />
    </div>
  );
}

/**
 * Simple admin-only listing of couples for the filter dropdown +
 * the "new feedback" form. Kept inline because it's the only place
 * that needs this exact shape; if we add a second consumer we'll
 * hoist it to lib/.
 */
async function listAllCouplesForAdmin(): Promise<
  Array<{ id: string; display_name: string | null; pair_code: string }>
> {
  const admin = createServiceRoleClient();
  if (!admin) return [];
  const { data } = await admin
    .from("couples")
    .select("id, display_name, pair_code")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(500);
  return data ?? [];
}

// FeedbackNewButton is now imported directly from the FeedbackList
// module (named export). The previous local wrapper was redundant
// once we removed the static-method pattern that was breaking RSC
// hydration. Both this page and /dashboard/my-clients/[coupleId]
// import the same named export.
