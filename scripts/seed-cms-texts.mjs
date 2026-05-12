#!/usr/bin/env node
/**
 * scripts/seed-cms-texts.mjs
 *
 * Phase-1 seed for the internal CMS (feature/admin-cms).
 *
 * What it does:
 *   1. Reads messages/he.json + messages/en.json.
 *   2. Flattens both into dot-notation keys.
 *   3. Derives `page` + `section` from each key's top namespace via
 *      the mapping in NAMESPACE_TO_PAGE below.
 *   4. Scans the codebase for usage — keys whose dotted path (or
 *      last-2-segment suffix) appears nowhere in `app/`, `components/`,
 *      `lib/`, or `hooks/` are flagged as ORPHANS and skipped.
 *   5. INSERTs one row per surviving key into `cms_texts`
 *      with `ON CONFLICT (key) DO NOTHING`, so re-running this seed
 *      is safe — it only adds keys that don't already exist.
 *   6. Prints a structured report at the end.
 *
 * How to run:
 *   node --env-file=.env.local scripts/seed-cms-texts.mjs
 *
 * Required env vars (read via --env-file=.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY        (bypasses RLS — this script
 *                                     writes to cms_texts which is
 *                                     admin-only on the API surface)
 *
 * The script never prints the service-role key. It only reports
 * counts and per-key page/section assignments.
 *
 * Add `--dry-run` to skip the INSERTs and just print the report.
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

const DRY_RUN = process.argv.includes("--dry-run");

// ── 1. Configuration ─────────────────────────────────────────────────

/**
 * Top-level JSON namespace → CMS page mapping.
 *
 * Anything not listed here lands in `"shared"` by default. The user
 * can re-classify a namespace post-seed by editing this table and
 * re-running the script with `--dry-run` to preview the diff.
 */
const NAMESPACE_TO_PAGE = {
  // Homepage surface (HomepageV2 marketing flow)
  homeV2: "homepage",
  home: "homepage",
  marketingHome: "homepage",

  // Journey / assessment
  journeyHub: "journey",

  // Games surface
  gamesHub: "games",
  gameLobby: "games",
  gameRoom: "games",
  game: "games",
  snakesGame: "games",

  // Mioshy Sex / product line
  // NOTE: the JSON has a top-level `products` namespace which appears
  // to be the Mioshy Sex catalogue. If your products namespace serves
  // a different surface, edit this line and re-run.
  products: "mioshy-sex",

  // My / dashboard / account
  account: "my",
  dashboard: "my",

  // Shared — appears across multiple pages
  nav: "shared",
  footer: "shared",
  legal: "shared",
  metadata: "shared",
  paywall: "shared",
  pricing: "shared",
  auth: "shared",
  articlePage: "shared",
  articlesPage: "shared",
};

/**
 * For deriving `section` from a key: the second dot segment is used
 * by default. For namespaces where that's not meaningful (e.g.
 * single-section `nav`), we fall back to using the top namespace as
 * the section name. The mapping below overrides this per namespace.
 *
 * If a key has only one segment (rare), section becomes the segment.
 */
const SECTION_OVERRIDES = {
  nav: () => "nav",
  footer: () => "footer",
  legal: () => "legal",
  metadata: () => "metadata",
  paywall: () => "paywall",
  pricing: () => "pricing",
  auth: () => "auth",
  articlePage: () => "article",
  articlesPage: () => "articles",
  account: () => "account",
};

function derivePageAndSection(key) {
  const parts = key.split(".");
  const top = parts[0] || "_root";
  const page = NAMESPACE_TO_PAGE[top] || "shared";
  const sectionFn = SECTION_OVERRIDES[top];
  const section = sectionFn
    ? sectionFn(key)
    : parts.length >= 2
      ? parts[1]
      : top;
  return { page, section };
}

// ── 2. Flatten JSON ──────────────────────────────────────────────────

/**
 * Recursive flatten — every leaf string in the JSON becomes a single
 * dotted key. Numbers, booleans, and arrays of strings are coerced
 * to TEXT and treated as leaves. Objects are recursed into. Arrays
 * of objects (rare in next-intl JSON) are dropped with a warning.
 */
function flatten(obj, prefix = "", out = new Map()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v === null || v === undefined) continue;
    if (typeof v === "string") {
      out.set(key, v);
    } else if (typeof v === "number" || typeof v === "boolean") {
      out.set(key, String(v));
    } else if (Array.isArray(v)) {
      // next-intl supports arrays of strings via `t.raw` — keep them
      // as JSON-encoded strings so they round-trip.
      if (v.every((x) => typeof x === "string")) {
        out.set(key, JSON.stringify(v));
      } else {
        console.warn(`[seed] skipping array-of-objects at "${key}"`);
      }
    } else if (typeof v === "object") {
      flatten(v, key, out);
    }
  }
  return out;
}

