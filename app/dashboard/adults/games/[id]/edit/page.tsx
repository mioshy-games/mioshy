import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import {
  getGameById,
  getGameCategoryIds,
  getGameTagIds,
  listCategories,
  listTags,
} from "@/lib/between-us/queries";
import { ExperienceGameForm } from "@/components/dashboard/between-us/ExperienceGameForm";
import { ArrowLeft, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import type { ExperienceGameFormValues } from "@/lib/between-us/validations";

export const dynamic = "force-dynamic";

export default async function EditExperienceGamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const [game, categoryIds, tagIds, categories, tags] = await Promise.all([
    getGameById(id),
    getGameCategoryIds(id),
    getGameTagIds(id),
    listCategories(false),
    listTags(false),
  ]);

  if (!game) return notFound();

  const defaultValues: ExperienceGameFormValues = {
    slug: game.slug,
    title_he: game.title_he ?? "",
    title_en: game.title_en ?? "",
    short_desc_he: game.short_desc_he ?? "",
    short_desc_en: game.short_desc_en ?? "",
    full_desc_he: game.full_desc_he ?? "",
    full_desc_en: game.full_desc_en ?? "",
    meta_title_he: game.meta_title_he ?? null,
    meta_title_en: game.meta_title_en ?? null,
    meta_description_he: game.meta_description_he ?? null,
    meta_description_en: game.meta_description_en ?? null,
    benefits_he: game.benefits_he ?? [],
    benefits_en: game.benefits_en ?? [],
    target_audience_he: game.target_audience_he ?? [],
    target_audience_en: game.target_audience_en ?? [],
    // Play-time questions reference (optional per game).
    play_questions_intro_he: game.play_questions_intro_he ?? "",
    play_questions_intro_en: game.play_questions_intro_en ?? "",
    play_questions_he: game.play_questions_he ?? [],
    play_questions_en: game.play_questions_en ?? [],
    cover_image_url: game.cover_image_url ?? null,
    gallery: game.gallery ?? [],
    intimacy_badge_url: game.intimacy_badge_url ?? null,
    communication_badge_url: game.communication_badge_url ?? null,
    heat_badge_url: game.heat_badge_url ?? null,
    intimacy_level: game.intimacy_level ?? 3,
    communication_level: game.communication_level ?? 3,
    heat_level: game.heat_level ?? 3,
    price_ils: game.price_ils != null ? Number(game.price_ils) : null,
    price_usd: game.price_usd != null ? Number(game.price_usd) : null,
    is_new: game.is_new,
    is_popular: game.is_popular,
    is_subscription_eligible: game.is_subscription_eligible,
    is_active: game.is_active,
    sort_weight: game.sort_weight ?? 0,
    opens_at: game.opens_at ?? null,
    alt_text: game.alt_text ?? null,
    category_ids: categoryIds,
    tag_ids: tagIds,
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/dashboard/adults/games"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="size-4" />
            Back to games
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            {game.title_he || game.title_en || "Untitled game"}
          </h1>
          <p className="text-muted-foreground mt-1 font-mono text-xs">
            {game.slug}
          </p>
        </div>
        <Link
          href={`/dashboard/adults/games/${game.id}/content`}
          className={cn(buttonVariants({ variant: "default" }), "inline-flex gap-1.5")}
        >
          <FileText className="size-4" />
          Manage content
        </Link>
      </div>

      <ExperienceGameForm
        gameId={game.id}
        defaultValues={defaultValues}
        allCategories={categories}
        allTags={tags}
      />
    </div>
  );
}
