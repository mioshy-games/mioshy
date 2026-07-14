import type { Metadata } from "next";
import { SurveyFlow } from "@/components/survey/SurveyFlow";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "סקר הזוגיות של ישראל · מיאושי",
  description: "כל יום שאלה אחת על הזוגיות, ורואים מיד מה זוגות אחרים בישראל ענו.",
};

export default function SurveyPage() {
  // Anon marketing flow: header stays, footer hidden (see Chrome), floating
  // back → the marketing homepage.
  return <SurveyFlow back={{ href: "/he" }} />;
}
