/**
 * lib/dashboard/leads.ts
 *
 * Server data layer for the admin Leads / follow-up view (2026-07-12).
 *
 * A "lead" is redefined as a REAL signup that has not converted to an active
 * paid subscription — i.e. a `profiles` row (the signup source of truth, the
 * same source /dashboard Overview counts as SIGNUPS) whose latest subscription
 * is not `active`. This replaces the old `leads`-table view, which the current
 * funnel barely populates.
 *
 * Everything is read through the service-role client (requireAdmin gates the
 * routes). No migration: identity/contact data is joined from the existing
 * v_user_directory view (email, phone, consent, subscription_status — the same
 * view /dashboard/users reads), and the three columns the view lacks
 * (created_at, preferred_language, is_test_user) come straight from profiles.
 * Assessment status is one batched journey_analysis read (no N+1).
 *
 * Test accounts (profiles.is_test_user) are excluded by default — they are not
 * real leads and must never reach outreach exports (re-engagement spec §A).
 */

import { createServiceRoleClient } from "@/lib/supabase-admin";

export interface LeadRow {
  userId: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  language: string | null;
  marketingConsent: boolean;
  marketingConsentAt: string | null;
  termsAccepted: boolean;
  assessmentDone: boolean;
  converted: boolean;
  subscriptionProduct: string | null;
  createdAt: string;
}

export interface LeadsFilter {
  /** "he" | "en" | null (all). */
  lang?: string | null;
  /** "not" (non-converted, default) | "converted" | "all". */
  status?: "not" | "converted" | "all";
  /** Only signups created within the last N days (e.g. 7 for marathon). */
  sinceDays?: number | null;
  /** Outreach compliance — keep only marketing-consented users. */
  consentedOnly?: boolean;
  /** Include is_test_user accounts (default false). */
  includeTests?: boolean;
}

export interface LeadsResult {
  rows: LeadRow[];
  /** Rows matching the filter (before any display limit). */
  total: number;
  /** Non-converted, non-test signups in the last 7 days (Overview reconcile). */
  last7d: number;
  degraded: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

async function fetchAll<T>(
  run: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const page = 1000;
  let from = 0;
  const out: T[] = [];
  for (;;) {
    const { data } = await run(from, from + page - 1);
    const chunk = data ?? [];
    out.push(...chunk);
    if (chunk.length < page) break;
    from += page;
  }
  return out;
}

type ProfileRow = {
  id: string;
  created_at: string;
  preferred_language: string | null;
  is_test_user: boolean | null;
};

type DirRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  marketing_consent: boolean | null;
  marketing_consent_at: string | null;
  terms_accepted: boolean | null;
  subscription_status: string | null;
  subscription_product: string | null;
  owns_journey: boolean | null;
  owns_games: boolean | null;
  owns_adults: boolean | null;
};

/**
 * Load leads (signed-up, not-active-paid) joined from profiles + the directory
 * view + assessment status, filtered and sorted newest-first. Returns ALL
 * matching rows (callers apply their own display limit).
 */
export async function loadLeads(filter: LeadsFilter = {}): Promise<LeadsResult> {
  const admin = createServiceRoleClient();
  if (!admin) return { rows: [], total: 0, last7d: 0, degraded: true };

  const [profiles, dir, analysisUserIds] = await Promise.all([
    fetchAll<ProfileRow>((from, to) =>
      admin
        .from("profiles")
        .select("id, created_at, preferred_language, is_test_user")
        .order("created_at", { ascending: false })
        .range(from, to)
        .then((r) => ({ data: (r.data ?? []) as ProfileRow[] })),
    ),
    fetchAll<DirRow>((from, to) =>
      admin
        .from("v_user_directory")
        .select(
          "user_id, email, full_name, phone, marketing_consent, marketing_consent_at, terms_accepted, subscription_status, subscription_product, owns_journey, owns_games, owns_adults",
        )
        .range(from, to)
        .then((r) => ({ data: (r.data ?? []) as DirRow[] })),
    ),
    fetchAll<{ user_id: string }>((from, to) =>
      admin
        .from("journey_analysis")
        .select("user_id")
        .range(from, to)
        .then((r) => ({ data: (r.data ?? []) as Array<{ user_id: string }> })),
    ),
  ]);

  const dirByUser = new Map(dir.map((d) => [d.user_id, d]));
  const assessed = new Set(analysisUserIds.map((a) => a.user_id));

  const all: LeadRow[] = profiles.map((p) => {
    const d = dirByUser.get(p.id);
    const converted =
      d?.subscription_status === "active" ||
      !!d?.owns_journey ||
      !!d?.owns_games ||
      !!d?.owns_adults;
    return {
      userId: p.id,
      email: d?.email ?? null,
      fullName: d?.full_name ?? null,
      phone: d?.phone ?? null,
      language: p.preferred_language,
      marketingConsent: d?.marketing_consent === true,
      marketingConsentAt: d?.marketing_consent_at ?? null,
      termsAccepted: d?.terms_accepted === true,
      assessmentDone: assessed.has(p.id),
      converted,
      subscriptionProduct: d?.subscription_product ?? null,
      createdAt: p.created_at,
      isTest: p.is_test_user === true,
    } as LeadRow & { isTest: boolean };
  });

  const status = filter.status ?? "not";
  const sinceIso = filter.sinceDays
    ? new Date(Date.now() - filter.sinceDays * DAY_MS).toISOString()
    : null;

  const rows = (all as Array<LeadRow & { isTest: boolean }>).filter((r) => {
    if (!filter.includeTests && r.isTest) return false;
    if (status === "not" && r.converted) return false;
    if (status === "converted" && !r.converted) return false;
    if (filter.lang === "he" || filter.lang === "en") {
      if (r.language !== filter.lang) return false;
    }
    if (sinceIso && r.createdAt < sinceIso) return false;
    if (filter.consentedOnly && !r.marketingConsent) return false;
    return true;
  });

  // Reconcile figure: non-converted, non-test signups in the last 7 days.
  const iso7 = new Date(Date.now() - 7 * DAY_MS).toISOString();
  const last7d = (all as Array<LeadRow & { isTest: boolean }>).filter(
    (r) => !r.isTest && !r.converted && r.createdAt >= iso7,
  ).length;

  // Strip the internal isTest field from the returned rows.
  const cleaned: LeadRow[] = rows.map(({ ...r }) => {
    const copy = r as LeadRow & { isTest?: boolean };
    delete copy.isTest;
    return copy;
  });

  return { rows: cleaned, total: cleaned.length, last7d, degraded: false };
}
