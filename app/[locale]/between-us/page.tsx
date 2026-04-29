// Superseded by /adults. Pre-launch redirect stub.
import { redirect } from "next/navigation";
export default function BetweenUsRedirect({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/adults`);
}
