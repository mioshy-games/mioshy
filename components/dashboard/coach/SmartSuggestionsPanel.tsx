/**
 * SmartSuggestionsPanel
 *
 * Phase 4 — coach-side recommendation widget. Shown on the per-couple
 * workspace (/dashboard/my-clients/[coupleId]). Pulls 3 next-best
 * items the coach should consider pushing for this couple, with a
 * short rationale per pick.
 *
 * Server component — calls getCoachSuggestionsForCouple at render.
 * No interactivity beyond plain links to the item editor + the
 * existing assignment form (the coach picks → uses AssignContentForm
 * to actually push).
 */

import Link from "next/link";
import { Sparkles, ExternalLink } from "lucide-react";
import { getCoachSuggestionsForCouple } from "@/lib/journey/coach-suggestions";
import { Badge } from "@/components/ui/badge";

export async function SmartSuggestionsPanel({
  coupleId,
}: {
  coupleId: string;
}) {
  const suggestions = await getCoachSuggestionsForCouple(coupleId, 3);

  return (
    <section className="border-border bg-card rounded-lg border" dir="rtl">
      <header className="flex items-center justify-between border-b border-border p-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-amber-500" />
          <h2 className="text-sm font-semibold">המלצות חכמות</h2>
        </div>
        <span className="text-muted-foreground text-[11px]">
          לפי עדיפויות + שלב + פידבק
        </span>
      </header>
      {suggestions.length === 0 ? (
        <div className="text-muted-foreground p-4 text-center text-xs">
          אין מספיק נתונים לעדיין — עדיין אין השלמות של הזוג, או שכל
          הקטלוג כבר משוייך.
        </div>
      ) : (
        <ul className="divide-border divide-y">
          {suggestions.map((s) => (
            <li key={s.itemId} className="space-y-1.5 p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{s.title_he}</span>
                {s.stage ? (
                  <Badge variant="outline" className="text-[10px]">
                    שלב {s.stage}
                  </Badge>
                ) : null}
                <Badge variant="secondary" className="text-[10px]">
                  ציון {s.score}
                </Badge>
                <Link
                  href={s.itemHref}
                  className="text-primary inline-flex items-center gap-1 text-[11px] hover:underline ms-auto"
                >
                  <ExternalLink className="size-3" />
                  פתח פריט
                </Link>
              </div>
              <p className="text-muted-foreground text-[11px]">
                {s.rationale}
              </p>
            </li>
          ))}
        </ul>
      )}
      <footer className="border-t border-border p-2">
        <p className="text-muted-foreground text-center text-[10px]">
          לדחוף לזוג: בחרו פריט מהרשימה ולחצו &quot;פתח פריט&quot; →
          העתיקו את ה-ID לטופס ההצמדה למטה.
        </p>
      </footer>
    </section>
  );
}