// ── 3. Orphan detection ──────────────────────────────────────────────

/**
 * Walks the source tree under app/, components/, lib/, hooks/, then
 * returns a Set of every line in every .ts/.tsx/.mjs/.js file. Used
 * by `isKeyUsed` to do substring lookups without re-reading files
 * per key.
 *
 * Skips: .next, node_modules, .git, messages/ (the JSON itself
 * obviously contains the keys), supabase/migrations/, public/.
 */
async function collectSourceCorpus() {
  const targets = ["app", "components", "lib", "hooks", "middleware.ts"];
  const exts = [".ts", ".tsx", ".mjs", ".js"];
  const collected = [];

  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (entry.name === "node_modules") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (exts.some((e) => entry.name.endsWith(e))) {
        try {
          collected.push(await readFile(full, "utf-8"));
        } catch {}
      }
    }
  }

  for (const t of targets) {
    const full = join(REPO_ROOT, t);
    try {
      const s = await stat(full);
      if (s.isDirectory()) await walk(full);
      else if (s.isFile()) collected.push(await readFile(full, "utf-8"));
    } catch {}
  }

  return collected.join("\n\n");
}

/**
 * Pragmatic V1 heuristic — extract every namespace passed to
 * next-intl's translator hooks/functions, then a key is "used" if
 * one of those namespaces is a prefix of the key.
 *
 * Patterns we extract from:
 *   useTranslations("ns")     useTranslations('ns')     useTranslations(`ns`)
 *   getTranslations("ns")     getTranslations({ namespace: "ns" })
 *   getTranslator("ns")
 *
 * Plus: keys that appear as quoted string literals on their own
 * (e.g. `t("homeV2.hero.tag")` with the full dotted path) are also
 * considered used — this covers any code that doesn't go through
 * a namespace.
 *
 * `useTranslations()` with NO argument resolves the root namespace
 * — when we see that, we treat every JSON key as reachable.
 */
