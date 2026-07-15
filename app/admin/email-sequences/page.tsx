import { notFound } from "next/navigation";
import { getAdminSession } from "@/lib/auth/admin";
import {
  EMAIL_FLOWS,
  ACTIVE_SEQUENCE_EMAIL_KEYS,
} from "@/lib/journey/mailing/sequence-flows";
import {
  buildSequenceEmail,
  type SeqPersonalization,
} from "@/lib/journey/mailing/sequence-emails";
import { getEmailStatsByTag, type EmailStat } from "@/lib/admin/email-stats";
import { verifyPostAssessmentStop } from "@/lib/admin/email-flow-verify";
import {
  EmailSequencesDashboard,
  type FlowVM,
  type EmailCardVM,
} from "@/components/admin/email-sequences/EmailSequencesDashboard";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Mioshy Admin — Email Sequences",
  robots: { index: false, follow: false },
};

/**
 * /admin/email-sequences — view-only monitoring of the marketing email flows
 * (docs/admin-email-sequence-dashboard-spec.md). Self-gated like /admin/content
 * (getAdminSession → notFound for non-admins). No editing; all data is derived:
 * flow shape from sequence-flows.ts, subjects/previews from the real renderers
 * with sample data, sent/opened from Brevo, active/inert from the live set.
 */

// Representative sample (mirrors a real post-assessment user) so every preview
// renders exactly as the cron would build it.
const SAMPLE: SeqPersonalization = {
  firstName: "איציק",
  focusDomainHe: "תקשורת",
  scoreLines: [],
  gender: "male",
  scores: [
    { labelHe: "תקשורת", score: 50, isPriority: true },
    { labelHe: "אינטימיות", score: 62, isPriority: false },
    { labelHe: "חיבור רגשי", score: 58, isPriority: false },
    { labelHe: "חברות", score: 71, isPriority: false },
    { labelHe: "משפחה", score: 64, isPriority: false },
  ],
  pricing: {
    noCoachingRegular: 67,
    noCoachingFirst: 37,
    withCoachingRegular: 189,
    withCoachingFirst: 89,
  },
  windowDayHe: "יום שני",
  windowTime: "21:00",
  exercise: null,
  baseUrl: "https://mioshy.com",
  // Admin preview default (no real recipient) → the unsubscribe page; real sends
  // tokenize this per recipient.
  unsubscribeUrl: "https://mioshy.com/he/unsubscribe",
};

export default async function AdminEmailSequencesPage() {
  const session = await getAdminSession();
  if (!session) notFound();

  // Build each flow's cards: render subject + full HTML, fetch stats in parallel.
  const flows: FlowVM[] = await Promise.all(
    EMAIL_FLOWS.map(async (flow) => {
      const emails: EmailCardVM[] = await Promise.all(
        flow.emails.map(async (e) => {
          const built = buildSequenceEmail(e.key, SAMPLE);
          const stats: EmailStat | null = await getEmailStatsByTag(`seq_${e.key}`);
          return {
            key: e.key,
            order: e.order,
            timingLabel: e.timingLabel,
            gatesHe: e.gatesHe,
            subject: built.subject,
            html: built.html,
            senderName: built.senderName ?? null,
            active: ACTIVE_SEQUENCE_EMAIL_KEYS.has(e.key),
            stats,
          };
        }),
      );
      return {
        id: flow.id,
        nameHe: flow.nameHe,
        segmentHe: flow.segmentHe,
        descriptionHe: flow.descriptionHe,
        stopConditionHe: flow.stopConditionHe,
        built: flow.built,
        emails,
      };
    }),
  );

  const verification = await verifyPostAssessmentStop();

  return <EmailSequencesDashboard flows={flows} verification={verification} />;
}
