/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    // ── tailwindcss/nesting (bundled with tailwindcss v3) ─────────
    // Flattens native-CSS nesting (`& selector`, `&:hover`, etc.)
    // at build time so the shipped stylesheet doesn't depend on the
    // browser supporting CSS Nesting natively.
    //
    // Why we need this — 2026-05-16: Safari 15.4 ≤ x < 17.2 (the
    // lower bound of our browserslist target) does NOT support
    // native CSS nesting. components/marketing/v2/styles.css uses
    // `.home-v2 { & * { ... } & img { ... } ... }` to scope the v2
    // resets. Without this plugin, those rules reach Safari 15.4 →
    // 17.1 verbatim, the parser fails on the `&` selectors, and the
    // whole `.home-v2 { ... }` block gets dropped from the cascade.
    // Result: large portions of the homepage render unstyled in
    // older Safari (reproduced in production by Itzik 2026-05-16).
    // tailwindcss/nesting wraps postcss-nesting and emits the
    // flattened equivalent at compile time. No runtime cost.
    "tailwindcss/nesting": {},
    tailwindcss: {},
    // Autoprefixer — modern targets need very few prefixes, but
    // having it in the pipeline is the standard Tailwind setup and
    // keeps Safari/iOS happy on the few properties that still need
    // `-webkit-` (mask-image, backdrop-filter, etc.).
    autoprefixer: {},
  },
};

export default config;
