// Plain (non-"use server") module for constants + types shared between the
// admin client and the server actions. A "use server" file can only export
// async functions — moving these here is what avoids the runtime
// "X.map is not a function" errors at import time.

// ── Available internal links (shown in dropdowns) ──────────────────────────
export const HOMEPAGE_LINK_OPTIONS = [
  { label: "Games page (/games)", value: "/games" },
  { label: "Truth or Dare (/games/truth-or-dare)", value: "/games/truth-or-dare" },
  { label: "Snakes & Ladders (/game/local)", value: "/game/local" },
  { label: "Personal Journey (/journey)", value: "/journey" },
  { label: "Articles (/articles)", value: "/articles" },
  { label: "Pricing (/pricing)", value: "/pricing" },
  { label: "How it works (/how-it-works)", value: "/how-it-works" },
  { label: "Contact (/contact)", value: "/contact" },
  { label: "Anchor: Games section (#games)", value: "#games" },
  { label: "Anchor: How it works (#how)", value: "#how" },
  { label: "Anchor: Pricing (#pricing)", value: "#pricing" },
] as const;

// ── Button style presets ───────────────────────────────────────────────────
export const CTA_STYLE_OPTIONS = [
  {
    label: "Gradient (Fuchsia → Purple → Pink)",
    value: "gradient",
    preview: "from-fuchsia-500 via-purple-500 to-pink-500",
  },
  {
    label: "Gradient (Rose → Pink)",
    value: "gradient-rose",
    preview: "from-rose-500 to-pink-500",
  },
  {
    label: "Gradient (Purple → Indigo)",
    value: "gradient-purple",
    preview: "from-purple-700 to-indigo-600",
  },
  {
    label: "Outline Purple (secondary style)",
    value: "outline-purple",
    preview: "border border-purple-400/30 bg-purple-500/10",
  },
  {
    label: "Solid White",
    value: "solid-white",
    preview: "bg-white text-black",
  },
] as const;

// ── Hero template catalog (drives the admin picker — E6) ──────────────────
export const HERO_TEMPLATE_OPTIONS = [
  {
    value: "classic-dark" as const,
    label: "Classic dark",
    description:
      "Dark purple/rose gradient, split layout, rotating wheel art on the side.",
    preview:
      "bg-gradient-to-br from-[#1a0a2e] via-[#3b0764] to-[#0d0a14] text-white",
    accent: "from-fuchsia-500 via-purple-500 to-pink-500",
  },
  {
    value: "light-gradient" as const,
    label: "Light gradient",
    description:
      "Bright pastel background, centered copy, animated gradient CTA.",
    preview:
      "bg-gradient-to-br from-rose-50 via-fuchsia-50 to-violet-100 text-slate-900",
    accent: "from-rose-500 via-fuchsia-500 to-violet-500",
  },
] as const;

// ── Shared payload type for saveHomepageSettings ──────────────────────────
export type HomepageSettingsPayload = {
  // ── Background ─────────────────────────
  home_hero_bg_type: "gradient" | "image";
  home_hero_bg_value: string;
  expert_photo_url: string;

  // ── Article card images ────────────────
  home_article_img_0: string;
  home_article_img_1: string;
  home_article_img_2: string;

  // ── Hero text ─────────────────────────
  hero_headline_he: string;
  hero_headline_en: string;
  hero_sub_he: string;
  hero_sub_en: string;

  // ── Primary CTA ───────────────────────
  cta_primary_text_he: string;
  cta_primary_text_en: string;
  cta_primary_href: string;
  cta_primary_style: string;

  // ── Secondary CTA ─────────────────────
  cta_secondary_text_he: string;
  cta_secondary_text_en: string;
  cta_secondary_href: string;

  // ── Social proof ──────────────────────
  social_proof_couples_count: number;
  rating_value: number;
  rating_count: number;

  // ── Hero template (E6) ────────────────
  hero_template: "classic-dark" | "light-gradient";
  hero_side_image_url: string;
};
