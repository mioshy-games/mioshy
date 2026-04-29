import { requireAdmin } from "@/lib/auth/admin";
import { createAndRedirectNewTag } from "@/app/dashboard/actions/between-us-taxonomy";

export const dynamic = "force-dynamic";

export default async function NewTagPage() {
  await requireAdmin();
  await createAndRedirectNewTag();
  return null;
}
