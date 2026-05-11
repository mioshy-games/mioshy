import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { parseWheelQuestionsWithDetail } from "@/lib/csv-wheel-questions";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert a display name to a URL-safe slug */
function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\u0590-\u05FF]+/g, (h) => h) // keep Hebrew as-is
    .replace(/[^\w\u0590-\u05FF]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || `game-${Date.now()}`;
}

/**
 * Resolve game_id for rows that only supply game_name:
 * 1. Look up by name_he / name_en (case-insensitive).
 * 2. If not found → create game + wheel_configs with default settings.
 * Returns a map of game_name → game_id for all names encountered.
 */
// Accept any object with a `.from()` method - works for both the SSR session
// client (from requireAdmin) and the plain admin client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveOrCreateGames(
  supabase: Pick<Awaited<ReturnType<typeof requireAdmin>>["supabase"], "from">,
  names: string[],
): Promise<Map<string, string>> {
  // Array.from(new Set(...)) instead of [...new Set(...)] because the
  // tsconfig target predates ES2015 iterators on built-ins. Functionally
  // identical - produces the deduped string array - but compiles cleanly
  // without needing `downlevelIteration` on the project.
  const uniqueNames = Array.from(new Set(names.filter(Boolean)));
  const map = new Map<string, string>();

  for (const name of uniqueNames) {
    // Try to find existing game by name (either locale)
    const { data: existing } = await supabase
      .from("games")
      .select("id")
      .or(`name_he.ilike."${name}",name_en.ilike."${name}"`)
      .maybeSingle();

    if (existing?.id) {
      map.set(name, existing.id);
      continue;
    }

    // Create a new game with draft defaults (is_active = false until admin reviews)
    const slug = slugify(name);
    const { data: newGame, error: gameErr } = await supabase
      .from("games")
      .insert({
        name_he: name,
        name_en: name,
        slug,
        is_active: false, // admin needs to activate + review before going live
        description_he: "",
        description_en: "",
      })
      .select("id")
      .single();

    if (gameErr || !newGame) {
      // Slug conflict - try with a timestamp suffix
      const slugTs = `${slug}-${Date.now()}`;
      const { data: retried } = await supabase
        .from("games")
        .insert({
          name_he: name,
          name_en: name,
          slug: slugTs,
          is_active: false,
          description_he: "",
          description_en: "",
        })
        .select("id")
        .single();

      if (!retried) continue; // skip - can't create
      map.set(name, retried.id);

      // Create default wheel_configs
      await supabase.from("wheel_configs").insert({ game_id: retried.id });
      continue;
    }

    map.set(name, newGame.id);

    // Create default wheel_configs (required for the wheel page to load)
    await supabase.from("wheel_configs").insert({ game_id: newGame.id });
  }

  return map;
}

export type ImportSummary = {
  total: number;
  imported: number;
  updated: number;
  failed: number;
  skipped: Array<{ row: number; field: string; message: string }>;
};

