import { requireAdmin } from "@/lib/auth/admin";
import { createAndRedirectNewCategory } from "@/app/dashboard/actions/journey-content";

export const dynamic = "force-dynamic";

export default async function NewJourneyCategoryPage({
  searchParams,
}: {
  searchParams: { program?: string };
}) {
  await requireAdmin();
  await createAndRedirectNewCategory(searchParams.program ?? null);
  return null;
}
