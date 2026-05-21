import { redirect } from "next/navigation";

/**
 * /sex-game — DEPRECATED 2026-05-20.
 *
 * This route was the staging slot while the flagship adult-games page
 * was being rebuilt. The new design has now taken over /mioshy-sex
 * permanently (per Itzik: "remove the old mioshy-sex completely and
 * put the new page in its place"). Anyone who lands here — bookmarks,
 * external links, search-engine cache — gets a server-side redirect
 * to the canonical /[locale]/mioshy-sex URL.
 *
 * The file is kept on disk because the file tool in this environment
 * can't delete files; replacing the body with a redirect is the
 * cleanest available approach. Safe to delete from the filesystem
 * later — the catch-all route would simply 404 instead of redirecting.
 */

export const dynamic = "force-dynamic";

export default function SexGameRedirect({
  params,
}: {
  params: { locale: string };
}) {
  redirect(`/${params.locale}/mioshy-sex`);
}
