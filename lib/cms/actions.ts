"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth/admin";
import { normalizeRichText } from "./render";

/**
 * Server actions for the internal CMS.
 *
 * Auth model — every action calls `getAdminSession()` first. This is
 * the same `profiles.role = 'admin'` check that `requireAdmin()` uses,
 * but here we return a structured error instead of redirecting. The
 * action runs under the admin's Supabase session, so RLS policies on
 * `cms_texts` enforce the admin check at the DB layer too (defense in
 * depth — even if this `getAdminSession()` were bypassed somehow, the
 * RLS WITH CHECK clause on cms_texts_update_admin would block the
 * UPDATE).
 *
 * Sanitization — we run `normalizeRichText` on both languages before
 * write. That collapses `<br></br>` to `<br />` so what lands in the
 * DB is always the rendering-safe shape, not the legacy ICU shape
 * carried over from the seed. Sprint 5 will add full DOMPurify-style
 * allow-list sanitisation for `<em>` / `<strong>` / `<br>` only.
 */

// ──────────────────────────────────────────────────────────────────
// saveCmsText — overwrite he_text + en_text on an existing row by key.
//
// Returns a discriminated union so the client can render success/error
// without throwing. Tagged "use server" so it ships as a server action
// and the bundler doesn't try to include it client-side.
// ──────────────────────────────────────────────────────────────────

const SaveInput = z.object({
  key: z.string().min(1).max(200),
  he: z.string(),
  en: z.string(),
});

export type SaveResult =
  | { ok: true }
  | { ok: false; error: string };

export async function saveCmsText(input: unknown): Promise<SaveResult> {
  const parsed = SaveInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input shape." };
  }

  const session = await getAdminSession();
  if (!session) {
    return { ok: false, error: "Not authorized." };
  }
  const { supabase, user } = session;

  // Normalize before write so the DB never re-introduces `<br></br>`.
  // We DON'T trim — admins may intentionally include leading/trailing
  // whitespace for layout reasons. Empty string is fine; the public-
  // site read path falls back to JSON when text is empty.
  const heNormalized = normalizeRichText(parsed.data.he);
  const enNormalized = normalizeRichText(parsed.data.en);

  const { error } = await supabase
    .from("cms_texts")
    .update({
      he_text: heNormalized,
      en_text: enNormalized,
      updated_by: user.id,
      // Edit clears the cross-language drift flag — admin took
      // ownership of both languages with this save. Sprint 5 may
      // expose this flag as a UI toggle.
      needs_review: false,
    })
    .eq("key", parsed.data.key);

  if (error) {
    return { ok: false, error: error.message };
  }

  // Invalidate every page's cached CMS rows. The public site's
  // `loadCmsTextsForPage` is wrapped in unstable_cache with the
  // "cms-texts" tag — this call clears those entries so the next
  // request fetches the new value.
  revalidateTag("cms-texts");

  return { ok: true };
}
