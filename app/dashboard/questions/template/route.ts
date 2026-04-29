import { requireAdmin } from "@/lib/auth/admin";
import { buildWheelQuestionsTemplate } from "@/lib/csv-wheel-questions";

export async function GET() {
  // Require admin so the template endpoint isn't publicly accessible
  await requireAdmin();

  const csv = buildWheelQuestionsTemplate();

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="questions_import_template.csv"',
      "cache-control": "no-store",
    },
  });
}
