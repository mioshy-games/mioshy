/**
 * /[locale]/mioshy-sex/[slug]/play - POST-PURCHASE GAME SURFACE.
 *
 * Reusable game-experience template. Designed once, fits every game
 * we add to the catalogue - the structure adapts to whatever
 * content rows + full_desc the admin saves for that game.
 *
 * Visual direction
 * ────────────────
 * Dark / sexy / playful - NOT an article. Bigger typography, magazine
 * layout, alternating two-column stage cards, role-coded sections
 * (blue for "him", red for "her") parsed from the full_desc text,
 * a sparkle burst on first load to mark the unlock moment, and a
 * blue+red animated mood-lighting layer that drifts behind everything.
 *
 * Access checks (in order)
 * ────────────────────────
 *   1. signed-in user → otherwise → /[locale]/auth?next=…
 *   2. user has couple_id → otherwise → /[locale]/mioshy-sex/[slug]
 *   3. couple owns THIS game → otherwise → /[locale]/mioshy-sex/[slug]
 */

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/navigation";
import {
  ArrowLeft,
  Flame,
  Heart,
  MessageCircleHeart,
  Sparkles,
  Star,
} from "lucide-react";
import { getGameBySlug } from "@/lib/between-us/queries";
import { getCurrentCoupleContext } from "@/lib/between-us/couples";
import { PlayAmbience } from "@/components/adults/PlayAmbience";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { locale: string; slug: string };
}): Promise<Metadata> {
  const { locale, slug } = params;
  const isHe = locale === "he";
  const game = await getGameBySlug(slug).catch(() => null);
  const title = game
    ? isHe
      ? game.title_he
      : game.title_en || game.title_he
    : isHe
      ? "המשחק שלכם"
      : "Your game";
  return {
    // Owners-only - keep out of the index.
    robots: { index: false, follow: false },
    title: `Mioshy - ${title}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Role detection - splits a free-form `full_desc` into typed paragraphs so we
// can render "his" / "hers" sections in their own colour-coded panels.
//
// The admin field is plain text. If they prefix a paragraph with one of
// the patterns below, we tag it as "his" or "hers". Anything else is
// rendered as a regular prose paragraph.
//
// This is pure pattern-matching on the START of each paragraph. The author
// keeps full control by either using or not using the markers.
// ─────────────────────────────────────────────────────────────────────────────

type Role = "his" | "hers" | "prose";

const HIS_PATTERNS = [
  /^\s*תפקיד\s+(?:הגבר|האיש)\s*[:\--–]?/i,
  /^\s*(?:הגבר|האיש)\s*[:\--–]/i,
  /^\s*(?:his\s+role|he)\s*[:\--–]/i,
];
const HERS_PATTERNS = [
  /^\s*תפקיד\s+האישה\s*[:\--–]?/i,
  /^\s*האישה\s*[:\--–]/i,
  /^\s*(?:her\s+role|she)\s*[:\--–]/i,
];

function detectRole(paragraph: string): Role {
  if (HIS_PATTERNS.some((re) => re.test(paragraph))) return "his";
  if (HERS_PATTERNS.some((re) => re.test(paragraph))) return "hers";
  return "prose";
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

// Paragraphs labelled "his" or "hers" usually start with the marker
// followed by a colon - we strip that prefix so the role chip carries
// the label and the body reads cleanly without repetition.
function stripRoleHeader(paragraph: string): string {
  return paragraph.replace(
    /^\s*(?:תפקיד\s+(?:הגבר|האיש|האישה)|(?:הגבר|האיש|האישה|his\s+role|her\s+role|he|she))\s*[:\--–]\s*/i,
    "",
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default async function PlayExperienceGamePage({
  params,
}: {
  params: { locale: string; slug: string };
}) {
  const { locale, slug } = params;
  const isHe = locale === "he";

  const game = await getGameBySlug(slug);
  if (!game) notFound();

  // ── Access gate ─────────────────────────────────────────────────────────
  const ctx = await getCurrentCoupleContext();
  if (!ctx) {
    redirect(
      `/${locale}/auth?next=${encodeURIComponent(
        `/${locale}/mioshy-sex/${slug}/play`,
      )}`,
    );
  }
  if (!ctx.couple_id) {
    redirect(`/${locale}/mioshy-sex/${slug}`);
  }
  const entitled = ctx.entitled_game_ids.has(game.id);
  if (!entitled) {
    redirect(`/${locale}/mioshy-sex/${slug}`);
  }

  // ── Gated payload ───────────────────────────────────────────────────────
  // NOTE: experience_game_content (per-level "stage cards") is intentionally
  // NOT fetched here. Our games are scenario-based - one continuous arc told
  // through `full_desc` + role panels (תפקיד הגבר / תפקיד האישה), not Q&A
  // decks. The card grid produced misleading output (generic seed prompts
  // showing as if they were the game's stages). If we ever add a true
  // Q&A-style game, gate that section behind a per-game flag instead of
  // showing it for every game.
  const title = isHe ? game.title_he : game.title_en || game.title_he;
  const shortDesc = isHe
    ? game.short_desc_he
    : game.short_desc_en || game.short_desc_he;
  const fullDesc = isHe
    ? game.full_desc_he
    : game.full_desc_en || game.full_desc_he;
  const fullDescParas = fullDesc ? splitParagraphs(fullDesc) : [];

  // Optional in-play question reference (only set on games that need
  // it - most don't). When the locale's questions array is empty, the
  // whole "Play questions" section below renders nothing.
  const playQuestionsIntro = (
    isHe ? game.play_questions_intro_he : game.play_questions_intro_en
  )?.trim();
  const playQuestions = (
    (isHe ? game.play_questions_he : game.play_questions_en) ?? []
  ).filter((q): q is string => typeof q === "string" && q.trim().length > 0);

  return (
    <div
      dir={isHe ? "rtl" : "ltr"}
      // `isolate` (CSS isolation: isolate) is REQUIRED so the negative
      // z-index PlayAmbience layer paints inside this wrapper's stacking
      // context - otherwise its bg-[#040114] above paints OVER the fog
      // blobs and you see flat black. See AmbienceDebugProbe for details.
      className="relative isolate min-h-[100dvh] overflow-hidden bg-[#040114] text-white"
    >
      {/* Deep-midnight base - slightly cooler than /adults so the play
          surface feels distinct. The animated PlayAmbience layer paints
          blue + red mood lighting on top. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-20 h-full bg-[linear-gradient(180deg,#040114_0%,#0a0820_25%,#100416_50%,#0a0820_75%,#040114_100%)]"
      />
      <PlayAmbience />

      {/* Outer rail matches the rest of the site (max-w-7xl, mx-auto, px-4)
          so the page sits on the same grid as header & footer - but
          *reading content* inside is capped tighter (≈ max-w-[680px], the
          ~60–70 character optimum for sustained reading per cognitive
          psychology research on saccade jumps). The cover image is
          deliberately sized down from the previous full-bleed treatment;
          for paid digital content the typography has to do the heavy
          lifting, not the photography. */}
      <main className="relative mx-auto max-w-7xl px-4 pb-28 pt-8 sm:pt-12">
        {/* Quiet back link */}
        <Link
          href="/my/adults"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-white/60 transition hover:text-white/95"
          style={{ fontFamily: "var(--font-body-hebrew), 'Assistant', system-ui, sans-serif" }}
        >
          <ArrowLeft className={`h-3.5 w-3.5 ${isHe ? "rotate-180" : ""}`} />
          {isHe ? "הגלריה שלכם" : "Your gallery"}
        </Link>

        {/* ───── HERO ─────
            Centered reading column. Title stays in Frank Ruhl serif (it's
            display) but everything below - eyebrow, lede, levels - uses
            Assistant for cleaner readability against the dark surface. */}
        <section className="relative mx-auto mt-10 max-w-[680px]">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-100"
            style={{ fontFamily: "var(--font-body-hebrew), 'Assistant', system-ui, sans-serif" }}
          >
            <Sparkles className="h-3 w-3" />
            {isHe ? "המשחק שלכם · נפתח" : "Your game · unlocked"}
          </span>

          <div className="relative mt-6">
            <PlaySparkleBurst />
            <h1
              className="relative z-[1] text-balance text-[40px] leading-[1.02] tracking-[-0.02em] sm:text-[52px] lg:text-[60px]"
              style={{
                fontFamily: "'Frank Ruhl Libre', serif",
                fontWeight: 700,
              }}
            >
              <span className="block bg-gradient-to-br from-white via-rose-100 to-amber-200 bg-clip-text text-transparent">
                {title}
              </span>
            </h1>
          </div>

          {shortDesc ? (
            <p
              className="mt-5 text-[17px] leading-[1.6] text-white/85 sm:text-[18px]"
              style={{ fontFamily: "var(--font-body-hebrew), 'Assistant', system-ui, sans-serif" }}
            >
              {shortDesc}
            </p>
          ) : null}

          {/* Levels strip - quick reminder of the intensity profile */}
          <div className="mt-6 flex flex-wrap gap-2.5">
            <LevelChip
              icon={<Heart className="h-3.5 w-3.5 text-rose-200" />}
              label={isHe ? "אינטימיות" : "Intimacy"}
              level={game.intimacy_level}
            />
            <LevelChip
              icon={<MessageCircleHeart className="h-3.5 w-3.5 text-sky-200" />}
              label={isHe ? "תקשורת" : "Communication"}
              level={game.communication_level}
            />
            <LevelChip
              icon={<Flame className="h-3.5 w-3.5 text-orange-200" />}
              label={isHe ? "חום" : "Heat"}
              level={game.heat_level}
            />
          </div>

          {/* Cover image - capped to the same reading column width
              (680px) at a 16:10 ratio so it doesn't dwarf the text. The
              previous full-bleed cover at max-w-7xl was ~6× taller than
              the next paragraph, breaking the visual hierarchy of a
              text-led product. */}
          {game.cover_image_url ? (
            <figure className="relative mt-10 overflow-hidden rounded-[24px] border border-white/12 shadow-[0_30px_70px_-25px_rgba(124,58,237,0.55)]">
              <div className="aspect-[16/10] w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={game.cover_image_url}
                  alt={title}
                  className="h-full w-full object-cover"
                />
              </div>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/65 via-black/25 to-transparent"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-rose-300/60 to-transparent"
              />
            </figure>
          ) : null}
        </section>

        {/* ───── THE STORY (full_desc) ─────
            Reading column stays capped at 680px. Body switches to
            Assistant (var(--font-body-hebrew)) - Frank Ruhl Libre is a
            display serif and was punishing to read at 18px on the dark
            ground. Sans + 17–18px + 1.75 leading + white/90 contrast is
            the configuration that actually reads. */}
        {fullDescParas.length > 0 ? (
          <section className="relative mx-auto mt-20 max-w-[680px]">
            <SectionEyebrow>
              {isHe ? "הסיפור שלכם" : "Your story"}
            </SectionEyebrow>
            <h2
              className="mt-5 text-balance text-[28px] leading-[1.15] tracking-[-0.01em] text-white sm:text-[34px]"
              style={{ fontFamily: "'Frank Ruhl Libre', serif", fontWeight: 700 }}
            >
              {isHe ? (
                <>
                  מהפתיחה{" "}
                  <span
                    className="bg-gradient-to-br from-rose-200 via-rose-400 to-amber-300 bg-clip-text text-transparent"
                    style={{ fontStyle: "italic", fontWeight: 500 }}
                  >
                    ועד השיא.
                  </span>
                </>
              ) : (
                <>
                  From overture{" "}
                  <span
                    className="bg-gradient-to-br from-rose-200 via-rose-400 to-amber-300 bg-clip-text text-transparent"
                    style={{ fontStyle: "italic", fontWeight: 500 }}
                  >
                    to climax.
                  </span>
                </>
              )}
            </h2>

            <div className="mt-8 space-y-5">
              {fullDescParas.map((p, i) => {
                const role = detectRole(p);
                if (role === "his") {
                  return (
                    <RolePanel
                      key={i}
                      tone="his"
                      labelHe="תפקיד הגבר"
                      labelEn="His role"
                      isHe={isHe}
                      body={stripRoleHeader(p)}
                    />
                  );
                }
                if (role === "hers") {
                  return (
                    <RolePanel
                      key={i}
                      tone="hers"
                      labelHe="תפקיד האישה"
                      labelEn="Her role"
                      isHe={isHe}
                      body={stripRoleHeader(p)}
                    />
                  );
                }
                // First prose paragraph gets a slightly larger lede so
                // the spread opens with weight before settling into
                // standard body proportions.
                return (
                  <p
                    key={i}
                    className={`whitespace-pre-wrap text-white/90 ${
                      i === 0
                        ? "text-[18px] leading-[1.75] sm:text-[19px]"
                        : "text-[17px] leading-[1.78]"
                    }`}
                    style={{
                      fontFamily:
                        "var(--font-body-hebrew), 'Assistant', system-ui, sans-serif",
                    }}
                  >
                    {p}
                  </p>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* ───── PLAY QUESTIONS - optional reference list ─────
            Only renders when the admin saved at least one question for
            this game in the active locale. Display-only: no answer
            input, no submit, no scoring - just the numbered list the
            couple reads from at the table when their physical-game
            trigger fires (drew a card / landed on a tile / etc). */}
        {playQuestions.length > 0 ? (
          <section className="relative mx-auto mt-24 max-w-[680px]">
            <SectionEyebrow>
              {isHe ? "השאלות של המשחק" : "The game's questions"}
            </SectionEyebrow>

            <h2
              className="mt-5 text-balance text-[24px] leading-[1.25] tracking-[-0.01em] text-white sm:text-[28px]"
              style={{ fontFamily: "'Frank Ruhl Libre', serif", fontWeight: 700 }}
            >
              {playQuestionsIntro && playQuestionsIntro.length > 0
                ? playQuestionsIntro
                : isHe
                  ? "ענו על השאלה הבאה - לפי הסדר או לבחירתכם."
                  : "Answer the next question - in order or as you wish."}
            </h2>

            <ol className="mt-8 space-y-3 list-none p-0">
              {playQuestions.map((q, i) => (
                <li
                  key={i}
                  className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 backdrop-blur-md transition hover:border-rose-300/40 hover:bg-white/[0.06] sm:px-6 sm:py-5"
                >
                  <span
                    className="flex-shrink-0 text-[24px] leading-none tracking-[0.04em] text-rose-300 sm:text-[28px]"
                    style={{
                      fontFamily: "'Frank Ruhl Libre', serif",
                      fontStyle: "italic",
                      fontWeight: 500,
                    }}
                    aria-hidden
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p
                    className="text-[17px] leading-[1.7] text-white/92"
                    style={{
                      fontFamily:
                        "var(--font-body-hebrew), 'Assistant', system-ui, sans-serif",
                    }}
                  >
                    {q}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {/* ───── CLOSING ───── */}
        <section className="mx-auto mt-24 max-w-[680px] rounded-[28px] border border-rose-300/25 bg-gradient-to-br from-rose-500/12 via-violet-600/10 to-blue-600/10 p-8 text-center backdrop-blur sm:p-10">
          <Star className="mx-auto h-5 w-5 text-rose-200" />
          <p
            className="mx-auto mt-4 max-w-md text-[17px] leading-[1.65] text-white/90"
            style={{
              fontFamily:
                "var(--font-body-hebrew), 'Assistant', system-ui, sans-serif",
            }}
          >
            {isHe
              ? "אין סדר נכון. אין מהירות נכונה. כל מה שמתאים לכם - זה הנכון."
              : "There's no right order. No right pace. Whatever fits the two of you - that's right."}
          </p>
        </section>
      </main>

      {/* Sparkle keyframes - same as the marketing hero burst (one-shot,
          honours prefers-reduced-motion). */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes mio-play-spark {
              0%   { transform: translate(0, 0) scale(0.3); opacity: 0; }
              4%   { transform: translate(0, 0) scale(1.4); opacity: 1; }
              12%  { transform: translate(calc(var(--dx, 0px) * 0.30), calc(var(--dy, 0px) * 0.30)) scale(1); opacity: 1; }
              45%  { transform: translate(calc(var(--dx, 0px) * 0.75), calc(var(--dy, 0px) * 0.75)) scale(0.85); opacity: 0.85; }
              80%  { transform: translate(calc(var(--dx, 0px) * 0.95), calc(var(--dy, 0px) * 0.95)) scale(0.5); opacity: 0.4; }
              100% { transform: translate(var(--dx, 0px), var(--dy, 0px)) scale(0); opacity: 0; }
            }
            .mio-play-spark {
              animation: mio-play-spark 4s cubic-bezier(0.18, 0.7, 0.25, 1) 1 forwards;
            }
            @keyframes mio-play-flash {
              0%   { transform: scale(0.1); opacity: 0; }
              4%   { transform: scale(0.4); opacity: 1; }
              10%  { transform: scale(0.85); opacity: 0.95; }
              35%  { transform: scale(1.4); opacity: 0.55; }
              70%  { transform: scale(1.85); opacity: 0.20; }
              100% { transform: scale(2.2); opacity: 0; }
            }
            .mio-play-flash {
              animation: mio-play-flash 4s cubic-bezier(0.16, 0.7, 0.3, 1) 1 forwards;
              filter: blur(2px);
              will-change: transform, opacity;
            }
            @keyframes mio-play-static-flash {
              0%   { opacity: 0; }
              10%  { opacity: 1; }
              60%  { opacity: 0.6; }
              100% { opacity: 0; }
            }
            @media (prefers-reduced-motion: reduce) {
              .mio-play-spark {
                animation: mio-play-static-flash 2.5s ease-out 1 forwards !important;
                transform: translate(var(--dx, 0px), var(--dy, 0px)) !important;
              }
              .mio-play-flash {
                animation: mio-play-static-flash 2.5s ease-out 1 forwards !important;
                transform: scale(1.4) !important;
              }
            }
          `,
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────────

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.32em] text-rose-200/90"
      style={{
        fontFamily:
          "var(--font-body-hebrew), 'Assistant', system-ui, sans-serif",
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.7)]" />
      {children}
    </span>
  );
}

