// Superseded by /adults/[slug]. Pre-launch redirect stub.
import { redirect } from "next/navigation";
export default function BetweenUsSlugRedirect({
  params,
}: {
  params: { locale: string; slug: string };
}) {
  redirect(`/${params.locale}/adults/${params.slug}`);
}
