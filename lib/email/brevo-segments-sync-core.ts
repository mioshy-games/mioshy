// ============================================================
// Brevo segmentation sync — pure logic core
// ============================================================
// This module contains the implementation. It deliberately does NOT
// `import "server-only"` so that the CLI smoke test
// (scripts/brevo-test-tag.ts) can import it via tsx outside of a Next.js
// RSC bundle.
//
// App code SHOULD NOT import this file directly — import the wrapper
// `./brevo-segments-sync` instead, which adds the `server-only` guard.
// See that file for the full design notes.
// ============================================================

import { brevoFetch } from "./brevo-client";
import { BREVO_LISTS } from "./brevo-segments";

// ------------------------------------------------------------
// Public types
// ------------------------------------------------------------

export type Language = "he" | "en";

/**
 * Adults pillar tiers, mirrored from supabase/migrations/033_adults_three_tier_pricing.sql:
 *   - single  : one-time per-game purchase (recorded in couple_entitlements, no sub row)
 *   - monthly : recurring membership      (subscriptions.plan_tier='monthly')
 *   - annual  : recurring + bonus slot    (subscriptions.plan_tier='annual')
 */
export type AdultsTier = "single" | "monthly" | "annual";

export type InterestSource = "homepage" | "warm_list";

export type Product = "journey" | "adults" | "games";

export interface SyncResult {
  success: boolean;
  error?: string;
}

// ------------------------------------------------------------
// Internal helpers
// ------------------------------------------------------------

function today(): string {
  // Brevo accepts ISO-8601 dates; YYYY-MM-DD is the standard form for
  // attributes of type=date.
  return new Date().toISOString().slice(0, 10);
}

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

function logSyncError(fn: string, err: unknown): SyncResult {
  const msg = err instanceof Error ? err.message : String(err);
  // eslint-disable-next-line no-console
  console.error(`[brevo-sync] ${fn} failed:`, msg);
  return { success: false, error: msg };
}

/**
 * Internal: fetch the current attributes for a contact.
 * Returns null on any non-2xx (including 404 "contact not found") so
 * callers can treat first-time syncs as "no prior state".
 */
async function getContactAttributes(
  email: string,
): Promise<Record<string, unknown> | null> {
  const id = encodeURIComponent(normaliseEmail(email));
  try {
    const res = await brevoFetch(`/contacts/${id}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { attributes?: Record<string, unknown> };
    return data.attributes ?? {};
  } catch {
    return null;
  }
}

/**
 * Core upsert: POST /contacts with updateEnabled=true so it creates OR
 * updates, then POST /contacts/lists/{id}/contacts/remove for each list
 * the contact should leave.
 */
async function upsertContact(args: {
  email: string;
  attributes?: Record<string, unknown>;
  addToLists?: number[];
  removeFromLists?: number[];
  extId?: string;
}): Promise<SyncResult> {
  const email = normaliseEmail(args.email);

  // ---- 1. Upsert (create-or-update) ----
  const body: Record<string, unknown> = {
    email,
    updateEnabled: true,
  };
  if (args.attributes && Object.keys(args.attributes).length > 0) {
    body.attributes = args.attributes;
  }
  if (args.addToLists && args.addToLists.length > 0) {
    body.listIds = args.addToLists;
  }
  if (args.extId) {
    body.ext_id = args.extId;
  }

  const post = await brevoFetch("/contacts", {
    method: "POST",
    body: JSON.stringify(body),
  });
  // 201 = created, 204 = updated. Both count as success.
  if (!post.ok && post.status !== 204) {
    const text = await post.text().catch(() => "");
    return {
      success: false,
      error: `POST /contacts ${post.status}: ${text.slice(0, 200)}`,
    };
  }

  // ---- 2. Remove from lists (each is no-op-safe) ----
  if (args.removeFromLists && args.removeFromLists.length > 0) {
    for (const listId of args.removeFromLists) {
      try {
        const r = await brevoFetch(
          `/contacts/lists/${listId}/contacts/remove`,
          {
            method: "POST",
            body: JSON.stringify({ emails: [email] }),
          },
        );
        // 201 = removed, 400 with "Contact already removed" is fine too;
        // we swallow non-fatal responses silently so the overall sync
        // still counts as success.
        if (!r.ok && r.status !== 400 && r.status !== 404) {
          const t = await r.text().catch(() => "");
          // eslint-disable-next-line no-console
          console.warn(
            `[brevo-sync] remove from list ${listId} returned ${r.status}: ${t.slice(0, 200)}`,
          );
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[brevo-sync] remove from list ${listId} threw:`, err);
      }
    }
  }

  return { success: true };
}