function LevelChip({
  icon,
  label,
  level,
}: {
  icon: React.ReactNode;
  label: string;
  level: number;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-3 py-1 text-[12px] text-white/90 backdrop-blur"
      style={{
        fontFamily:
          "var(--font-body-hebrew), 'Assistant', system-ui, sans-serif",
      }}
    >
      {icon}
      <span className="font-semibold">{label}</span>
      <span className="text-white/45">·</span>
      <span className="font-semibold text-white">{level}/5</span>
    </span>
  );
}

// Role-coded panel - "his" gets a deep-blue accent rail + chip; "hers"
// gets a deep-red one. Body text styling stays consistent so the eye
// can compare them side-by-side as the couple reads through.
function RolePanel({
  tone,
  labelHe,
  labelEn,
  isHe,
  body,
}: {
  tone: "his" | "hers";
  labelHe: string;
  labelEn: string;
  isHe: boolean;
  body: string;
}) {
  const accent =
    tone === "his"
      ? {
          rail: "bg-gradient-to-b from-blue-400/0 via-blue-400/70 to-blue-400/0",
          chipBg: "bg-blue-500/15 border-blue-300/40 text-blue-100",
          glyph: "♂",
          panelBg:
            "from-blue-600/10 via-blue-700/[0.06] to-transparent",
        }
      : {
          rail: "bg-gradient-to-b from-rose-400/0 via-rose-400/70 to-rose-400/0",
          chipBg: "bg-rose-500/15 border-rose-300/40 text-rose-100",
          glyph: "♀",
          panelBg:
            "from-rose-600/12 via-rose-700/[0.06] to-transparent",
        };

  return (
    <div
      className={`relative overflow-hidden rounded-[18px] border border-white/10 bg-gradient-to-br ${accent.panelBg} ps-5 pe-5 py-5 sm:ps-7 sm:pe-7 sm:py-6`}
    >
      {/* Vertical accent rail on the start side */}
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-y-3 start-0 w-[3px] ${accent.rail}`}
      />
      <div className="flex items-baseline gap-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] ${accent.chipBg}`}
          style={{
            fontFamily:
              "var(--font-body-hebrew), 'Assistant', system-ui, sans-serif",
          }}
        >
          <span aria-hidden className="text-base leading-none">
            {accent.glyph}
          </span>
          {isHe ? labelHe : labelEn}
        </span>
      </div>
      <p
        className="mt-3 whitespace-pre-wrap text-[17px] leading-[1.78] text-white/90"
        style={{
          fontFamily:
            "var(--font-body-hebrew), 'Assistant', system-ui, sans-serif",
        }}
      >
        {body}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PlaySparkleBurst - same one-shot burst pattern as the /adults marketing
// hero. Plays once on mount, lasts 4s, then settles. Pure CSS + deterministic
// positions for SSR/hydration parity.
// ─────────────────────────────────────────────────────────────────────────────

function PlaySparkleBurst() {
  const SPARK_COUNT = 28;
  const TINTS = [
    "#fda4af", // rose-300
    "#93c5fd", // blue-300 - for the play page's blue/red duality
    "#f0abfc", // fuchsia-300
    "#fcd34d", // amber-300
    "#ffffff",
  ];
  const sparks = Array.from({ length: SPARK_COUNT }, (_, i) => {
    const baseAngle = (i / SPARK_COUNT) * 2 * Math.PI;
    const jitter = ((i * 13) % 7) * 0.05;
    const angle = baseAngle + jitter;
    const distance = 100 + ((i * 17) % 90);
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;
    const tint = TINTS[i % TINTS.length]!;
    const size = 3 + (i % 4);
    const delay = ((i * 31) % 14) * 0.03;
    return { dx, dy, tint, size, delay };
  });

  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2 z-[2] -translate-x-1/2 -translate-y-1/2"
    >
      <span
        className="mio-play-flash absolute"
        style={{
          left: "50%",
          top: "50%",
          width: "200px",
          height: "200px",
          marginLeft: "-100px",
          marginTop: "-100px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,221,228,0.85) 0%, rgba(244,63,94,0.50) 30%, rgba(124,58,237,0.30) 55%, transparent 75%)",
        }}
      />
      {sparks.map((s, i) => (
        <span
          key={i}
          className="mio-play-spark absolute rounded-full"
          style={{
            width: `${s.size}px`,
            height: `${s.size}px`,
            backgroundColor: s.tint,
            boxShadow: `0 0 ${s.size * 4}px ${s.tint}, 0 0 ${
              s.size * 8
            }px ${s.tint}, 0 0 ${s.size * 12}px rgba(255,255,255,0.4)`,
            animationDelay: `${s.delay}s`,
            ["--dx" as never]: `${s.dx.toFixed(1)}px`,
            ["--dy" as never]: `${s.dy.toFixed(1)}px`,
            left: "50%",
            top: "50%",
            marginLeft: `-${s.size / 2}px`,
            marginTop: `-${s.size / 2}px`,
          }}
        />
      ))}
    </span>
  );
}
