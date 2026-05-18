#!/usr/bin/env node
// ============================================================
// Brevo Segmentation v2 — one-shot bootstrap
// ============================================================
// Creates (or reuses):
//   - 1 folder:      "Mioshy Segments v2"
//   - 7 lists:       interested_no_purchase, registered_no_purchase,
//                    journey_member, journey_couple,
//                    adults_buyer, games_subscriber, existing_customer
//   - 7 attributes:  LANGUAGE, SIGNUP_DATE, LAST_PURCHASE_DATE,
//                    TOTAL_SPENT, PRODUCTS_OWNED, HAS_PARTNER, USER_SOURCE
//
// Then appends the resulting IDs to .env.local (never overwriting existing
// keys) and rewrites lib/email/brevo-segments.ts (idempotent, same content
// regardless of how many times this runs).
//
// Safe to re-run. Exits non-zero on the first hard failure.
//
// Usage:
//   node scripts/brevo-bootstrap-segments.mjs
//
// Requires Node 18+ (uses global fetch).
// ============================================================

import {
  readFileSync,
  writeFileSync,
  existsSync,
  appendFileSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), "..");
const ENV_PATH = resolve(ROOT, ".env.local");
const TS_PATH = resolve(ROOT, "lib/email/brevo-segments.ts");

const BASE = "https://api.brevo.com/v3";
const FOLDER_NAME = "Mioshy Segments v2";

const LIST_NAMES = [
  ["INTERESTED", "interested_no_purchase"],
  ["REGISTERED", "registered_no_purchase"],
  ["JOURNEY_MEMBER", "journey_member"],
  ["JOURNEY_COUPLE", "journey_couple"],
  ["ADULTS", "adults_buyer"],
  ["GAMES", "games_subscriber"],
  ["EXISTING", "existing_customer"],
];

const ATTRS = [
  { name: "LANGUAGE", type: "text" },
  { name: "SIGNUP_DATE", type: "date" },
  { name: "LAST_PURCHASE_DATE", type: "date" },
  { name: "TOTAL_SPENT", type: "float" },
  { name: "PRODUCTS_OWNED", type: "text" },
  { name: "HAS_PARTNER", type: "boolean" },
  { name: "USER_SOURCE", type: "text" },
];

