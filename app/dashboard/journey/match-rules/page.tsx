/**
 * /dashboard/journey/match-rules
 *
 * Layer-1 governance surface: every scheduled item is attributed to
 * a row in journey_match_rules. This page lists those rules so an
 * admin can:
 *   - see at a glance which rules are firing in production
 *     (count of currently-attributed scheduled_items per rule)
 *   - read the bilingual rationale that gets shown to the user
 *     under "Why this item?"
 *   - tweak labels, rationale text, priority, and is_active
 *
 * The full DSL builder (editable when_condition / then_action) lands
 * in V2 — see docs/journey-execution-architecture-2026-05-08.md Part 4.
 */

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin";
import {
  listMatchRules,
  countItemsPerRule,
} from "@/lib/journey-content/match-rules";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getAdminLocale } from "@/lib/admin/locale";
import { t } from "@/lib/admin/i18n";
import { SectionHelp } from "@/components/dashboard/SectionHelp";

export const dynamic = "force-dynamic";

export default async function MatchRulesListPage() {
  await requireAdmin();
  const locale = getAdminLocale();
  const KIND_LABEL: Record<string, string> = {
    manual:          t(locale, "journey.match_rules.kind_manual"),
    auto_purchase:   t(locale, "journey.match_rules.kind_purchase"),
    priority_top1:   t(locale, "journey.match_rules.kind_priority"),
    system_default:  t(locale, "journey.match_rules.kind_default"),
  };

  const [rules, counts] = await Promise.all([
    listMatchRules(),
    countItemsPerRule(),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link
          href="/dashboard/journey"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4 rtl:scale-x-[-1]" />
          {t(locale, "btn.back")}
        </Link>
        <span className="mt-2 inline-flex items-center gap-1.5">
          <h1 className="text-3xl font-bold tracking-tight">
            {t(locale, "journey.match_rules.title")}
          </h1>
          <SectionHelp
            title="כללי התאמה"
            body={
              <>
                <p>
                  כל פריט שמשובץ אצל זוג נושא שיוך לכלל שיצר אותו. הכלל הוא
                  ה-<em>סיבה</em> שהמשתמש רואה תחת &quot;למה הפריט הזה?&quot;
                  בעמוד הפריט שלו.
                </p>
                <p>
                  <strong>בעמוד הזה עורכים את ההסבר (rationale)</strong> — לא
                  את הלוגיקה. למשל: שינוי הניסוח של &quot;הפריט הזה הוצמד
                  לכם כי...&quot; משתקף מיידית בעמוד של כל הזוגות שיש להם
                  פריטים מתויגים בכלל הזה.
                </p>
                <p>
                  <strong>סוגי כלל:</strong> ידני (אדמין הצמיד ידנית) /
                  רכישה אוטו&apos; (מההצמדה האוטומטית עם הרכישה) / עדיפות #1
                  (ה-AI הציע לפי האבחון) / ברירת מערכת (fallback).
                </p>
              </>
            }
            aiNote={
              <p>
                ה-AI לא משנה כללים. הוא רק <em>מציע</em> פריטים דרך Smart
                Suggestions במרחב הזוג, וכשאתם מאשרים — נוצר scheduled item
                עם תיוג לכלל &quot;עדיפות #1&quot; שמסביר למה זה הוצע.
              </p>
            }
          />
        </span>
        <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
          {t(locale, "journey.match_rules.subtitle")}
        </p>
      </div>

      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t(locale, "journey.match_rules.col_rule")}</TableHead>
              <TableHead>{t(locale, "journey.match_rules.col_kind")}</TableHead>
              <TableHead className="hidden lg:table-cell">
                {t(locale, "journey.match_rules.col_rationale")}
              </TableHead>
              <TableHead className="text-right">{t(locale, "journey.match_rules.col_priority")}</TableHead>
              <TableHead className="text-right">{t(locale, "journey.match_rules.col_in_use")}</TableHead>
              <TableHead>{t(locale, "journey.match_rules.col_status")}</TableHead>
              <TableHead className="text-right">{t(locale, "journey.match_rules.col_edit")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-muted-foreground h-24 text-center"
                >
                  {t(locale, "journey.match_rules.no_rules")}
                </TableCell>
              </TableRow>
            ) : (
              rules.map((r) => {
                const count = counts.get(r.id) ?? 0;
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.label_he}</div>
                      <div className="text-muted-foreground text-xs">
                        {r.label_en}
                      </div>
                      <code className="text-muted-foreground text-[10px] font-mono">
                        {r.slug}
                      </code>
                    </TableCell>
                    <TableCell className="text-xs">
                      {KIND_LABEL[r.matcher_kind] ?? r.matcher_kind}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <p className="text-muted-foreground line-clamp-2 max-w-md text-xs">
                        {r.rationale_he}
                      </p>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {r.priority}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {count}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.is_active ? "default" : "secondary"}>
                        {r.is_active ? t(locale, "status.active") : t(locale, "status.inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/dashboard/journey/match-rules/${r.id}`}
                        className="text-primary text-sm hover:underline"
                      >
                        {t(locale, "btn.edit")} →
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-muted-foreground text-xs">
        <strong>{rules.length}</strong> {t(locale, "journey.match_rules.summary")}{" "}
        <strong>
          {Array.from(counts.values()).reduce((a, b) => a + b, 0)}
        </strong>{" "}
        {t(locale, "journey.match_rules.attributed")}
      </p>
    </div>
  );
}
