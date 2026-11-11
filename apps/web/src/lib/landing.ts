/**
 * The public landing page at `/`. Off by default so a self-hosted install
 * opens straight into the app; chat.tryadeli.com sets `LANDING_PAGE=on`.
 * Kept free of database imports so `src/proxy.ts` can use it.
 */
export function landingEnabled(): boolean {
  return process.env.LANDING_PAGE?.trim().toLowerCase() === "on";
}

export const GITHUB_URL = "https://github.com/kingscrosslabs/adeli-chat";
export const ADELI_URL = "https://tryadeli.com";
