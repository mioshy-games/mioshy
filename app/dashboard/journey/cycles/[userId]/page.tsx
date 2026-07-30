import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Circle, Shuffle } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin";
import { getUserCycleView } from "@/lib/journey-content/cycle-admin";
import {
  CycleInterventions,
  ResetCompletionButton,
} from "@/components/dashboard/journey/CycleInterventions";

export const dynamic = "force-dynamic";

/**
 * /dashboard/journey/cycles/[userId] — "what the user sees now" (§5 + Itzik
 * 2026-07-31).
 *
 * These rows are read straight from journey_cycle_items — the exact rows the
 * user's own screen renders. Nothing here is recomputed or approximated, so
 * the admin and the user can never disagree.
 */
export default async function UserCyclePage({ params }: { params: { userId: string } }) {
  await requireAdmin();

  const view = await getUserCycleView(params.userId);
  if (!view) notFound();

  const isOpen = Boolean(view.cycleId) && !view.closedAt;
  const nextOpensText = view.closedAt
    ? "המחזור נסגר — הבא ייפתח בפתיחה הבאה"
    : view.plannedNextOpenAt
      ? new Date(view.plannedNextOpenAt).toLocaleDateString("he-IL")
      : "—";

  return (
    <div dir="rtl" className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/dashboard/journey/cycles"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4 rotate-180" />
        חזרה למחזורים
      </Link>

      <h1 className="mt-4 text-2xl font-bold tracking-tight">
        {view.email ?? view.userId.slice(0, 8)}
      </h1>

      {/* ── State strip ──────────────────────────────────────────────────── */}
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Stat label="מחזור" value={view.cycleNumber ? `${view.cycleNumber}` : "—"} />
        <Stat label="התקדמות" value={`${view.completedCount}/${view.totalCount}`} />
        <Stat label="נפתח" value={view.openedAt ? new Date(view.openedAt).toLocaleDateString("he-IL") : "—"} />
        <Stat label="הבא נפתח" value={nextOpensText} />
      </div>

      {view.rankingSource === "default" && (
        <p className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/[0.06] px-3 py-2 text-sm text-amber-800">
          הסדר של המשתמש הזה הוא <strong>ברירת מחדל</strong> — הוא רכש בלי להשלים
          אבחון. שווה להזמין אותו להשלים, ואז המחזור הבא ייפתח בסדר האמיתי שלו.
        </p>
      )}

      {/* ── What the user sees now ───────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">מה המשתמש רואה עכשיו</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          בסדר התצוגה אצלו — התחום החלש ביותר ראשון.
        </p>

        {view.items.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            אין מחזור פתוח — למשתמש הזה לא מוצג כרגע שום פרק.
          </p>
        ) : (
          <ol className="mt-4 space-y-2">
            {view.items.map((it) => (
              <li
                key={it.cycleItemId}
                className={`flex items-start gap-3 rounded-lg border p-3 ${
                  it.completedAt ? "bg-emerald-500/[0.04]" : ""
                }`}
              >
                <span className="mt-0.5 shrink-0 tabular-nums text-sm font-bold text-muted-foreground">
                  {it.rankPosition}
                </span>
                <span className="mt-0.5 shrink-0">
                  {it.completedAt ? (
                    <Check className="size-4 text-emerald-600" />
                  ) : (
                    <Circle className="size-4 text-muted-foreground/50" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-muted-foreground">
                    {it.categoryName}
                    {it.isSubstitute && (
                      <span className="ms-2 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                        <Shuffle className="size-3" />
                        תחליף ל{it.intendedCategoryName}
                      </span>
                    )}
                  </div>
                  <div className="font-medium">{it.itemTitle}</div>
                  {it.completedAt && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      סומן {new Date(it.completedAt).toLocaleDateString("he-IL")}
                      {it.completedByEmail ? ` · ${it.completedByEmail}` : ""}
                      {isOpen && (
                        <span className="ms-3">
                          <ResetCompletionButton
                            cycleItemId={it.cycleItemId}
                            userId={view.userId}
                          />
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="mt-8">
        <CycleInterventions userId={view.userId} hasOpenCycle={isOpen} />
        {view.historyCount > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            מחזורים שהושלמו בעבר: {view.historyCount}
          </p>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-semibold tabular-nums">{value}</div>
    </div>
  );
}
