import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import {
  adminListCategoriesWithItemCounts,
  getGroupById,
  listGroupMembers,
  listGroupSubtopicBindings,
} from "@/lib/journey-content/queries";
import { GroupForm } from "@/components/dashboard/journey/GroupForm";
import { GroupMemberPicker } from "@/components/dashboard/journey/GroupMemberPicker";
import { GroupSubtopicBinder } from "@/components/dashboard/journey/GroupSubtopicBinder";
import { GroupActivitySummary } from "@/components/dashboard/journey/GroupActivitySummary";
import {
  getGroupBindingDeliveryCounts,
  getGroupMemberStats,
} from "@/lib/journey-content/group-stats";
import type { JourneySubtopic } from "@/lib/journey-content/types";
import type { JourneyGroupFormValues } from "@/lib/journey-content/validations";

export const dynamic = "force-dynamic";

export default async function EditGroupPage({
  params,
}: {
  params: { id: string };
}) {
  await requireAdmin();
  const group = await getGroupById(params.id);
  if (!group) notFound();

  const [
    members,
    bindings,
    categories,
    memberStats,
    bindingDeliveryCounts,
  ] = await Promise.all([
    listGroupMembers(group.id),
    listGroupSubtopicBindings(group.id),
    adminListCategoriesWithItemCounts(),
    getGroupMemberStats(group.id),
    getGroupBindingDeliveryCounts(group.id),
  ]);

  // All active subtopics (any category) for the binder picker.
  const admin = createServiceRoleClient();
  if (!admin) throw new Error("service role unavailable");
  const { data: subtopicRows } = await admin
    .from("journey_subtopics")
    .select("id, name_he, name_en, category_id, is_active")
    .eq("is_active", true)
    .order("category_id", { ascending: true })
    .order("sort_order", { ascending: true });
  const subtopics = (subtopicRows ?? []) as Pick<
    JourneySubtopic,
    "id" | "name_he" | "name_en" | "category_id"
  >[];
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name_he] as const));

  const subtopicOptions = subtopics.map((s) => ({
    id: s.id,
    label: `${categoryNameById.get(s.category_id) ?? "(category)"} · ${s.name_he}`,
    category_id: s.category_id,
  }));

  const defaults: JourneyGroupFormValues = {
    slug: group.slug,
    label_he: group.label_he,
    label_en: group.label_en ?? "",
    description_he: group.description_he ?? "",
    description_en: group.description_en ?? "",
    is_active: group.is_active,
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <Link
          href="/dashboard/journey/groups"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" />
          Back to groups
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          {group.label_he}
        </h1>
        {group.label_en ? (
          <p className="text-muted-foreground mt-1 text-sm">{group.label_en}</p>
        ) : null}
      </div>

      <GroupForm groupId={group.id} defaultValues={defaults} />

      <GroupActivitySummary
        members={members}
        bindings={bindings}
        memberStats={memberStats}
        bindingDeliveryCounts={bindingDeliveryCounts}
      />

      <GroupMemberPicker groupId={group.id} initialMembers={members} />

      <GroupSubtopicBinder
        groupId={group.id}
        initialBindings={bindings}
        subtopicOptions={subtopicOptions}
      />
    </div>
  );
}
