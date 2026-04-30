import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontSize: {
        // ── Typography scale - minimum 16 px (1 rem) for all body-text classes ──
        // text-xs  → 14 px (0.875 rem) - used only for ornamental/badge labels
        // text-sm  → 16 px (1 rem)     - smallest permitted body/UI text
        // text-base → 18 px (1.125 rem) - comfortable reading size
        // text-lg  → 20 px (1.25 rem)  - lead / subheading
        xs:   ["0.875rem",  { lineHeight: "1.4" }],  // 14 px
        sm:   ["1rem",      { lineHeight: "1.5" }],  // 16 px
        base: ["1.125rem",  { lineHeight: "1.65" }], // 18 px
        lg:   ["1.25rem",   { lineHeight: "1.55" }], // 20 px
        xl:   ["1.375rem",  { lineHeight: "1.4" }],  // 22 px
        "2xl":["1.5rem",    { lineHeight: "1.35" }], // 24 px
        "3xl":["1.875rem",  { lineHeight: "1.25" }], // 30 px
        "4xl":["2.25rem",   { lineHeight: "1.15" }], // 36 px
        "5xl":["3rem",      { lineHeight: "1.08" }], // 48 px
        "6xl":["3.75rem",   { lineHeight: "1.05" }], // 60 px
        "7xl":["4.5rem",    { lineHeight: "1.02" }], // 72 px
        "8xl":["6rem",      { lineHeight: "1" }],    // 96 px
        "9xl":["8rem",      { lineHeight: "1" }],    // 128 px
      },
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "aurora-drift": {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(2%,-1.5%,0) scale(1.04)" },
        },
        "aurora-breathe": {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)", opacity: "0.55" },
          "50%": { transform: "translate3d(-1.5%,2%,0) scale(1.06)", opacity: "0.75" },
        },
      },
      animation: {
        "aurora-drift": "aurora-drift 22s ease-in-out infinite",
        "aurora-breathe": "aurora-breathe 28s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
