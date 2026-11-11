/**
 * Where the landing page sends people. The app runs as its own deployment
 * (apps/web), so links into it are absolute.
 *
 * `APP_URL` is the app's address, for example https://app.example.com. It is
 * read at build time, since the page is static. Without it the page links to
 * the local app (`yarn dev`), except in a Vercel production build, which
 * fails instead of shipping links to localhost.
 */
function appUrl(): string {
  const explicit = process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  if (process.env.VERCEL_ENV === "production") {
    throw new Error("APP_URL is not set. Set it on the landing page's Vercel project to the app's URL, for example https://app.example.com.");
  }
  return "http://localhost:3030";
}

export const APP_URL = appUrl();
export const SIGN_IN_URL = `${APP_URL}/sign-in`;
export const GITHUB_URL = "https://github.com/kingscrosslabs/adeli-chat";
export const SITE_URL = "https://ledachat.com";
export const CONTACT_EMAIL = "hello@ledachat.com";

/**
 * Every Adeli mention links here, one tagged URL per spot on the page so GA4
 * shows which one sends traffic. Built with the utm-link skill and logged in
 * company-brain's gtm/utm/links.csv; change them there too (docs/brand.md section 6).
 */
export const ADELI_LINKS = {
  officialStrip: "https://www.tryadeli.com/?utm_source=ledachat.com&utm_medium=referral&utm_campaign=ledachat-landing&utm_content=official-strip",
  options: "https://www.tryadeli.com/?utm_source=ledachat.com&utm_medium=referral&utm_campaign=ledachat-landing&utm_content=options",
  officialApi: "https://www.tryadeli.com/?utm_source=ledachat.com&utm_medium=referral&utm_campaign=ledachat-landing&utm_content=official-api",
  officialApiDocs: "https://www.tryadeli.com/docs?utm_source=ledachat.com&utm_medium=referral&utm_campaign=ledachat-landing&utm_content=official-api-docs",
  faq: "https://www.tryadeli.com/?utm_source=ledachat.com&utm_medium=referral&utm_campaign=ledachat-landing&utm_content=faq",
  footer: "https://www.tryadeli.com/?utm_source=ledachat.com&utm_medium=referral&utm_campaign=ledachat-landing&utm_content=footer",
} as const;
