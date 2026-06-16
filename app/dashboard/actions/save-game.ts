"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { gameFormSchema, type GameFormValues } from "@/lib/validations";

export async function saveGame(gameId: string | null, raw: unknown) {
  const tStart = Date.now();
  // Log the raw shape first so we can see if e.g. required fields were
  // dropped on the wire before zod even runs. Limit the preview to a few
  // characters to avoid flooding the server logs.
  console.log(
    "[saveGame] ▶ invoked",
    JSON.stringify({
      gameId,
      rawType: typeof raw,
      rawHasName:
        typeof raw === "object" && raw !== null
          ? {
              name_he: (raw as Record<string, unknown>).name_he,
              name_en: (raw as Record<string, unknown>).name_en,
              slug: (raw as Record<string, unknown>).slug,
            }
          : null,
    }),
  );

  const parsed = gameFormSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(
      "[saveGame] ✗ zod validation failed:",
      JSON.stringify(parsed.error.flatten().fieldErrors),
    );
    return {
      ok: false as const,
      error: parsed.error.flatten().fieldErrors,
    };
  }
  const v = parsed.data as GameFormValues;
  // Auth check via session client (proves caller is an admin),
  // but all DB writes go through the service-role admin client.
  // The SSR session-client JWT→PostgREST handshake is flaky under @supabase/ssr
  // and silently drops writes - always use the admin client for mutations.
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  // Derive category_colors from the actual slices so it always stays in sync.
  // The SliceEditor already generates slices from categories in the UI when the
  // admin clicks "Recompute slices" - we must NOT rebuild here or direct slice
  // edits (per-slice label/color/type changes) would be silently overwritten.
  const derivedCategoryColors: Record<string, string> = {};
  for (const s of v.wheel.slices) {
    const key = s.question_type.trim();
    if (key && !derivedCategoryColors[key]) {
      derivedCategoryColors[key] = s.color;
    }
  }
  // Merge: keep any extra keys from the stored category_colors (e.g. categories
  // whose slices were removed but color was pinned), while derived values win
  // for keys that are present in the current slices.
  const category_colors = {
    ...v.wheel.category_colors,
    ...derivedCategoryColors,
  };

  // Parse the comma-separated keyword string into a clean text[] for Postgres.
  const keywords =
    (v.keywords_csv ?? "")
      .split(/[,\n]/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0 && k.length < 60) // sanity: drop unreasonably long tags
      .slice(0, 25); // cap so the row stays small

  // ── Build per-game instructions jsonb (migration 108) ───────────────────
  // The editor edits steps as one-per-line text; split into a clean string[].
  // If every part is empty we store NULL so the game falls back to the generic
  // global tutorial rather than rendering an empty popup.
  const instrTitle = (v.instructions?.title ?? "").trim();
  const instrIntro = (v.instructions?.intro ?? "").trim();
  const instrFooter = (v.instructions?.footer ?? "").trim();
  const instrSteps = (v.instructions?.steps_text ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const heInstructions: Record<string, unknown> = {};
  if (instrTitle) heInstructions.title = instrTitle;
  if (instrIntro) heInstructions.intro = instrIntro;
  if (instrSteps.length) heInstructions.steps = instrSteps;
  if (instrFooter) heInstructions.footer = instrFooter;
  const instructions =
    Object.keys(heInstructions).length > 0 ? { he: heInstructions } : null;

  const gamePayload = {
    name_he: v.name_he,
    name_en: v.name_en,
    description_he: v.description_he,
    description_en: v.description_en,
    slug: v.slug,
    thumbnail_url_he: (v.thumbnail_url_he ?? "").trim() || null,
    thumbnail_url_en: (v.thumbnail_url_en ?? "").trim() || null,
    is_active: v.is_active ?? true,
    bg_type: v.bg_type,
    bg_value: v.bg_value,
    player_mode: v.player_mode,
    // SEO overrides - null-out empty strings so Postgres stores NULL (→ fallback)
    meta_title_he: (v.meta_title_he ?? "").trim() || null,
    meta_title_en: (v.meta_title_en ?? "").trim() || null,
    meta_description_he: (v.meta_description_he ?? "").trim() || null,
    meta_description_en: (v.meta_description_en ?? "").trim() || null,
    og_image_url: (v.og_image_url ?? "").trim() || null,
    keywords,
    sort_order: Number.isFinite(v.sort_order) ? Number(v.sort_order) : 0,
    // D — scheduled open time (null = immediate). Stored verbatim (ISO).
    opens_at: v.opens_at ?? null,
    instructions,
  };

  const wheelPayload = {
    slices: v.wheel.slices,
    pointer_color: v.wheel.pointer_color,
    inner_circle: v.wheel.inner_circle,
    inner_circle_color: v.wheel.inner_circle_color,
    inner_circle_border_color: v.wheel.inner_circle_border_color,
    border_color: v.wheel.border_color,
    divider_color: v.wheel.divider_color,
    divider_enabled: v.wheel.divider_enabled,
    divider_width: v.wheel.divider_width,
    marker_config: v.wheel.marker_config,
    category_colors,
    player_config: v.wheel.player_config,
  };

  console.log(
    "[saveGame]   parsed payload",
    JSON.stringify({
      gameId,
      name_he: gamePayload.name_he,
      name_en: gamePayload.name_en,
      slug: gamePayload.slug,
      slices: wheelPayload.slices.length,
      categories: v.wheel.player_config.categories?.length ?? 0,
    }),
  );

  if (gameId) {
    // ── Update games row ───────────────────────────────────────────────────────
    // Using .select() so we get the row back - if data is empty, 0 rows were
    // matched (wrong id / row deleted) and the "success" would be a silent no-op.
    const { data: updatedGames, error: ge } = await supabase
      .from("games")
      .update(gamePayload)
      .eq("id", gameId)
      .select("id, name_he, name_en, slug");

    if (ge) {
      console.error("[saveGame] ✗ games.update error:", ge.message, ge.details ?? "");
      return { ok: false as const, error: `games.update: ${ge.message}` };
    }

    if (!updatedGames || updatedGames.length === 0) {
      // 0 rows matched - gameId not in DB or RLS blocked the write
      const msg = `Game ${gameId} not found - 0 rows updated. Verify the ID exists in the games table.`;
      console.error("[saveGame] ✗", msg);
      return { ok: false as const, error: msg };
    }

    console.log("[saveGame] ✓ games.update confirmed:", JSON.stringify(updatedGames[0]));

    // Immediately re-read the row to confirm the new name really landed in
    // Postgres (not just in a PostgREST echo). If the re-read disagrees with
    // what we sent, something is undoing our write (trigger, RLS, cache) and
    // we want to fail loudly instead of reporting success.
    const { data: verify, error: verr } = await supabase
      .from("games")
      .select("id, name_he, name_en, slug, updated_at")
      .eq("id", gameId)
      .maybeSingle();
    if (verr) {
      console.error("[saveGame] ✗ post-write verify read failed:", verr.message);
    } else {
      console.log("[saveGame] ✓ post-write verify:", JSON.stringify(verify));
      if (verify && (verify.name_he !== gamePayload.name_he || verify.name_en !== gamePayload.name_en)) {
        console.error(
          "[saveGame] ✗ DB value does not match payload - something is reverting the write",
          { payload: { he: gamePayload.name_he, en: gamePayload.name_en }, db: verify },
        );
        return {
          ok: false as const,
          error: `DB rejected name change: wrote "${gamePayload.name_en}" but read back "${verify.name_en}". Check triggers / RLS.`,
        };
      }
    }

    // ── Upsert wheel_configs ───────────────────────────────────────────────────
    const { error: we } = await supabase.from("wheel_configs").upsert(
      { game_id: gameId, ...wheelPayload },
      { onConflict: "game_id" },
    );
    if (we) {
      console.error("[saveGame] ✗ wheel_configs.upsert error:", we.message);
      return { ok: false as const, error: `wheel_configs: ${we.message}` };
    }

    console.log(
      "[saveGame] ✓ wheel_configs upserted for game",
      gameId,
      "| total elapsed:",
      Date.now() - tStart,
      "ms",
    );

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/games/${gameId}/edit`);
    return {
      ok: true as const,
      id: gameId,
      savedName: updatedGames[0]?.name_en ?? null,
      savedSlug: updatedGames[0]?.slug ?? null,
    };
  }

  // ── INSERT new game ────────────────────────────────────────────────────────
  const { data: inserted, error: ie } = await supabase
    .from("games")
    .insert(gamePayload)
    .select("id, name_en, slug")
    .single();

  if (ie || !inserted) {
    console.error("[saveGame] ✗ games.insert error:", ie?.message);
    return { ok: false as const, error: ie?.message ?? "Insert failed" };
  }

  console.log("[saveGame] ✓ games.insert:", JSON.stringify(inserted));

  const { error: we } = await supabase.from("wheel_configs").insert({
    game_id: inserted.id,
    ...wheelPayload,
  });
  if (we) {
    console.error("[saveGame] ✗ wheel_configs.insert error:", we.message);
    return { ok: false as const, error: we.message };
  }

  console.log("[saveGame] ✓ wheel_configs inserted for game", inserted.id);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/games");
  return { ok: true as const, id: inserted.id };
}
