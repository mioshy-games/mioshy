"use client";

/**
 * StarterTemplatesSection
 * ─────────────────────────────────────────────────────────
 * Layer-3 follow-up — surfaces the curated starter templates from
 * journey_starter_templates inside /dashboard/coach-library.
 *
 * One-click "Save to my library" creates an editable copy in the
 * coach's personal library. The coach can then edit the copy
 * without affecting the curated source.
 */

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { BookmarkPlus, Loader2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cloneStarterTemplateToLibrary } from "@/app/dashboard/actions/coach-library-clone";
import type { StarterTemplate } from "@/lib/journey-content/starter-templates";

const KIND_LABEL: Record<StarterTemplate["kind"], string> = {
  saved_reply:    "Saved reply",
  content_pin:    "Content pin",
  couple_note:    "Couple note",
  couple_message: "Couple message",
  drift_checkin:  "Drift check-in",
};

export function StarterTemplatesSection({
  templates,
}: {
  templates: StarterTemplate[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);

  if (templates.length === 0) return null;

  const onSave = (id: string) => {
    setSavingId(id);
    startTransition(async () => {
      const res = await cloneStarterTemplateToLibrary({ templateId: id });
      setSavingId(null);
      if (!res.ok) {
        toast.error(`Save failed: ${res.error}`);
        return;
      }
      toast.success("Added to your library");
      router.refresh();
    });
  };

  return (
    <section className="space-y-3 rounded-md border bg-card p-4">
      <header className="space-y-1">
        <h2 className="text-sm font-semibold">Starter templates</h2>
        <p className="text-muted-foreground text-xs">
          Curated starting points. Save any to your library — the
          saved copy is yours to edit. Originals stay untouched.
        </p>
      </header>

      <ul className="divide-y">
        {templates.map((tpl) => (
          <li key={tpl.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px]">
                    {KIND_LABEL[tpl.kind]}
                  </Badge>
                  <h3 className="font-medium">{tpl.label_he}</h3>
                </div>
                {tpl.tags.length > 0 ? (
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-white/55">
                    <Tag className="size-3" />
                    {tpl.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending && savingId === tpl.id}
                onClick={() => onSave(tpl.id)}
                className="gap-1.5"
              >
                {pending && savingId === tpl.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <BookmarkPlus className="size-3.5" />
                )}
                Save copy
              </Button>
            </div>
            <p
              className="line-clamp-2 whitespace-pre-wrap text-sm text-white/75"
              dir="rtl"
            >
              {tpl.body_he}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
