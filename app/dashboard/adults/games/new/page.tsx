import { requireAdmin } from "@/lib/auth/admin";
import { createAndRedirectNewGame } from "@/app/dashboard/actions/between-us-games";

export const dynamic = "force-dynamic";

// This route is a "creator shortcut": it creates an empty game stub and
// redirects to its edit page. The actual editing UI lives at
// /dashboard/between-us/games/[id]/edit.
export default async function NewExperienceGamePage() {
  await requireAdmin();
  await createAndRedirectNewGame();
  // redirect() throws internally — nothing below is reached
  return null;
}
