import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SurveyFlow } from "@/components/survey/SurveyFlow";
import { getPollUserId } from "@/lib/poll/anon";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "סקר הזוגיות של ישראל · מיאושי",
  description: "כל יום שאלה אחת על הזוגיות, ורואים מיד מה זוגות אחרים בישראל ענו.",
};

export default async function SurveyPage({ params }: { params: { locale: string } }) {
  // A signed-in user experiences the survey INSIDE the dashboard — never the
  // public marketing page. Redirect every entry point (public header, services
  // strip, direct link) to /my/survey. Anonymous visitors get the public flow.
  const userId = await getPollUserId();
  if (userId) redirect(`/${params.locale}/my/survey`);

  // Anon marketing flow: header stays, footer hidden (see Chrome), floating
  // back → the marketing homepage.
  return <SurveyFlow back={{ href: "/he" }} />;
}
