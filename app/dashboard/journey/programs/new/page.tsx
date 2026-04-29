import { requireAdmin } from "@/lib/auth/admin";
import { createAndRedirectNewProgram } from "@/app/dashboard/actions/journey-content";

export const dynamic = "force-dynamic";

export default async function NewJourneyProgramPage() {
  await requireAdmin();
  await createAndRedirectNewProgram();
  return null;
}
