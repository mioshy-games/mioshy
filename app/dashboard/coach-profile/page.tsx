/**
 * /dashboard/coach-profile
 *
 * Layer-2 coach self-edit. The expert edits their own persona —
 * the data clients see across the product (replies, first-session
 * intro, bio reveal).
 *
 * Available to expert + admin roles. Admin layout already enforces
 * the gate; this page just resolves the current user's row and
 * passes it to the form.
 */

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireExpert } from "@/lib/auth/expert";
import { CoachProfileForm } from "@/components/dashboard/coach/CoachProfileForm";
import { getAdminLocale } from "@/lib/admin/locale";
import { t } from "@/lib/admin/i18n";

export const dynamic = "force-dynamic";

export default async function CoachProfilePage() {
  const session = await requireExpert();
  const locale = getAdminLocale();

  // Pull the existing persona to pre-fill the form.
  const { data: row } = await session.supabase
    .from("profiles")
    .select(
      "coach_display_name_he, coach_display_name_en, coach_avatar_url, coach_short_bio_he, coach_short_bio_en",
    )
    .eq("id", session.user.id)
    .maybeSingle();

  const persona = (row as {
    coach_display_name_he: string | null;
    coach_display_name_en: string | null;
    coach_avatar_url:      string | null;
    coach_short_bio_he:    string | null;
    coach_short_bio_en:    string | null;
  } | null) ?? null;

  const personaSet = !!persona?.coach_display_name_he;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/dashboard/my-clients"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4 rtl:scale-x-[-1]" />
          {t(locale, "btn.back")}
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          {t(locale, "page.coach_profile.title")}
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          {t(locale, "page.coach_profile.subtitle")}
        </p>
        {!personaSet ? (
          <div className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Your persona isn&apos;t set yet. Until you save a Hebrew display
            name, clients see the generic &ldquo;your coach&rdquo; label
            on your replies.
          </div>
        ) : null}
      </div>

      <CoachProfileForm
        defaults={{
          display_name_he: persona?.coach_display_name_he ?? "",
          display_name_en: persona?.coach_display_name_en ?? "",
          avatar_url:      persona?.coach_avatar_url      ?? "",
          short_bio_he:    persona?.coach_short_bio_he    ?? "",
          short_bio_en:    persona?.coach_short_bio_en    ?? "",
        }}
      />
    </div>
  );
}
