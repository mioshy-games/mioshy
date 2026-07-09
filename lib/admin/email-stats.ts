import "server-only";

/**
 * Brevo delivery/open stats for the admin email-sequence dashboard.
 *
 * Reads the aggregated statistics report per Brevo tag. Real sequence sends
 * carry the tag `seq_<kind>` (the cron sets it); admin previews / send-tests use
 * `test-*` tags, so querying `seq_<kind>` counts only genuine flow sends.
 *
 * View-only, best-effort: any failure (no key, network, non-200) returns null so
 * the dashboard degrades to "—" instead of erroring.
 */

export interface EmailStat {
  sent: number; // requests
  delivered: number;
  opened: number; // unique opens
  clicked: number; // unique clicks
}

const BREVO_BASE = "https://api.brevo.com/v3/smtp/statistics/aggregatedReport";

export async function getEmailStatsByTag(
  tag: string,
  days = 90,
): Promise<EmailStat | null> {
  const key = process.env.BREVO_API_KEY;
  if (!key) return null;
  try {
    const url = `${BREVO_BASE}?tag=${encodeURIComponent(tag)}&days=${days}`;
    const r = await fetch(url, {
      headers: { "api-key": key, accept: "application/json" },
      cache: "no-store",
    });
    if (!r.ok) return null;
    const j = (await r.json()) as Record<string, number>;
    return {
      sent: Number(j.requests ?? 0),
      delivered: Number(j.delivered ?? 0),
      opened: Number(j.uniqueOpens ?? j.opens ?? 0),
      clicked: Number(j.uniqueClicks ?? j.clicks ?? 0),
    };
  } catch {
    return null;
  }
}