function extractActiveNamespaces(corpus) {
  const namespaces = new Set();
  let rootNamespaceUsed = false;

  // Match useTranslations("…") / getTranslations("…") / getTranslator("…")
  const fnNames = "(?:useTranslations|getTranslations|getTranslator)";
  const reArg = new RegExp(`${fnNames}\\s*\\(\\s*["'\\\`]([^"'\\\`]+)["'\\\`]`, "g");
  let m;
  while ((m = reArg.exec(corpus)) !== null) namespaces.add(m[1]);

  // Match useTranslations() with no args → root namespace
  const reEmpty = new RegExp(`${fnNames}\\s*\\(\\s*\\)`, "g");
  if (reEmpty.test(corpus)) rootNamespaceUsed = true;

  // Match getTranslations({ namespace: "…" })
  const reObj = /getTranslations\s*\(\s*\{[^}]*namespace\s*:\s*["'`]([^"'`]+)["'`]/g;
  while ((m = reObj.exec(corpus)) !== null) namespaces.add(m[1]);

  return { namespaces, rootNamespaceUsed };
}

function isKeyUsed(key, { namespaces, rootNamespaceUsed }, corpus) {
  if (rootNamespaceUsed) return true;
  // Direct hit — the full dotted key appears somewhere as a literal.
  // Cheap-and-flexible catch-all for code that calls
  // `t("homeV2.hero.tag")` without a namespace prefix.
  if (corpus.includes(`"${key}"`) || corpus.includes(`'${key}'`)) return true;
  // Namespace-prefix match.
  for (const ns of namespaces) {
    if (key === ns) return true;
    if (key.startsWith(ns + ".")) return true;
  }
  return false;
}

// ── 4. Main ──────────────────────────────────────────────────────────

async function main() {
  console.log("─".repeat(72));
  console.log("CMS seed — Phase 1");
  console.log(`Repo: ${REPO_ROOT}`);
  console.log(`Mode: ${DRY_RUN ? "DRY-RUN (no DB writes)" : "LIVE"}`);
  console.log("─".repeat(72));

  // Load env (only required for live writes)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!DRY_RUN && (!url || !serviceKey)) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
    );
    console.error(
      "Run with: node --env-file=.env.local scripts/seed-cms-texts.mjs",
    );
    process.exit(1);
  }

  // Load JSONs
  const heJson = JSON.parse(
    await readFile(join(REPO_ROOT, "messages/he.json"), "utf-8"),
  );
  const enJson = JSON.parse(
    await readFile(join(REPO_ROOT, "messages/en.json"), "utf-8"),
  );
  const heMap = flatten(heJson);
  const enMap = flatten(enJson);
  console.log(`Flattened: HE=${heMap.size} keys, EN=${enMap.size} keys`);

  // Union of keys — a key counts if it appears in either language.
  const allKeys = new Set([...heMap.keys(), ...enMap.keys()]);
  console.log(`Union: ${allKeys.size} unique keys`);

  // Build source corpus for orphan detection
  console.log("Scanning source files for key references…");
  const corpus = await collectSourceCorpus();
  console.log(`Corpus: ${(corpus.length / 1024).toFixed(0)} KB`);
  const activeNs = extractActiveNamespaces(corpus);
  console.log(
    `Active next-intl namespaces: ${activeNs.namespaces.size}${activeNs.rootNamespaceUsed ? " (+ root)" : ""}`,
  );

  // Build rows + orphan stats
  const rows = [];
  const orphans = [];
  const pageStats = {};
  const onlyHe = [];
  const onlyEn = [];

  for (const key of allKeys) {
    const used = isKeyUsed(key, activeNs, corpus);
    if (!used) {
      orphans.push(key);
      continue;
    }
    const { page, section } = derivePageAndSection(key);
    pageStats[page] = (pageStats[page] || 0) + 1;
    const he = heMap.get(key);
    const en = enMap.get(key);
    if (he && !en) onlyHe.push(key);
    if (en && !he) onlyEn.push(key);
    rows.push({
      key,
      page,
      section,
      he_text: he ?? null,
      en_text: en ?? null,
    });
  }

  // Report — phase 1 of report (always shown)
  console.log("─".repeat(72));
  console.log(`Migration plan:`);
  console.log(`  Total keys candidate:   ${allKeys.size}`);
  console.log(`  Orphan (skipped):       ${orphans.length}`);
  console.log(`  Will write:             ${rows.length}`);
  console.log(`  HE-only (no EN twin):   ${onlyHe.length}  ← needs review`);
  console.log(`  EN-only (no HE twin):   ${onlyEn.length}  ← needs review`);
  console.log(``);
  console.log(`Per-page breakdown of writes:`);
  for (const [p, n] of Object.entries(pageStats).sort()) {
    console.log(`  ${p.padEnd(12)}  ${n}`);
  }

  if (orphans.length > 0) {
    console.log(``);
    console.log(`Sample orphan keys (first 20):`);
    for (const k of orphans.slice(0, 20)) console.log(`  - ${k}`);
    if (orphans.length > 20) console.log(`  … and ${orphans.length - 20} more`);
  }

  if (onlyHe.length > 0) {
    console.log(``);
    console.log(`HE-only keys (first 10):`);
    for (const k of onlyHe.slice(0, 10)) console.log(`  - ${k}`);
  }

  if (onlyEn.length > 0) {
    console.log(``);
    console.log(`EN-only keys (first 10):`);
    for (const k of onlyEn.slice(0, 10)) console.log(`  - ${k}`);
  }

  if (DRY_RUN) {
    console.log("─".repeat(72));
    console.log("Dry-run — no rows written. Re-run without --dry-run to apply.");
    return;
  }

  // Bulk INSERT in batches of 500 with ON CONFLICT (key) DO NOTHING
  console.log("─".repeat(72));
  console.log("Writing to Supabase…");
  const sb = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const BATCH = 500;
  let inserted = 0;
  let alreadyExisted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    // upsert with ignoreDuplicates leans on the UNIQUE(key) constraint
    // to skip existing rows without overwriting them.
    const { data, error } = await sb
      .from("cms_texts")
      .upsert(batch, { onConflict: "key", ignoreDuplicates: true })
      .select("id");
    if (error) {
      console.error(`  Batch ${i}-${i + batch.length} failed:`, error.message);
      process.exit(1);
    }
    const written = data?.length ?? 0;
    inserted += written;
    alreadyExisted += batch.length - written;
    console.log(
      `  Batch ${i}-${i + batch.length}: ${written} new, ${batch.length - written} skipped (already in DB)`,
    );
  }

  console.log("─".repeat(72));
  console.log(`Done.`);
  console.log(`  Newly inserted:         ${inserted}`);
  console.log(`  Already existed:        ${alreadyExisted}`);
  console.log(`  Orphans (skipped):      ${orphans.length}`);
  console.log(`  HE-only flagged:        ${onlyHe.length}`);
  console.log(`  EN-only flagged:        ${onlyEn.length}`);
  console.log("─".repeat(72));
}

main().catch((err) => {
  console.error("[seed] fatal:", err);
  process.exit(1);
});
