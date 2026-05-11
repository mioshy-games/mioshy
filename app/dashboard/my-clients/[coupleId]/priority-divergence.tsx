import { Activity } from "lucide-react";
import { getPartnerDetailsForCouple } from "@/lib/experts/partner-detail";
import { divergence, type PriorityKey } from "@/lib/journey/priorities";
import { getPriorityLabels } from "@/lib/journey-content/priority-categories";

/**
 * Joint priority view - both partners' rankings side by side, plus a
 * per-category gap badge so the expert can read the divergence pattern
 * in <5 seconds. Lives below the per-partner split on the couple
 * detail page.
 *
 * Color rules (matches the spec we agreed on):
 *   diff = 0  → green   ("aligned")
 *   diff = 1–2 → amber  ("small/moderate gap")
 *   diff ≥ 3   → red    ("large gap" - the actionable insight)
 *
 * The headline summary at the top surfaces the single biggest gap
 * automatically: "גילוי מרכזי - שניכם לא מסכימים על מקום של מיניות".
 */
export async function PriorityDivergence({ coupleId }: { coupleId: string }) {
  const [partners, priorityLabels] = await Promise.all([
    getPartnerDetailsForCouple(coupleId).catch(() => []),
    getPriorityLabels(),
  ]);
  const labelsHe = priorityLabels.labelsHe;
  const canonicalOrder = priorityLabels.canonicalOrder;

  // Need both partners ranked to render the joint view. If only one ranked
  // (or none), short-circuit with a friendly empty state - the per-partner
  // split panel above already shows whatever individual data we have.
  const ranked = partners.filter((p) => p.priorityRanking);
  if (ranked.length < 2) {
    return (
      <div className="border-border bg-muted/30 text-muted-foreground rounded-lg border p-4 text-sm">
        {ranked.length === 0
          ? "אף בן/בת זוג לא דירג/ה עדיין את התחומים."
          : "מחכים לדירוג של בן/בת הזוג השני/ה."}
      </div>
    );
  }

  // Stable left/right: owner=A on the left, partner=B on the right. This
  // matches the per-partner split column order above so the eye doesn't
  // have to retrain between sections.
  const a = ranked.find((p) => p.coupleRole === "owner") ?? ranked[0];
  const b = ranked.find((p) => p.coupleRole === "partner") ?? ranked[1];

  if (!a.priorityRanking || !b.priorityRanking) return null; // type narrow

  const rows = divergence(a.priorityRanking, b.priorityRanking, canonicalOrder);

  // Largest gap drives the headline. divergence() is already sorted by
  // diff DESC, so rows[0] is the biggest. We surface it only when the gap
  // is "actionable" (≥3); otherwise the alignment is good enough that a
  // call-out would be noise.
  const headline = rows[0].diff >= 3 ? rows[0] : null;

  return (
    <div className="space-y-3">
      {headline ? (
        <div className="border-rose-500/30 bg-rose-500/5 text-rose-200 rounded-lg border p-3 text-sm">
          <span className="font-semibold">גילוי מרכזי:</span>{" "}
          שני הצדדים לא מסכימים על מקומו של{" "}
          <em className="not-italic font-semibold">
            {labelsHe[headline.key]}
          </em>
          {" "}
          (פער של {headline.diff} מקומות).
        </div>
      ) : null}

      <div className="border-border overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-[11px] uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2 text-start font-semibold">תחום</th>
              <th className="px-3 py-2 text-center font-semibold">
                {labelFor(a)}
              </th>
              <th className="px-3 py-2 text-center font-semibold">
                {labelFor(b)}
              </th>
              <th className="px-3 py-2 text-center font-semibold">פער</th>
            </tr>
          </thead>
          <tbody>
            {rows
              // Render in canonical (DB sort_order) order rather than
              // divergence order - easier to skim. The headline up top
              // already emphasizes the biggest gap.
              .slice()
              .sort(
                (x, y) =>
                  canonicalOrder.indexOf(x.key) - canonicalOrder.indexOf(y.key),
              )
              .map((row) => (
                <tr key={row.key} className="border-border border-t">
                  <td className="px-3 py-2 font-medium">
                    {labelsHe[row.key]}
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums">
                    {row.aPos}
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums">
                    {row.bPos}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <GapBadge diff={row.diff} />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function labelFor(p: {
  coupleRole: "owner" | "partner";
  fullName: string | null;
  email: string | null;
}): string {
  return p.fullName || p.email || (p.coupleRole === "owner" ? "Partner A" : "Partner B");
}

function GapBadge({ diff }: { diff: number }) {
  // 0 → green; 1–2 → amber; ≥3 → red. Hebrew label kept short (1 word).
  let cls = "";
  let label = "";
  if (diff === 0) {
    cls = "bg-emerald-500/15 text-emerald-200 border-emerald-500/30";
    label = "תואם";
  } else if (diff <= 2) {
    cls = "bg-amber-500/15 text-amber-200 border-amber-500/30";
    label = `פער ${diff}`;
  } else {
    cls = "bg-rose-500/15 text-rose-200 border-rose-500/30";
    label = `פער ${diff}`;
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}
    >
      <Activity className="size-3" />
      {label}
    </span>
  );
}

// Re-export PriorityKey so callers don't need to bounce through the lib path.
export type { PriorityKey };
