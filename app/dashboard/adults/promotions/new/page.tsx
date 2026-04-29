import { requireAdmin } from "@/lib/auth/admin";
import { createAndRedirectNewPromotion } from "@/app/dashboard/actions/between-us-promotions";

export const dynamic = "force-dynamic";

export default async function NewPromotionPage() {
  await requireAdmin();
  await createAndRedirectNewPromotion();
  return null;
}
