import type { NextConfig } from "next";

/** PostHog's ingestion host (`https://us.i.posthog.com` or `https://eu.i.posthog.com`). */
const posthogHost = (process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  devIndicators: false,
  images: { remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }] },
  // PGlite loads its WebAssembly and data files from its own package folder.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Setup (the in-app Adeli key) is gone: the key is ADELI_API_KEY, and onboarding starts at /connect.
  async redirects() {
    return [{ source: "/setup", destination: "/connect", permanent: false }];
  },
  // PostHog through this app (`/ingest`), so ad blockers don't drop events. See src/instrumentation-client.ts.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      { source: "/ingest/static/:path*", destination: `${posthogHost.replace(".i.posthog.com", "-assets.i.posthog.com")}/static/:path*` },
      { source: "/ingest/:path*", destination: `${posthogHost}/:path*` },
    ];
  },
};

export default nextConfig;
