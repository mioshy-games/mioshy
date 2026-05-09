/**
 * /dashboard/coach-library
 *
 * Layer-2 personal library for the logged-in coach.
 * Three tabs in one list: saved_reply / content_pin / couple_note.
 */

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireExpert } from "@/lib/auth/expert";
import { listCoachLibrary } from "@/lib/journey-content/coach-library";
import { listStarterTemplates } from "@/lib/journey-content/starter-templates";
import { CoachLibraryClient } from "@/components/dashboard/coach/CoachLibraryClient";
import { StarterTemplatesSection } from "@/components/dashboard/coach/StarterTemplatesSection";

export const dynamic = "force-dynamic";

export default async function CoachLibraryPage() {
  await requireExpert();
  const [entries, starterTemplates] = await Promise.all([
    listCoachLibrary(),
    listStarterTemplates(),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href="/dashboard/my-clients"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" />
          Back to my couples
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">My library</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          Saved replies, content pins, and per-couple notes. Replies you
          save here can be inserted into the compose box on any per-item
          thread with one tap.
        </p>
      </div>

      <StarterTemplatesSection templates={starterTemplates} />

      <CoachLibraryClient initialEntries={entries} />
    </div>
  );
}
