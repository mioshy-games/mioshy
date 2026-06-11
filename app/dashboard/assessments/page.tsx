import { requireAdmin } from "@/lib/auth/admin";
import Link from "next/link";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { listAssessments } from "@/lib/assessments/catalog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AssessmentsAdminListPage() {
  await requireAdmin();
  const admin = createAdminSupabaseClient();
  const assessments = listAssessments();

  // Count DB-managed questions per assessment.
  const { data: rows } = await admin
    .from("assessment_questions")
    .select("assessment_id, is_active");
  const counts: Record<string, number> = {};
  for (const r of rows ?? []) {
    if (r.is_active) counts[r.assessment_id as string] = (counts[r.assessment_id as string] ?? 0) + 1;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">אבחונים</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          ניהול שאלות האבחון — עריכה, הוספה, מחיקה, וייבוא/ייצוא CSV.
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>אבחון</TableHead>
            <TableHead>מזהה</TableHead>
            <TableHead>שאלות פעילות</TableHead>
            <TableHead>סטטוס</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {assessments.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="font-medium">{a.he_title}</TableCell>
              <TableCell className="text-muted-foreground font-mono text-xs">{a.id}</TableCell>
              <TableCell>{counts[a.id] ?? 0}</TableCell>
              <TableCell>
                {a.live ? <Badge>פעיל</Badge> : <Badge variant="secondary">בקרוב</Badge>}
              </TableCell>
              <TableCell className="text-end">
                <Link
                  href={`/dashboard/assessments/${a.id}`}
                  className="text-sm font-semibold text-fuchsia-600 hover:underline"
                >
                  ניהול שאלות ←
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
