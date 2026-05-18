// Superseded by /mioshy-sex (the /adults route was renamed upstream;
// the original /adults destination no longer exists). Kept as a
// redirect stub so old bookmarks / search-engine results / external
// links still land on the right destination instead of a 404.
import { redirect } from "next/navigation";
export default function BetweenUsRedirect({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/mioshy-sex`);
}