// ------------------------------------------------------------
// Public helpers exported for callers that need finer control
// ------------------------------------------------------------

/**
 * Read the current PRODUCTS_OWNED, add the given product if missing,
 * and PUT the merged value back. Returns the merged comma-separated
 * string (empty string if the operation failed).
 */
export async function addProductToContact(
  email: string,
  product: Product,
): Promise<string> {
  const attrs = (await getContactAttributes(email)) ?? {};
  const current = String(attrs.PRODUCTS_OWNED ?? "");
  const set = new Set(
    current
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  if (set.has(product)) {
    return [...set].join(",");
  }
  set.add(product);
  const next = [...set].join(",");
  const id = encodeURIComponent(normaliseEmail(email));
  try {
    const res = await brevoFetch(`/contacts/${id}`, {
      method: "PUT",
      body: JSON.stringify({ attributes: { PRODUCTS_OWNED: next } }),
    });
    return res.ok ? next : current;
  } catch {
    return current;
  }
}

/**
 * Read the current TOTAL_SPENT and return current+delta. Caller is
 * expected to write this value back as part of its own upsert payload.
 */
async function nextTotalSpent(email: string, delta: number): Promise<number> {
  const attrs = (await getContactAttributes(email)) ?? {};
  const current = Number(attrs.TOTAL_SPENT ?? 0);
  const safe = Number.isFinite(current) ? current : 0;
  return Math.round((safe + delta) * 100) / 100;
}

// ------------------------------------------------------------
// Public segment-tagging functions
// ------------------------------------------------------------

/**
 * 1. Lead captured (anonymous interest, no account).
 *    - Sets LANGUAGE, USER_SOURCE.
 *    - Leaves SIGNUP_DATE blank (they haven't signed up yet).
 *    - Adds to interested_no_purchase.
 */
export async function tagAsInterested(
  email: string,
  lang: Language,
  source: InterestSource,
): Promise<SyncResult> {
  try {
    return await upsertContact({
      email,
      attributes: {
        LANGUAGE: lang,
        USER_SOURCE: source,
      },
      addToLists: [BREVO_LISTS.INTERESTED],
    });
  } catch (err) {
    return logSyncError("tagAsInterested", err);
  }
}

/**
 * 2. Account created. Promotes from interested → registered.
 *    - Sets SIGNUP_DATE (only if absent), USER_SOURCE='registered'.
 *    - Adds to registered_no_purchase.
 *    - Removes from interested_no_purchase.
 *    - Passes ext_id=userId so Brevo records the Supabase user UUID.
 */
export async function tagAsRegistered(
  email: string,
  userId: string,
  lang: Language,
): Promise<SyncResult> {
  try {
    // Preserve the original signup date if we already stored one;
    // otherwise stamp today.
    const existing = await getContactAttributes(email);
    const existingSignup =
      existing && typeof existing.SIGNUP_DATE === "string"
        ? (existing.SIGNUP_DATE as string)
        : null;

    return await upsertContact({
      email,
      extId: userId,
      attributes: {
        LANGUAGE: lang,
        USER_SOURCE: "registered",
        SIGNUP_DATE: existingSignup ?? today(),
      },
      addToLists: [BREVO_LISTS.REGISTERED],
      removeFromLists: [BREVO_LISTS.INTERESTED],
    });
  } catch (err) {
    return logSyncError("tagAsRegistered", err);
  }
}

/**
 * 3. Bought a Journey plan (the inviter / couple owner).
 *    - Sets LAST_PURCHASE_DATE=today, increments TOTAL_SPENT, adds 'journey' to PRODUCTS_OWNED.
 *    - Adds to journey_member + existing_customer.
 *    - Removes from registered_no_purchase + interested_no_purchase.
 */
export async function tagAsJourneyMember(
  email: string,
  userId: string,
  lang: Language,
  amount: number,
): Promise<SyncResult> {
  try {
    const total = await nextTotalSpent(email, amount);
    const result = await upsertContact({
      email,
      extId: userId,
      attributes: {
        LANGUAGE: lang,
        LAST_PURCHASE_DATE: today(),
        TOTAL_SPENT: total,
      },
      addToLists: [BREVO_LISTS.JOURNEY_MEMBER, BREVO_LISTS.EXISTING],
      removeFromLists: [BREVO_LISTS.REGISTERED, BREVO_LISTS.INTERESTED],
    });
    if (result.success) {
      await addProductToContact(email, "journey");
    }
    return result;
  } catch (err) {
    return logSyncError("tagAsJourneyMember", err);
  }
}

/**
 * 4. Redeemed a partner-invite code (the invited spouse).
 *    - Sets HAS_PARTNER=true on this contact.
 *    - Adds to journey_couple + existing_customer.
 *    - Removes from registered_no_purchase + interested_no_purchase.
 *
 * Note: the inviter's HAS_PARTNER flag should be updated by the caller
 * via a second tagAsJourneyCouple-style call if desired. We don't read
 * the inviter contact here because we don't have its email in args.
 */
export async function tagAsJourneyCouple(
  email: string,
  userId: string,
  lang: Language,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  partnerId: string,
): Promise<SyncResult> {
  try {
    return await upsertContact({
      email,
      extId: userId,
      attributes: {
        LANGUAGE: lang,
        HAS_PARTNER: true,
      },
      addToLists: [BREVO_LISTS.JOURNEY_COUPLE, BREVO_LISTS.EXISTING],
      removeFromLists: [BREVO_LISTS.REGISTERED, BREVO_LISTS.INTERESTED],
    });
  } catch (err) {
    return logSyncError("tagAsJourneyCouple", err);
  }
}

/**
 * 5. Adults purchase (one-time or membership).
 *    - Sets LAST_PURCHASE_DATE, increments TOTAL_SPENT, adds 'adults' to PRODUCTS_OWNED.
 *    - Adds to adults_buyer + existing_customer.
 *    - Removes from registered_no_purchase + interested_no_purchase.
 *
 * `tier` is accepted for forward-compatibility (we may key segments off
 * the subscription tier later); for now it is intentionally not written
 * to Brevo, since tier lives on the subscriptions row in Supabase.
 */
export async function tagAsAdultsBuyer(
  email: string,
  userId: string,
  lang: Language,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  tier: AdultsTier,
  amount: number,
): Promise<SyncResult> {
  try {
    const total = await nextTotalSpent(email, amount);
    const result = await upsertContact({
      email,
      extId: userId,
      attributes: {
        LANGUAGE: lang,
        LAST_PURCHASE_DATE: today(),
        TOTAL_SPENT: total,
      },
      addToLists: [BREVO_LISTS.ADULTS, BREVO_LISTS.EXISTING],
      removeFromLists: [BREVO_LISTS.REGISTERED, BREVO_LISTS.INTERESTED],
    });
    if (result.success) {
      await addProductToContact(email, "adults");
    }
    return result;
  } catch (err) {
    return logSyncError("tagAsAdultsBuyer", err);
  }
}

/**
 * 6. Games subscription started.
 *    - Sets LAST_PURCHASE_DATE, increments TOTAL_SPENT, adds 'games' to PRODUCTS_OWNED.
 *    - Adds to games_subscriber + existing_customer.
 *    - Removes from registered_no_purchase + interested_no_purchase.
 */
export async function tagAsGamesSubscriber(
  email: string,
  userId: string,
  lang: Language,
  amount: number,
): Promise<SyncResult> {
  try {
    const total = await nextTotalSpent(email, amount);
    const result = await upsertContact({
      email,
      extId: userId,
      attributes: {
        LANGUAGE: lang,
        LAST_PURCHASE_DATE: today(),
        TOTAL_SPENT: total,
      },
      addToLists: [BREVO_LISTS.GAMES, BREVO_LISTS.EXISTING],
      removeFromLists: [BREVO_LISTS.REGISTERED, BREVO_LISTS.INTERESTED],
    });
    if (result.success) {
      await addProductToContact(email, "games");
    }
    return result;
  } catch (err) {
    return logSyncError("tagAsGamesSubscriber", err);
  }
}

/**
 * 7. Games subscription cancelled.
 *    - Removes from games_subscriber ONLY.
 *    - Stays in existing_customer (they're still a customer historically).
 *    - PRODUCTS_OWNED is left alone — the field is "has owned", not
 *      "currently subscribed".
 */
export async function untagGamesSubscriber(email: string): Promise<SyncResult> {
  try {
    return await upsertContact({
      email,
      removeFromLists: [BREVO_LISTS.GAMES],
    });
  } catch (err) {
    return logSyncError("untagGamesSubscriber", err);
  }
}
