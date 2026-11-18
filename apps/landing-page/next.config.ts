import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  async redirects() {
    // The waitlist link to share: the homepage with the Tally popup open (components/waitlist.tsx).
    // Temporary, so it can point at sign-up later. Query strings (UTMs) carry over.
    return [{ source: "/waitlist", destination: "/#waitlist", permanent: false }];
  },
  async rewrites() {
    // A post's Markdown mirror. `/blog/<slug>.md` would match `blog/[slug]` with "<slug>.md" as the slug and 404.
    return [{ source: "/blog/:slug.md", destination: "/blog/:slug/md" }];
  },
};

export default nextConfig;
