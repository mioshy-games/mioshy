#!/usr/bin/env node
/**
 * scripts/cms-add-keys.mjs
 *
 * Phase 2 (Sprint 4 #3) helper — bulk-adds bilingual CMS keys to
 * messages/he.json and messages/en.json.
 *
 * Input JSON (stdin):
 *   {
 *     "journey.assessment.authGate.title": { "he": "…", "en": "…" },
 *     "journey.assessment.authGate.body":  { "he": "…", "en": "…" },
 *     ...
 *   }
 *
 * Behaviour:
 *   - For each dotted key, sets the value at the corresponding nested
 *     path in messages/he.json + messages/en.json.
 *   - Creates parent objects as needed.
 *   - SKIPS keys that already exist (idempotent re-runs).
 *   - Prints a per-key summary (added / skipped).
 *
 * The new keys land in cms_texts only after we re-run
 *   node --env-file=.env.local scripts/seed-cms-texts.mjs
 * which is idempotent (ON CONFLICT DO NOTHING).
 *
 * Why not edit JSON files inline via the Edit tool: 800+ keys spread
 * across ~30 components is too brittle for manual JSON surgery.
 * This script does the same job with dotted-path lookups.
 */

import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function setDeep(obj, dottedKey, value) {
  const parts = dottedKey.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!(p in cur) || typeof cur[p] !== "object" || cur[p] === null) {
      cur[p] = {};
    }
    cur = cur[p];
  }
  const last = parts[parts.length - 1];
  if (last in cur) return false; // already exists — don't overwrite
  cur[last] = value;
  return true;
}

async function loadJson(path) {
  const raw = await readFile(path, "utf-8");
  return JSON.parse(raw);
}

async function saveJson(path, data) {
  await writeFile(path, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

async function main() {
  // Read input JSON from stdin
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  let payload;
  try {
    payload = JSON.parse(input);
  } catch (err) {
    console.error("Invalid JSON input:", err.message);
    process.exit(1);
  }

  const hePath = join(REPO_ROOT, "messages/he.json");
  const enPath = join(REPO_ROOT, "messages/en.json");
  const [he, en] = await Promise.all([loadJson(hePath), loadJson(enPath)]);

  let added = 0;
  let skipped = 0;
  for (const [key, val] of Object.entries(payload)) {
    if (typeof val !== "object" || val === null || !("he" in val) || !("en" in val)) {
      console.warn(`SKIP ${key} — value must be { he, en }`);
      continue;
    }
    const heOk = setDeep(he, key, val.he);
    const enOk = setDeep(en, key, val.en);
    if (heOk && enOk) {
      added++;
      console.log(`+ ${key}`);
    } else if (!heOk && !enOk) {
      skipped++;
      console.log(`= ${key}  (already present)`);
    } else {
      // Partial — one side already had the key; force-set the missing side
      if (!heOk) {
        // Overwrite check skipped above; re-do via direct write
        const parts = key.split(".");
        let cur = he;
        for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
        cur[parts[parts.length - 1]] = val.he;
      }
      if (!enOk) {
        const parts = key.split(".");
        let cur = en;
        for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
        cur[parts[parts.length - 1]] = val.en;
      }
      added++;
      console.log(`± ${key}  (filled missing side)`);
    }
  }

  await Promise.all([saveJson(hePath, he), saveJson(enPath, en)]);
  console.log(`\nDone. Added ${added}, skipped ${skipped} (already present).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
