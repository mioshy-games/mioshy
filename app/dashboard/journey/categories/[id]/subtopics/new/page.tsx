import { requireAdmin } from "@/lib/auth/admin";
import { createAndRedirectNewSubtopic } from "@/app/dashboard/actions/journey-content";

export const dynamic = "force-dynamic";

export default async function NewJourneySubtopicPage({
  params,
}: {
  params: { id: string };
}) {
  await requireAdmin();
  await createAndRedirectNewSubtopic(params.id);
  return null;
}
