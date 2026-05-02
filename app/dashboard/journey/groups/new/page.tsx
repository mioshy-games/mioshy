import { requireAdmin } from "@/lib/auth/admin";
import { createAndRedirectNewGroup } from "@/app/dashboard/actions/journey-groups";

export const dynamic = "force-dynamic";

export default async function NewJourneyGroupPage() {
  await requireAdmin();
  await createAndRedirectNewGroup();
  return null;
}
