import type { MetadataRoute } from "next";

/** The app is behind sign-in, so nothing here belongs in search results. The marketing site has its own robots.txt. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
