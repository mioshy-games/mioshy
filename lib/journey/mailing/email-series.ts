/**
 * Series / email_key taxonomy for every marketing email we send, so Brevo tags
 * (and future reporting / sequencing) can group them by lifecycle stage.
 *
 * series: the lifecycle bucket. email_key: the individual template.
 * Applied as Brevo tags "series:<series>" + "email_key:<key>" on each send.
 */

export type EmailSeries = "post-assessment" | "trial" | "re-engagement";

/** Every known email template → its series. */
export const EMAIL_SERIES: Record<string, EmailSeries> = {
  // post-assessment nurture sequence (marketing-sequence cron)
  results_ready: "post-assessment",
  founder_story: "post-assessment", // email #2 — replaced evening_proof (2026-07-09)
  coaching_explainer: "post-assessment", // email #3 — replaced deadline (2026-07-09)
  day7_value_tip: "post-assessment",
  // trial lifecycle (trial-reminder cron)
  trial_day5: "trial",
  // re-engagement: (none yet)
};

/** Brevo tags for an email: series + email_key (defaults series to post-assessment). */
export function emailSeriesTags(emailKey: string): string[] {
  const series = EMAIL_SERIES[emailKey] ?? "post-assessment";
  return [`series:${series}`, `email_key:${emailKey}`];
}
