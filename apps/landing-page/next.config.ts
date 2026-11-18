import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  async rewrites() {
    // A post's Markdown mirror. `/blog/<slug>.md` would match `blog/[slug]` with "<slug>.md" as the slug and 404.
    return [{ source: "/blog/:slug.md", destination: "/blog/:slug/md" }];
  },
};

export default nextConfig;
