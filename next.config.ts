import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  images: { remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }] },
  // PGlite loads its WebAssembly and data files from its own package folder.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