export async function POST(request: Request): Promise<Response> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  // Verify caller is admin via session client, then use service-role client
  // for all DB operations - same pattern as saveGame to avoid SSR/RLS flakiness.
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  // ── Parse multipart body ──────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Invalid multipart body" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return Response.json(
      { error: 'Missing "file" field in form data' },
      { status: 400 },
    );
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    return Response.json(
      { error: "Only .csv files are accepted" },
      { status: 400 },
    );
  }

  const text = await file.text();

  // ── Parse + validate CSV ──────────────────────────────────────────────────
  const parsed = parseWheelQuestionsWithDetail(text);

  if (!parsed.ok) {
    return Response.json(
      {
        error: "CSV structure error",
        details: parsed.errors,
      },
      { status: 422 },
    );
  }

  const { rows, skipped } = parsed;

  if (rows.length === 0) {
    const summary: ImportSummary = {
      total: skipped.length,
      imported: 0,
      updated: 0,
      failed: skipped.length,
      skipped,
    };
    return Response.json(summary, { status: 200 });
  }

  // ── Step 1: Resolve game_name → game_id for Format B rows ───────────────
  // Rows with no game_id but a game_name need lookup / auto-create.
  const namesNeedingResolution = rows
    .filter((r) => !r.game_id && r.game_name)
    .map((r) => r.game_name);

  if (namesNeedingResolution.length > 0) {
    const gameIdMap = await resolveOrCreateGames(supabase, namesNeedingResolution);
    for (const r of rows) {
      if (!r.game_id && r.game_name) {
        const resolved = gameIdMap.get(r.game_name);
        if (resolved) {
          r.game_id = resolved;
        } else {
          skipped.push({
            row: 0,
            field: "game_name",
            message: `Could not find or create game "${r.game_name}"`,
          });
        }
      }
    }
  }

  // ── Step 2: Verify that every game_id actually exists in this environment ──
  // A CSV exported from staging/local may contain game UUIDs that don't exist
  // in production. For those rows we fall back to creating the game by name
  // (game_name_he / game_name_en captured by the parser), or skip with a clear
  // error message instead of a cryptic FK constraint violation.
  // Array.from(new Set(...)) instead of [...new Set(...)] - see the
  // earlier resolveOrCreateGames helper in this file for the same pattern.
  // tsconfig target predates ES2015 iterators on built-ins, so spreading
  // a Set fails to compile without `downlevelIteration`. Array.from is
  // a no-cost equivalent that compiles cleanly.
  const uniqueGameIds = Array.from(
    new Set(rows.filter((r) => r.game_id).map((r) => r.game_id)),
  );

  if (uniqueGameIds.length > 0) {
    const { data: existingGames } = await supabase
      .from("games")
      .select("id")
      .in("id", uniqueGameIds);

    const existingIdSet = new Set((existingGames ?? []).map((g) => g.id));
    const orphanedIds = uniqueGameIds.filter((id) => !existingIdSet.has(id));

    if (orphanedIds.length > 0) {
      // Collect names for orphaned rows so we can auto-create the game
      const orphanNameMap = new Map<string, string>(); // game_id → game_name
      for (const r of rows) {
        if (orphanedIds.includes(r.game_id) && r.game_name) {
          orphanNameMap.set(r.game_id, r.game_name);
        }
      }

      // Both the outer Set spread and the inner Map.values() spread fail to
      // compile under this project's tsconfig target. Use Array.from for both.
      const uniqueOrphanNames = Array.from(
        new Set(Array.from(orphanNameMap.values()).filter(Boolean)),
      );
      const resolvedMap =
        uniqueOrphanNames.length > 0
          ? await resolveOrCreateGames(supabase, uniqueOrphanNames)
          : new Map<string, string>();

      for (const orphanId of orphanedIds) {
        const gameName = orphanNameMap.get(orphanId);
        const newId = gameName ? resolvedMap.get(gameName) : undefined;

        for (const r of rows) {
          if (r.game_id !== orphanId) continue;
          if (newId) {
            // Swap the stale UUID for the resolved / newly-created one
            r.game_id = newId;
          } else {
            // No name available - skip with an actionable error
            skipped.push({
              row: 0,
              field: "game_id",
              message: `Game ${orphanId} does not exist in this environment. Add a game_name_he column to auto-create it, or create the game in the dashboard first.`,
            });
            r.game_id = ""; // mark for removal
          }
        }
      }
    }
  }

  // Remove any rows that ended up without a valid game_id
  for (let i = rows.length - 1; i >= 0; i--) {
    if (!rows[i].game_id) rows.splice(i, 1);
  }

  // ── Upsert rows via admin client ──────────────────────────────────────────
  // Split rows into inserts (no question_id) and updates (question_id present)
  const toInsert = rows.filter((r) => !r.question_id);
  const toUpdate = rows.filter((r) => !!r.question_id);

  let importedCount = 0;
  let updatedCount = 0;
  const dbErrors: Array<{ row: string; message: string }> = [];

  // ── Inserts ───────────────────────────────────────────────────────────────
  if (toInsert.length > 0) {
    const insertPayload = toInsert.map((r) => ({
      game_id: r.game_id,
      type: r.type,
      level: r.level,
      category: r.category,
      text_he: r.text_he,
      text_en: r.text_en,
      is_active: r.is_active,
    }));

    const { error } = await supabase
      .from("questions")
      .insert(insertPayload);

    if (error) {
      // Batch failed - try row-by-row to capture partial success
      for (const r of toInsert) {
        const { error: rowErr } = await supabase.from("questions").insert({
          game_id: r.game_id,
          type: r.type,
          level: r.level,
          category: r.category,
          text_he: r.text_he,
          text_en: r.text_en,
          is_active: r.is_active,
        });
        if (rowErr) {
          dbErrors.push({
            row: `INSERT game_id=${r.game_id} text="${r.text_he.slice(0, 30)}"`,
            message: rowErr.message,
          });
        } else {
          importedCount++;
        }
      }
    } else {
      importedCount = toInsert.length;
    }
  }

  // ── Updates ───────────────────────────────────────────────────────────────
  for (const r of toUpdate) {
    const { error } = await supabase
      .from("questions")
      .update({
        game_id: r.game_id,
        type: r.type,
        level: r.level,
        category: r.category,
        text_he: r.text_he,
        text_en: r.text_en,
        is_active: r.is_active,
      })
      .eq("id", r.question_id);

    if (error) {
      dbErrors.push({
        row: `UPDATE id=${r.question_id}`,
        message: error.message,
      });
    } else {
      updatedCount++;
    }
  }

  // ── Revalidate dashboard cache ────────────────────────────────────────────
  if (importedCount > 0 || updatedCount > 0) {
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/questions");
  }

  // ── Build summary ─────────────────────────────────────────────────────────
  const totalAttempted = rows.length + skipped.length;
  const failedCount = skipped.length + dbErrors.length;

  const summary: ImportSummary = {
    total: totalAttempted,
    imported: importedCount,
    updated: updatedCount,
    failed: failedCount,
    skipped: [
      ...skipped,
      ...dbErrors.map((e) => ({
        row: 0,
        field: "db",
        message: `${e.row}: ${e.message}`,
      })),
    ],
  };

  return Response.json(summary, { status: 200 });
}
