import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin";
import { getCategoryPool, listUsersWithCycles } from "@/lib/journey-content/cycle-admin";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

/**
 * /dashboard/journey/cycles — the five-track cycle admin (spec §5).
 *
 * Two halves:
 *   • the content pool, per category, in the order it will be handed out —
 *     replacing the old "weekly sequence" mental model
 *   • every user who has a cycle, with how far through it they are
 */
export default async function CyclesAdminPage() {
  await requireAdmin();

  const [pool, users] = await Promise.all([getCategoryPool(), listUsersWithCycles()]);

  return (
    <div dir="rtl" className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/dashboard/journey"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4 rotate-180" />
        חזרה למסע
      </Link>

      <h1 className="mt-4 text-3xl font-bold tracking-tight">מחזורי תוכן</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        כל מחזור פותח חמישה פרקים בבת אחת — אחד מכל קטגוריה, לפי סדר העדיפות של
        המשתמש. מחזור חדש נפתח כשכל החמישה סומנו, או בתום חודש — המוקדם מביניהם.
      </p>

      {/* ── Coverage ─────────────────────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold">מאגר התוכן לפי קטגוריה</h2>

        <div className="mt-3 rounded-lg border bg-muted/30 p-4">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
            <span>
              סה״כ פרקים פעילים: <strong>{pool.totalItems}</strong>
            </span>
            <span>
              מספיק ל־<strong>{pool.cyclesOfCoverage}</strong> מחזורים מלאים
            </span>
            {pool.bindingCategorySlug && (
              <span className="text-muted-foreground">
                הקטגוריה שקובעת: <strong>{pool.bindingCategorySlug}</strong>
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            הקטגוריה הדלה ביותר היא זו שקובעת כמה מחזורים מלאים אפשר להרכיב.
            כשקטגוריה נגמרת המחזור עדיין מגיש חמישה — הסלוט מתמלא מהקטגוריה הבאה
            בסדר העדיפות ומסומן כתחליף — אבל זה סימן שצריך לכתוב.
          </p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pool.categories.map((c) => {
            const starving = c.total <= 3;
            return (
              <div
                key={c.categoryId}
                className={`rounded-lg border p-4 ${starving ? "border-amber-500/50 bg-amber-500/[0.04]" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{c.nameHe}</h3>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                      starving ? "bg-amber-500/20 text-amber-700" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {c.total}
                  </span>
                </div>
                {starving && (
                  <p className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-700">
                    <AlertTriangle className="size-3.5" />
                    מספיק ל־{c.total} מחזורים בלבד
                  </p>
                )}
                <ol className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {c.queue.slice(0, 6).map((q, idx) => (
                    <li key={q.id} className="truncate">
                      <span className="tabular-nums opacity-60">{idx + 1}.</span> {q.title}
                    </li>
                  ))}
                  {c.queue.length > 6 && (
                    <li className="opacity-60">…ועוד {c.queue.length - 6}</li>
                  )}
                  {c.queue.length === 0 && <li className="italic">אין פרקים</li>}
                </ol>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Users ────────────────────────────────────────────────────────── */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold">משתמשים במודל המחזורים</h2>
        {users.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            אין עדיין משתמשים עם מחזור פתוח.
          </p>
        ) : (
          <Table className="mt-3">
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">משתמש</TableHead>
                <TableHead className="text-right">מחזור</TableHead>
                <TableHead className="text-right">התקדמות</TableHead>
                <TableHead className="text-right">נפתח</TableHead>
                <TableHead className="text-right">הבא נפתח</TableHead>
                <TableHead className="text-right">סדר לפי</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.userId}>
                  <TableCell>
                    <Link
                      href={`/dashboard/journey/cycles/${u.userId}`}
                      className="font-medium underline underline-offset-4"
                    >
                      {u.email ?? u.userId.slice(0, 8)}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {u.cycleNumber ?? "—"}
                    {u.closedAt && <span className="text-xs text-muted-foreground"> (סגור)</span>}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {u.completedCount}/{u.totalCount}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {u.openedAt?.slice(0, 10) ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {u.plannedNextOpenAt?.slice(0, 10) ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {u.rankingSource === "default" ? (
                      <span className="text-amber-700">ברירת מחדל</span>
                    ) : (
                      u.rankingSource ?? "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
