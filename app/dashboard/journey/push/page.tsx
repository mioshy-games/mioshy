import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import {
  adminListCategoriesWithItemCounts,
} from "@/lib/journey-content/queries";
import { listGroupsForPush } from "@/app/dashboard/actions/journey-push";
import { PushComposer } from "@/components/dashboard/journey/PushComposer";

export const dynamic = "force-dynamic";

export default async function JourneyPushPage() {
  await requireAdmin();
  const admin = createServiceRoleClient();
  if (!admin) throw new Error("service role unavailable");

  const [itemRows, subtopicRows, categories, groups] = await Promise.all([
    admin
      .from("journey_items")
      .select("id, title_he, title_en, category_id, subtopic_id, is_active")
      .eq("is_active", true)
      .order("title_he", { ascending: true }),
    admin
      .from("journey_subtopics")
      .select("id, name_he, category_id")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    adminListCategoriesWithItemCounts(),
    listGroupsForPush(),
  ]);

  const items = (itemRows.data ?? []) as Array<{
    id: string;
    title_he: string;
    title_en: string | null;
    category_id: string;
    subtopic_id: string | null;
    is_active: boolean;
  }>;
  const subtopics = (subtopicRows.data ?? []) as Array<{
    id: string;
    name_he: string;
    category_id: string;
  }>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href="/dashboard/journey"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" />
          Back to Journey overview
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Push</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          Push curated items to a user, couple, or group. Pushes ride the
          recipient&apos;s next delivery slot - they don&apos;t deliver instantly. The
          cadence engine drains pending pushes one item per slot, before
          falling through to the regular ranked picker.
        </p>
      </div>

      <PushComposer
        items={items}
        categories={categories.map((c) => ({ id: c.id, name_he: c.name_he }))}
        subtopics={subtopics}
        groups={groups}
      />
    </div>
  );
}
