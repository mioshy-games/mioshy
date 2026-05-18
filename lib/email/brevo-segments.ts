// ============================================================
// Brevo segmentation v2 — list IDs + attribute names
// ============================================================
// IDs are written to .env.local by scripts/brevo-bootstrap-segments.mjs.
// Re-run that script to (re)provision lists in Brevo; this file does not
// need to change.
//
// See docs/brevo-current-state-2026-05-17.md for the audit context that
// motivated this seven-list topology.
// ============================================================

export const BREVO_LISTS = {
  INTERESTED: parseInt(process.env.BREVO_LIST_INTERESTED!, 10),
  REGISTERED: parseInt(process.env.BREVO_LIST_REGISTERED!, 10),
  JOURNEY_MEMBER: parseInt(process.env.BREVO_LIST_JOURNEY_MEMBER!, 10),
  JOURNEY_COUPLE: parseInt(process.env.BREVO_LIST_JOURNEY_COUPLE!, 10),
  ADULTS: parseInt(process.env.BREVO_LIST_ADULTS!, 10),
  GAMES: parseInt(process.env.BREVO_LIST_GAMES!, 10),
  EXISTING: parseInt(process.env.BREVO_LIST_EXISTING!, 10),
} as const;

export type BrevoListName = keyof typeof BREVO_LISTS;

export const BREVO_ATTRS = {
  LANGUAGE: "LANGUAGE",
  SIGNUP_DATE: "SIGNUP_DATE",
  LAST_PURCHASE_DATE: "LAST_PURCHASE_DATE",
  TOTAL_SPENT: "TOTAL_SPENT",
  PRODUCTS_OWNED: "PRODUCTS_OWNED",
  HAS_PARTNER: "HAS_PARTNER",
  USER_SOURCE: "USER_SOURCE",
} as const;

export type BrevoAttrName = keyof typeof BREVO_ATTRS;
