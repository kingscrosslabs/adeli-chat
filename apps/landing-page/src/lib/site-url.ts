/** This site's own address, for robots.txt and the sitemap: Vercel's production domain, or the local dev server. */
export function siteUrl(): string {
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  return production ? `https://${production}` : "http://localhost:3031";
}
