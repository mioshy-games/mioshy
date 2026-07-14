/**
 * scripts/backfill-token-expiry.mjs
 *
 * ONE-TIME backfill for the 2026-07-14 token-expiry off-by-one bug.
 *
 * normalizeExpiry() stored Cardcom's VALID-UNTIL month (the 1st of the month
 * AFTER the card's printed expiry) as the expiry, so every customer_payment_methods
 * row is ONE MONTH TOO HIGH. This script decrements each stored expiry_mmyy by one
 * month (with year rollover), EXACTLY ONCE.
 *
 * Safety (a double decrement would corrupt the data):
 *   • BACKUP + IDEMPOTENCY via token_expiry_backfill_log (migration 189). A row
 *     there = already corrected → skipped. The log also holds the before-image.
 *   • DRY-RUN by default: prints a before→after preview for every row and writes
 *     NOTHING. Pass --apply to actually write.
 *   • --cutoff=<ISO>: only rows created strictly before this timestamp. Use the
 *     code-fix deploy time so tokens created AFTER the fix (already correct) are
 *     never decremented. Run BEFORE deploying the fix, or with a cutoff.
 *   • Includes EVERY active row — incl. the real subscriber (card 3634), the only
 *     token that matters for future charges.
 *
 * Usage:
 *   node scripts/backfill-token-expiry.mjs                 # dry-run preview
 *   node scripts/backfill-token-expiry.mjs --apply         # write (once)
 *   node scripts/backfill-token-expiry.mjs --apply --cutoff=2026-07-14T12:00:00Z
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

// ── env ──────────────────────────────────────────────────────────────────────
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  if (!line.includes("=")) continue;
  const i = line.indexOf("=");
  const k = line.slice(0, i).trim();
  const v = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  if (!(k in process.env)) process.env[k] = v;
}
const APPLY = process.argv.includes("--apply");
const CUTOFF = (process.argv.find((a) => a.startsWith("--cutoff=")) || "").split("=")[1] || null;

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/** MMYY minus one month, with year rollover. "0532"→"0432", "0132"→"1231". */
function decrementMonth(mmyy) {
  if (!/^\d{4}$/.test(mmyy)) return null;
  let mm = +mmyy.slice(0, 2);
  let yy = +mmyy.slice(2, 4);
  if (!(mm >= 1 && mm <= 12)) return null;
  mm -= 1;
  if (mm === 0) { mm = 12; yy = (yy - 1 + 100) % 100; }
  return `${String(mm).padStart(2, "0")}${String(yy).padStart(2, "0")}`;
}

async function main() {
  console.log(`\n=== token-expiry backfill — ${APPLY ? "APPLY (writing)" : "DRY-RUN (no writes)"}${CUTOFF ? ` · cutoff<${CUTOFF}` : ""} ===\n`);

  const { data: rows, error } = await sb
    .from("customer_payment_methods")
    .select("id, user_id, first6, last4, expiry_mmyy, status, created_at")
    .order("created_at", { ascending: true });
  if (error) { console.error("read customer_payment_methods failed:", error.message); process.exit(1); }

  // Already-corrected rows (idempotency guard) — never touched again.
  const { data: logged } = await sb.from("token_expiry_backfill_log").select("payment_method_id");
  const done = new Set((logged ?? []).map((r) => r.payment_method_id));

  const plan = [];
  const skipped = { alreadyDone: 0, cutoff: 0, badExpiry: 0 };
  for (const r of rows ?? []) {
    if (done.has(r.id)) { skipped.alreadyDone++; continue; }
    if (CUTOFF && r.created_at >= CUTOFF) { skipped.cutoff++; continue; }
    const next = decrementMonth(r.expiry_mmyy ?? "");
    if (!next) { skipped.badExpiry++; console.log(`  SKIP (bad expiry) ${r.id} last4=${r.last4} expiry=${r.expiry_mmyy}`); continue; }
    plan.push({ ...r, next });
  }

  // Preview: before → after for every row to be changed.
  console.log(`Rows to correct: ${plan.length}  ·  skipped: already-done=${skipped.alreadyDone}, cutoff=${skipped.cutoff}, bad-expiry=${skipped.badExpiry}\n`);
  console.log("  card (first6..last4) | before → after | id | note");
  for (const p of plan) {
    const note = p.last4 === "3634" ? "  ← REAL subscriber (matters for future charges)" : "";
    console.log(`  ${p.first6}..${p.last4} | ${p.expiry_mmyy} → ${p.next} | ${p.id}${note}`);
  }

  if (!APPLY) {
    console.log("\nDRY-RUN only — nothing written. Re-run with --apply (once) to commit.\n");
    return;
  }

  // Apply: claim in the log FIRST (idempotency), then update. If a claim already
  // exists (race / prior run), skip. Never decrement a row twice.
  let corrected = 0, claimSkipped = 0;
  for (const p of plan) {
    const { data: claim } = await sb
      .from("token_expiry_backfill_log")
      .upsert(
        { payment_method_id: p.id, original_expiry_mmyy: p.expiry_mmyy, new_expiry_mmyy: p.next },
        { onConflict: "payment_method_id", ignoreDuplicates: true },
      )
      .select("payment_method_id");
    if (!claim || claim.length === 0) { claimSkipped++; continue; } // already logged
    const { error: upErr } = await sb.from("customer_payment_methods").update({ expiry_mmyy: p.next }).eq("id", p.id);
    if (upErr) { console.error(`  UPDATE FAILED ${p.id}: ${upErr.message} (logged; will NOT re-decrement — fix manually)`); continue; }
    corrected++;
  }

  // Verify: every applied row's expiry now equals its logged new value.
  const { data: verify } = await sb
    .from("token_expiry_backfill_log")
    .select("payment_method_id, new_expiry_mmyy, customer_payment_methods(expiry_mmyy, last4)");
  const mismatches = (verify ?? []).filter((v) => {
    const pm = Array.isArray(v.customer_payment_methods) ? v.customer_payment_methods[0] : v.customer_payment_methods;
    return pm && pm.expiry_mmyy !== v.new_expiry_mmyy;
  });
  console.log(`\nAPPLIED: corrected=${corrected}, already-logged-skipped=${claimSkipped}, mismatches=${mismatches.length}`);
  if (mismatches.length) console.log("  MISMATCHES (logged but expiry differs — investigate):", JSON.stringify(mismatches));
  console.log("");
}

main().catch((e) => { console.error(e); process.exit(1); });
