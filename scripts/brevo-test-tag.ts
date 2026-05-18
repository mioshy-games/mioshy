/**
 * Manual smoke test for the Brevo segmentation sync layer.
 *
 * Usage:
 *   npm run brevo:test-tag -- <email> <segment> [lang] [amount]
 *
 * Segments:
 *   interested        npm run brevo:test-tag -- itzik@uxellent.com interested he
 *   registered        npm run brevo:test-tag -- itzik@uxellent.com registered he
 *   journey           npm run brevo:test-tag -- itzik@uxellent.com journey he 219
 *   journey-couple    npm run brevo:test-tag -- partner@example.com journey-couple en
 *   adults            npm run brevo:test-tag -- itzik@uxellent.com adults he 127
 *   games             npm run brevo:test-tag -- itzik@uxellent.com games he 37
 *   ungames           npm run brevo:test-tag -- itzik@uxellent.com ungames
 *
 * Requires .env.local with BREVO_API_KEY and BREVO_LIST_* present.
 * Loads it via Node's --env-file (passed below in the npm script).
 */

// Import the core (un-guarded) module so this script can run via tsx
// outside Next.js's RSC context. The wrapper at
// @/lib/email/brevo-segments-sync would pull in `server-only` and crash
// on import.
import {
  tagAsInterested,
  tagAsRegistered,
  tagAsJourneyMember,
  tagAsJourneyCouple,
  tagAsAdultsBuyer,
  tagAsGamesSubscriber,
  untagGamesSubscriber,
} from "@/lib/email/brevo-segments-sync-core";

type Segment =
  | "interested"
  | "registered"
  | "journey"
  | "journey-couple"
  | "adults"
  | "games"
  | "ungames";

function usage(): never {
  console.error(
    "Usage: npm run brevo:test-tag -- <email> <segment> [lang=he] [amount=0]",
  );
  console.error(
    "Segments: interested, registered, journey, journey-couple, adults, games, ungames",
  );
  process.exit(1);
}

async function main() {
  const [, , email, segment, langArg, amountArg] = process.argv;

  if (!email || !segment) usage();
  const lang = (langArg ?? "he") as "he" | "en";
  if (lang !== "he" && lang !== "en") {
    console.error(`Invalid language: ${langArg} (expected 'he' or 'en')`);
    process.exit(1);
  }
  const amount = Number(amountArg ?? 0);

  // Synthetic UUID for local testing — Brevo only uses it as ext_id.
  const userId = `test-${Math.random().toString(36).slice(2, 10)}`;

  console.log(
    `\n→ ${segment} :: ${email} (lang=${lang}, amount=${amount}, userId=${userId})\n`,
  );

  let result: { success: boolean; error?: string };
  switch (segment as Segment) {
    case "interested":
      result = await tagAsInterested(email, lang, "warm_list");
      break;
    case "registered":
      result = await tagAsRegistered(email, userId, lang);
      break;
    case "journey":
      result = await tagAsJourneyMember(email, userId, lang, amount || 219);
      break;
    case "journey-couple":
      result = await tagAsJourneyCouple(email, userId, lang, "partner-id");
      break;
    case "adults":
      result = await tagAsAdultsBuyer(
        email,
        userId,
        lang,
        "single",
        amount || 127,
      );
      break;
    case "games":
      result = await tagAsGamesSubscriber(email, userId, lang, amount || 37);
      break;
    case "ungames":
      result = await untagGamesSubscriber(email);
      break;
    default:
      console.error(`Unknown segment: ${segment}`);
      usage();
  }

  if (result.success) {
    console.log("✓ success — open Brevo and confirm the contact moved lists.");
    process.exit(0);
  } else {
    console.error(`✗ failed: ${result.error ?? "unknown error"}`);
    process.exit(2);
  }
}

void main();