// ---------- env loader ----------
function loadEnv() {
  if (!existsSync(ENV_PATH)) {
    throw new Error(`.env.local not found at ${ENV_PATH}`);
  }
  const text = readFileSync(ENV_PATH, "utf8");
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function decodeBrevoKey(raw) {
  if (!raw) return null;
  // The value in .env.local is a base64-wrapped JSON: {"api_key":"xkeysib-..."}.
  // Fall back to raw if it isn't.
  try {
    const obj = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
    if (obj?.api_key && typeof obj.api_key === "string") return obj.api_key;
  } catch {
    /* ignore */
  }
  return raw;
}

const env = loadEnv();
const apiKey = decodeBrevoKey(env.BREVO_API_KEY ?? "");
if (!apiKey || !apiKey.startsWith("xkeysib-")) {
  console.error(
    "[brevo] could not resolve a valid xkeysib- key from BREVO_API_KEY",
  );
  process.exit(1);
}

// ---------- fetch wrapper ----------
async function brevo(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "api-key": apiKey,
      accept: "application/json",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = text;
  }
  if (!res.ok) {
    const err = new Error(
      `Brevo ${method} ${path} → HTTP ${res.status}: ${text.slice(0, 500)}`,
    );
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

async function listAll(path, key) {
  const items = [];
  const limit = 50;
  let offset = 0;
  // hard cap to avoid runaways
  for (let page = 0; page < 50; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const data = await brevo(
      "GET",
      `${path}${sep}limit=${limit}&offset=${offset}`,
    );
    const chunk = data?.[key] ?? [];
    items.push(...chunk);
    if (chunk.length < limit) break;
    offset += limit;
  }
  return items;
}

// ============================================================
// STEP 1: folder
// ============================================================
console.log(`[1/5] folder "${FOLDER_NAME}"`);
const folders = await listAll("/contacts/folders", "folders");
let folder = folders.find((f) => f.name === FOLDER_NAME);
if (folder) {
  console.log(`      reuse  id=${folder.id}`);
} else {
  const created = await brevo("POST", "/contacts/folders", {
    name: FOLDER_NAME,
  });
  folder = { id: created.id, name: FOLDER_NAME };
  console.log(`      create id=${folder.id}`);
}

// ============================================================
// STEP 2: lists inside the folder
// ============================================================
console.log(`\n[2/5] lists in folder ${folder.id}`);
const existingLists = await listAll(
  `/contacts/lists?folderId=${folder.id}`,
  "lists",
);
const listResults = {};
for (const [envKey, name] of LIST_NAMES) {
  let list = existingLists.find((l) => l.name === name);
  if (list) {
    console.log(`      reuse  ${name.padEnd(24)} id=${list.id}`);
  } else {
    const created = await brevo("POST", "/contacts/lists", {
      name,
      folderId: folder.id,
    });
    list = { id: created.id, name };
    console.log(`      create ${name.padEnd(24)} id=${list.id}`);
  }
  listResults[envKey] = list.id;
}

// ============================================================
// STEP 3: attributes
// ============================================================
console.log(`\n[3/5] attributes (category=normal)`);
const allAttrs = await brevo("GET", "/contacts/attributes");
const existingNormal = new Set(
  (allAttrs.attributes ?? [])
    .filter((a) => (a.category ?? "").toLowerCase() === "normal")
    .map((a) => String(a.name).toUpperCase()),
);
const attrResults = [];
for (const a of ATTRS) {
  if (existingNormal.has(a.name)) {
    console.log(`      skip   ${a.name.padEnd(22)} already exists`);
    attrResults.push({ ...a, action: "skipped" });
  } else {
    await brevo("POST", `/contacts/attributes/normal/${a.name}`, {
      type: a.type,
    });
    console.log(`      create ${a.name.padEnd(22)} type=${a.type}`);
    attrResults.push({ ...a, action: "created" });
  }
}

// ============================================================
// STEP 4: .env.local
// ============================================================
console.log(`\n[4/5] .env.local`);
const desired = {
  BREVO_FOLDER_SEGMENTS_V2: folder.id,
  BREVO_LIST_INTERESTED: listResults.INTERESTED,
  BREVO_LIST_REGISTERED: listResults.REGISTERED,
  BREVO_LIST_JOURNEY_MEMBER: listResults.JOURNEY_MEMBER,
  BREVO_LIST_JOURNEY_COUPLE: listResults.JOURNEY_COUPLE,
  BREVO_LIST_ADULTS: listResults.ADULTS,
  BREVO_LIST_GAMES: listResults.GAMES,
  BREVO_LIST_EXISTING: listResults.EXISTING,
};

const envText = readFileSync(ENV_PATH, "utf8");
const toAppendLines = [];
let conflicts = 0;
for (const [k, v] of Object.entries(desired)) {
  const re = new RegExp(`^\\s*${k}\\s*=\\s*(.*?)\\s*$`, "m");
  const m = envText.match(re);
  if (m) {
    if (String(m[1]) !== String(v)) {
      console.log(
        `      conflict ${k} already set to "${m[1]}" — leaving untouched (would be "${v}")`,
      );
      conflicts++;
    } else {
      console.log(`      ok     ${k} already up-to-date`);
    }
  } else {
    toAppendLines.push(`${k}=${v}`);
  }
}

if (toAppendLines.length > 0) {
  const today = new Date().toISOString().slice(0, 10);
  const header = `# Brevo Segmentation v2 - auto-generated ${today}`;
  const headerAlreadyPresent = envText.includes("# Brevo Segmentation v2");
  const block =
    (envText.endsWith("\n") ? "" : "\n") +
    (headerAlreadyPresent ? "" : header + "\n") +
    toAppendLines.join("\n") +
    "\n";
  appendFileSync(ENV_PATH, block);
  console.log(`      append ${toAppendLines.length} line(s)`);
} else {
  console.log(`      ok     all keys already present, nothing appended`);
}

// ============================================================
// STEP 5: regenerate lib/email/brevo-segments.ts
// ============================================================
console.log(`\n[5/5] lib/email/brevo-segments.ts`);
const tsContent = `// ============================================================
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
`;
writeFileSync(TS_PATH, tsContent);
console.log(`      write  ${TS_PATH}`);

// ============================================================
// SUMMARY
// ============================================================
console.log(`\n${"=".repeat(60)}`);
console.log("BOOTSTRAP COMPLETE");
console.log("=".repeat(60));
console.log(`Folder         ${FOLDER_NAME.padEnd(24)} id=${folder.id}`);
console.log(`Lists:`);
for (const [envKey, name] of LIST_NAMES) {
  console.log(
    `  ${envKey.padEnd(15)} ${name.padEnd(24)} id=${listResults[envKey]}`,
  );
}
console.log(`Attributes:`);
for (const a of attrResults) {
  console.log(`  ${a.name.padEnd(22)} ${a.type.padEnd(8)} ${a.action}`);
}
console.log(``);
console.log(`.env.local                    updated`);
console.log(`lib/email/brevo-segments.ts   written`);
if (conflicts > 0) {
  console.log(
    `\n⚠  ${conflicts} env conflict(s) — see "conflict" lines above. Existing .env.local values were preserved; if you want to overwrite, edit .env.local manually and re-run.`,
  );
}
