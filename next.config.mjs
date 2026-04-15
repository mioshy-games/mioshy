import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

function supabaseHost() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return null;
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      ...(supabaseHost()
        ? [
            {
              protocol: "https",
              hostname: supabaseHost(),
              pathname: "/**",
            },
          ]
        : []),
    ],
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.mioshy.com" }],
        destination: "https://mioshy.com/:path*",
        permanent: true,
      },
      // TODO(old-urls): Add 301 mappings from the legacy site once exported
      // from GSC/Ahrefs/ScreamingFrog. Map high-value URLs to the closest
      // new equivalent; otherwise redirect to "/".
    ];
  },
  async headers() {
    if (process.env.VERCEL_ENV === "preview") {
      return [
        {
          source: "/:path*",
          headers: [
            {
              key: "X-Robots-Tag",
              value: "noindex, nofollow",
            },
          ],
        },
      ];
    }
    return [];
  },
  // Avoid webpack dev-server/HMR desync (missing ./NNN.js chunks) by not
  // persisting webpack's cache during `next dev`. Production builds keep caching.
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

export default withNextIntl(nextConfig);
