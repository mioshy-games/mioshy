import { notFound } from "next/navigation";
import { getAdminSession } from "@/lib/auth/admin";
import { loadAllCmsTexts } from "@/lib/cms/server";
import { CmsContentEditor } from "@/components/admin/cms/CmsContentEditor";

// Always dynamic — admins want to see live CMS state, not a build-time
// snapshot. We also fetch via Supabase using cookies, which is dynamic
// by nature, so this is just being explicit.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mioshy CMS — Content Editor",
  // Search engines should not index the admin route. Combined with the
  // 404 below for non-admins, the route is invisible to crawlers.
  robots: { index: false, follow: false },
};

/**
 * /admin/content — internal CMS for editing bilingual copy.
 *
 * Auth contract — same `profiles.role = 'admin'` check as the rest of
 * the codebase (lib/auth/admin.ts). DIFFERENCE: where `requireAdmin()`
 * redirects non-admins to `/`, this page calls `notFound()` so the
 * route returns a 404 to anyone who isn't authorised. That hides the
 * existence of /admin/content from non-admins entirely (the original
 * brief calls for "Non-admin users get 404, not 401 — don't leak the
 * existence of the route").
 *
 * We still use `getAdminSession()` itself — same mechanism, only the
 * failure mode differs.
 */
export default async function AdminContentPage() {
  const session = await getAdminSession();
  if (!session) {
    notFound();
  }

  // Single round-trip to Supabase for every row. With ~830 rows × ~14
  // small columns = a few hundred KB serialized — well within the
  // budget for an admin page. No pagination yet; Sprint 5 may add a
  // virtualised list once we feel the pain.
  const rows = await loadAllCmsTexts();

  return <CmsContentEditor rows={rows} />;
}
