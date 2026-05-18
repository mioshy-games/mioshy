// ============================================================
// Brevo segmentation sync layer (server-only wrapper)
// ============================================================
// Lifecycle-stage tagging functions called from server actions / webhooks
// when a user crosses a boundary (interest → registered → buyer of pillar X).
//
// This file is a thin re-export of `./brevo-segments-sync-core` plus a
// `server-only` guard so accidental client-component imports fail at
// bundle time. The split exists because the CLI smoke test
// (scripts/brevo-test-tag.ts) runs outside Next's RSC context via tsx
// and would crash on the `server-only` directive if it imported the
// guarded module.
//
// Design rules (implemented in the core module):
//
//   1. Every public function is IDEMPOTENT — safe to call twice in a row
//      with the same args. Repeating tagAsRegistered() will not overwrite a
//      previously-stored SIGNUP_DATE; repeating tagAsJourneyMember() will
//      not double-count TOTAL_SPENT (we read-then-write the new total).
//
//   2. Every public function is NON-THROWING. They wrap network calls in
//      try/catch and return { success: boolean, error?: string }. A Brevo
//      outage MUST NOT break user-facing flows like signup or checkout.
//
//   3. The "upsert + cross-list move" pattern uses two Brevo endpoints
//      because Brevo's POST /contacts does not accept `unlinkListIds`
//      (only PUT /contacts/{identifier} does, and that requires the
//      contact to already exist). We use:
//        - POST /contacts                              (upsert + attrs + listIds add)
//        - POST /contacts/lists/{id}/contacts/remove   (per list to remove)
//      The remove endpoint is no-op-safe when the contact is not in the
//      list, so this stays idempotent.
//
//   4. PRODUCTS_OWNED is a comma-separated text attribute (Brevo has no
//      native array attribute type for arbitrary strings). On purchase we
//      GET the current value, add the new product if missing, and PUT the
//      merged string. Same pattern for TOTAL_SPENT (read, add, write).
//      These reads have a small race window if a user makes two purchases
//      within the same second — acceptable for email segmentation.
// ============================================================
import "server-only";

export * from "./brevo-segments-sync-core";
