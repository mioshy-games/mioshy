# Mioshy

Couples game platform (Next.js 14 App Router): Truth or Dare wheel, freemium spin limit, `next-intl` (default locale `he`, RTL), Supabase-ready auth UI, Stripe-free paywall UI.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Optional env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` for live auth.

## Cloudflare Pages

This app avoids Node-only server APIs so it can run on **Cloudflare Pages** using the [**`@cloudflare/next-on-pages`**](https://github.com/cloudflare/next-on-pages) adapter (or the current Cloudflare Next integration). Prefer Edge-compatible routes, `fetch`-based Supabase clients, and no filesystem access in route handlers. Payments stay client/UI-only until you add a Worker for Stripe secrets.
