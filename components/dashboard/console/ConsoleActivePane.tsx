import Link from "next/link";
import { ExternalLink, BookOpen, User } from "lucide-react";
import type { ConsoleActive } from "@/lib/journey/console-active";
import { GeneralChannelAdminReply } from "@/components/dashboard/journey/GeneralChannelAdminReply";
import { ClientResponsesInbox } from "@/components/dashboard/journey/ClientResponsesInbox";
import { AdHocItemCreator } from "@/components/dashboard/coach/AdHocItemCreator";
import { AssignContentForm } from "@/app/dashboard/my-clients/[coupleId]/assign-form";

/**
 * Right pane: the active conversation. Pure composition of the EXISTING
 * reply surfaces — the general channel (with composer + auto-scroll) and the
 * per-item responses inbox (with reply + triage) — plus quick links and the
 * couple-scoped content-add tools. No new messaging logic.
 */
export function ConsoleActivePane({ active }: { active: ConsoleActive }) {
  return (
    <div dir="rtl" className="flex h-full flex-col">
      {/* Header — title + quick links to profile and content library. */}
      <header className="shrink-0 border-b border-white/10 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-white">
              {active.title}
            </h2>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-white/45">
              {active.pairCode ? (
                <span className="font-mono">{active.pairCode}</span>
              ) : null}
              {active.kind === "solo" ? <span>משתמש ללא זוג</span> : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {active.kind === "couple" ? (
              <Link
                href={`/dashboard/my-clients/${active.coupleId}`}
                className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-white/75 transition hover:bg-white/[0.06]"
              >
                <User className="h-3.5 w-3.5" />
                פרופיל לקוח
                <ExternalLink className="h-3 w-3 opacity-60" />
              </Link>
            ) : null}
            <Link
              href="/dashboard/journey/items"
              className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-white/75 transition hover:bg-white/[0.06]"
            >
              <BookOpen className="h-3.5 w-3.5" />
              ספריית תוכן
              <ExternalLink className="h-3 w-3 opacity-60" />
            </Link>
          </div>
        </div>
      </header>

      {/* Scrollable body — reused reply surfaces stacked. */}
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-white/45">
            ערוץ כללי
          </h3>
          <GeneralChannelAdminReply partners={active.partners} />
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-white/45">
            תגובות על פריטים
          </h3>
          <ClientResponsesInbox
            isHe
            rows={active.responseRows}
            partners={active.partnerLabels}
            coupleId={active.coupleId ?? ""}
          />
        </section>

        {/* Content-add is couple-scoped (journey_assignments.couple_id), so it
            only renders for couple conversations. */}
        {active.kind === "couple" &&
        active.sources &&
        active.categories ? (
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-white/45">
              הוסף תוכן
            </h3>
            <AssignContentForm
              coupleId={active.coupleId!}
              sources={active.sources}
            />
            <AdHocItemCreator
              coupleId={active.coupleId!}
              partnerALabel={active.partnerALabel}
              partnerBLabel={active.partnerBLabel}
              hasPartnerB={active.hasPartnerB}
              categories={active.categories}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}
