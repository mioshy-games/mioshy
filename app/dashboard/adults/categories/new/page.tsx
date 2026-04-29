import { requireAdmin } from "@/lib/auth/admin";
import { createAndRedirectNewCategory } from "@/app/dashboard/actions/between-us-taxonomy";

export const dynamic = "force-dynamic";

export default async function NewCategoryPage() {
  await requireAdmin();
  await createAndRedirectNewCategory();
  return null;
}
