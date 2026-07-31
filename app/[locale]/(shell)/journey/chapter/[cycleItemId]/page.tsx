/**
 * /journey/chapter/[cycleItemId] — read one chapter of the current cycle.
 *
 * Keyed on journey_cycle_items, the single source of truth for what a user
 * has (Itzik 2026-07-31). The older /journey/timeline/[scheduledId] route is
 * keyed on the retired weekly model; it is not consulted here and there is no
 * fallback between them, deliberately.
 *
 * Everything in a cycle is open from the moment the cycle opens, so this page
 * has no lock state — only an ownership check.
 */

import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/navigation";
import { ArrowRight } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { LessonView } from "@/components/journey/timeline/LessonView";
import { ChapterDoneButton } from "@/components/my/ChapterDoneButton";
import type { JourneyItem } from "@/lib/journey-content/types";

export const dynamic = "force-dynamic";

export default async function ChapterPage({
  params,
}: {
  params: { locale: string; cycleItemId: string };
}) {
  const { locale, cycleItemId } = params;
  setRequestLocale(locale);
  const isHe = locale !== "en";

  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect(`/${locale}/auth`);

  const admin = createServiceRoleClient();
  if (!admin) notFound();

  const { data: row } = await admin
    .from("journey_cycle_items")
    .select(
      "id, item_id, completed_at, journey_cycles!inner(user_id), journey_categories!journey_cycle_items_category_id_fkey(name_he, name_en)",
    )
    .eq("id", cycleItemId)
    .maybeSingle();
  if (!row) notFound();

  const typed = row as unknown as {
    id: string;
    item_id: string;
    completed_at: string | null;
    journey_cycles: { user_id: string };
    journey_categories: { name_he: string; name_en: string | null } | null;
  };

  // A chapter belongs to exactly one person's cycle.
  if (typed.journey_cycles.user_id !== auth.user.id) notFound();

  const { data: itemRow } = await admin
    .from("journey_items")
    .select("*")
    .eq("id", typed.item_id)
    .maybeSingle();
  if (!itemRow) notFound();

  const item = itemRow as JourneyItem;
  const categoryName = isHe
    ? typed.journey_categories?.name_he
    : typed.journey_categories?.name_en || typed.journey_categories?.name_he;

  return (
    <div dir={isHe ? "rtl" : "ltr"} className="mx-auto w-full max-w-3xl px-4 py-6">
      <Link
        href="/my/lessons"
        className="inline-flex items-center gap-1 text-sm text-white/55 transition hover:text-white/90"
      >
        <ArrowRight className="h-4 w-4" />
        {isHe ? "לפרקים שלי" : "My chapters"}
      </Link>

      {categoryName && (
        <div className="mt-4 text-[11.5px] font-bold uppercase tracking-wide text-white/55">
          {categoryName}
        </div>
      )}

      <LessonView item={item} isHe={isHe} />

      <div className="mt-8">
        <ChapterDoneButton
          cycleItemId={typed.id}
          alreadyDone={Boolean(typed.completed_at)}
          isHe={isHe}
        />
      </div>
    </div>
  );
}
