"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth/admin";
import { normalizeRichText } from "./render";
import { sanitizeRichText } from "./sanitize";

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
  // OUTER try/catch — Itzik reported a 500 on Save with multi-<em>
  // input that no local test could reproduce. Some Vercel-runtime-
  // specific failure path (probably isomorphic-dompurify's JSDOM
  // bootstrap on cold start, but not yet confirmed) was reaching the
  // serverless runtime as an uncaught exception, surfacing to the
  // client as HTTP 500 with no JSON body. Wrapping the whole action
  // guarantees the client gets a structured { ok:false, error:... }
  // every time and the real stack lands in Vercel runtime logs where
  // we can debug it.
  try {
    // Diagnostic — verify what the server actually receives. Lets us
    // tell apart client-side (state stale) vs server-side (sanitize,
    // normalize, supabase) issues when a save lands wrong.
    // eslint-disable-next-line no-console
    console.log("[cms-save] raw input:", JSON.stringify(input));

    const parsed = SaveInput.safeParse(input);
    if (!parsed.success) {
      // eslint-disable-next-line no-console
      console.warn("[cms-save] validation failed:", parsed.error.format());
      return { ok: false, error: "Invalid input shape." };
    }

    const session = await getAdminSession();
    if (!session) {
      return { ok: false, error: "Not authorized." };
    }
    const { supabase, user } = session;

    // ── Sanitize (isolated try/catch) ──────────────────────────────
    // The CMS toolbar emits only <em> / <strong> wrappers, but the
    // textarea is a free-text field — an admin (or a paste of HTML
    // from outside) could carry tags we don't want in the DB. Reject
    // the save BEFORE writing if anything outside <em>/<strong>/<br>
    // shows up. DOMPurify is the second-pass scrubber even for the
    // allowed tags (strips attributes like style/onclick).
    //
    // The inner try/catch is so a DOMPurify/JSDOM throw doesn't
    // crash the whole action — admin sees a clean error toast saying
    // "couldn't sanitise this value, please simplify the markup".
    let heChecked, enChecked;
    try {
      heChecked = sanitizeRichText(parsed.data.he);
      enChecked = sanitizeRichText(parsed.data.en);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[cms-save] sanitize threw:", err);
      return {
        ok: false,
        error:
          "Couldn't sanitise the text. Try simplifying the markup (use only <em>, <strong>, <br>) and save again. " +
          (err instanceof Error ? err.message : String(err)),
      };
    }

    if (!heChecked.ok || !enChecked.ok) {
      const parts: string[] = [];
      if (!heChecked.ok) {
        parts.push(
          `Hebrew contains disallowed tags: <${heChecked.disallowed.join(">, <")}>`,
        );
      }
      if (!enChecked.ok) {
        parts.push(
          `English contains disallowed tags: <${enChecked.disallowed.join(">, <")}>`,
        );
      }
      return {
        ok: false,
        error:
          parts.join(". ") +
          ". Only <em>, <strong>, and <br> are permitted in CMS text.",
      };
    }

    // Then normalize so the DB never re-introduces `<br></br>`. We
    // DON'T trim — admins may intentionally include leading/trailing
    // whitespace for layout reasons. Empty string is fine; the
    // public-site read path falls back to JSON when text is empty.
    const heNormalized = normalizeRichText(heChecked.html);
    const enNormalized = normalizeRichText(enChecked.html);

    // eslint-disable-next-line no-console
    console.log("[cms-save] writing", {
      key: parsed.data.key,
      he_len: heNormalized.length,
      en_len: enNormalized.length,
      he_preview: heNormalized.slice(0, 60),
      en_preview: enNormalized.slice(0, 60),
      updated_by: user.id,
    });

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
      // eslint-disable-next-line no-console
      console.warn("[cms-save] supabase update failed:", error.message);
      return { ok: false, error: error.message };
    }

    // ── Cache invalidation — belt-and-suspenders ──────────────────
    // Tag for unstable_cache wraps, path for the route-level caches.
    // Both call paths cover each other in case one silently misses.
    revalidateTag("cms-texts");
    revalidatePath("/he", "layout");
    revalidatePath("/en", "layout");

    // eslint-disable-next-line no-console
    console.log("[cms-save] revalidation fired:", {
      tag: "cms-texts",
      paths: ["/he (layout)", "/en (layout)"],
    });

    return { ok: true };
  } catch (err) {
    // Last-resort net — anything that escapes the inner blocks above
    // becomes a structured error response instead of an HTTP 500.
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    // eslint-disable-next-line no-console
    console.error("[cms-save] UNCAUGHT in saveCmsText:", message, stack);
    return {
      ok: false,
      error:
        "Server error during save: " +
        message +
        ". Check Vercel runtime logs for the full stack.",
    };
  }
}
