import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  images: { remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }] },
  // PGlite loads its WebAssembly and data files from its own package folder.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Setup (the in-app Adeli key) is gone: the key is ADELI_API_KEY, and onboarding starts at /connect.
  async redirects() {
    return [{ source: "/setup", destination: "/connect", permanent: false }];
  },
};

export default nextConfig;
