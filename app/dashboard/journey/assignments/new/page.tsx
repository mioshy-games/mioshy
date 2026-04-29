import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import {
  adminListOwnerOptions,
  adminListPrograms,
  adminListCategoriesWithItemCounts,
  listItems,
} from "@/lib/journey-content/queries";
import { AssignmentForm } from "@/components/dashboard/journey/AssignmentForm";
import type {
  OwnerOption,
  SourceOption,
} from "@/components/dashboard/journey/AssignmentForm";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function NewAssignmentPage({
  searchParams,
}: {
  searchParams?: { owner?: string };
}) {
  await requireAdmin();

  const [ownerRaw, programs, categories, items] = await Promise.all([
    adminListOwnerOptions({ limit: 300 }),
    adminListPrograms(),
    adminListCategoriesWithItemCounts(),
    listItems({ onlyActive: true }),
  ]);

  const owners: OwnerOption[] = ownerRaw;

  const programOpts: SourceOption[] = programs
    .filter((p) => p.is_active)
    .map((p) => ({
      id: p.id,
      label: p.name_he,
      sublabel: p.slug,
    }));

  const programNameById = new Map(programs.map((p) => [p.id, p.name_he]));
  const categoryOpts: SourceOption[] = categories
    .filter((c) => c.is_active && c.item_count > 0)
    .map((c) => ({
      id: c.id,
      label: c.name_he,
      sublabel: c.program_id
        ? programNameById.get(c.program_id) ?? "program"
        : "standalone",
    }));

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name_he]));
  const itemOpts: SourceOption[] = items.map((i) => ({
    id: i.id,
    label: i.title_he,
    sublabel: categoryNameById.get(i.category_id) ?? "category",
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/dashboard/journey/assignments"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" />
          Back to assignments
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          New assignment
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Materialize a timeline for a couple or a single user. Only active
          catalog rows get pulled in.
        </p>
      </div>

      <AssignmentForm
        owners={owners}
        programs={programOpts}
        categories={categoryOpts}
        items={itemOpts}
        defaultOwnerKey={searchParams?.owner}
      />
    </div>
  );
}
