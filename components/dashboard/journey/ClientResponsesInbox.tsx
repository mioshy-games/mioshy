/**
 * ClientResponsesInbox — interactive list of recent journey responses
 * for ONE couple (= ≤2 partners). Phase 2C + 2D of the redesign.
 *
 * What it shows:
 *   - Newest first
 *   - Per row: who replied (partner), item title, category, the
 *     response text (collapsible if long), date, status pill when
 *     triaged, and the clinician's prior reply if any
 *   - "פרטי" tag when the user marked the response as private
 *   - Reply form (Phase 2D) + triage buttons (open/resolved/concerning)
 *
 * Tone (per spec §1.5): calm, no exclamations, no emoji.
 */

import type { ClinicianResponseRow as ResponseRow } from "@/lib/journey-content/clinician-responses";
import { ClinicianResponseRow } from "./ClinicianResponseRow";

export function ClientResponsesInbox({
  isHe,
  rows,
  partners,
  coupleId,
}: {
  isHe: boolean;
  rows: ResponseRow[];
  /** Map user_id → partner display label (e.g. "פרטנר א" or the
   *  partner's first name). Falls back to a truncated user_id when
   *  no label is provided. */
  partners: Map<string, string>;
  /** Couple id — used for path revalidation after server actions. */
  coupleId: string;
}) {
  return (
    <section
      className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
      aria-label={isHe ? "תגובות הלקוחות" : "Client responses"}
    >
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">
            {isHe ? "תגובות מהלקוחות" : "Client responses"}
          </h2>
          <p className="mt-1 text-xs text-white/55">
            {isHe
              ? "תגובות אישיות שהלקוחות שלכם השאירו על פריטי המסע. סדר חדש-לישן."
              : "Personal responses your clients left on journey items. Newest first."}
          </p>
        </div>
        <span className="text-[11px] uppercase tracking-wider text-white/40">
          {rows.length} {isHe ? "תגובות" : "responses"}
        </span>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-white/10 bg-white/[0.015] p-4 text-center text-sm text-white/55">
          {isHe
            ? "עדיין אין תגובות. ברגע שלקוח יגיב על פריט במסע, התגובה תופיע כאן."
            : "No responses yet. Once a client comments on a journey item, it shows up here."}
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {rows.map((row) => {
            const partnerLabel =
              partners.get(row.userId) ??
              (row.userEmail ?? row.userId.slice(0, 8));
            return (
              <li key={row.id}>
                <ClinicianResponseRow
                  row={row}
                  isHe={isHe}
                  partnerLabel={partnerLabel}
                  coupleId={coupleId}
                />
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
