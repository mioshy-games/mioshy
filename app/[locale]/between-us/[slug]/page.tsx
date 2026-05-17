// Superseded by /mioshy-sex/[slug] (the /adults/[slug] route was
// renamed upstream; the original destination no longer exists). Kept
// as a redirect stub so old per-game bookmarks still land correctly.
import { redirect } from "next/navigation";
export default function BetweenUsSlugRedirect({
  params,
}: {
  params: { locale: string; slug: string };
}) {
  redirect(`/${params.locale}/mioshy-sex/${params.slug}`);
}
