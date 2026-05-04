import { redirect } from "next/navigation";

/**
 * /products → /games redirect.
 *
 * The standalone /products catalogue page was retired in favour of the
 * main /games hub, which now hosts the full live games + "Coming soon"
 * catalogue. This page exists only to redirect old bookmarks, search-
 * engine results, and any in-app links that haven't been updated yet.
 *
 * If you ever need to fully remove the route, delete this file AND
 * remove the /products entry from app/sitemap.ts (already done).
 */
export default function ProductsRedirect({
  params,
}: {
  params: { locale: string };
}) {
  redirect(`/${params.locale}/games`);
}
