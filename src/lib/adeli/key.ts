import "server-only";

import { AdeliError } from "./types";

export const DEFAULT_BASE_URL = "https://app.tryadeli.com";

export type AdeliConfig = { baseURL: string; apiKey: string };

/**
 * The only place server code reads the Adeli base URL and API key.
 *
 * One install uses one Adeli organization: the key is `ADELI_API_KEY` and the
 * URL `ADELI_API_BASE_URL` (default: hosted Adeli). Every user gets their own
 * profile in that organization (`profile.ts`), so the key reaches every
 * user's profile and server code must scope each call to the signed-in
 * user's profile. A missing key throws `not_configured`. The key is never
 * returned to the browser.
 */
export function getAdeliConfig(): AdeliConfig {
  const apiKey = process.env.ADELI_API_KEY?.trim();
  if (!apiKey) throw notConfigured("ADELI_API_KEY isn't set on this server. See \"Get your Adeli API key\" in the README.");
  const rawBase = process.env.ADELI_API_BASE_URL?.trim();
  return { baseURL: rawBase ? normalizeBaseURL(rawBase) : DEFAULT_BASE_URL, apiKey };
}

/** Like `getAdeliConfig`, but null when the key is missing or the URL is invalid. */
export function findAdeliConfig(): AdeliConfig | null {
  try {
    return getAdeliConfig();
  } catch (error) {
    if (error instanceof AdeliError && error.code === "not_configured") return null;
    throw error;
  }
}

/**
 * The base URL may be an origin (`http://localhost:3000`) or end in
 * `/api/v1`; either way the result is the origin `@adeli/sdk` expects.
 */
export function normalizeBaseURL(raw: string): string {
  const invalid = () => notConfigured("ADELI_API_BASE_URL must be an origin such as https://app.tryadeli.com.");
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw invalid();
  }
  const path = url.pathname.replace(/\/+$/, "").replace(/\/api\/v1$/, "");
  if (path || url.search || url.hash || !/^https?:$/.test(url.protocol)) throw invalid();
  return url.origin;
}

function notConfigured(message: string) {
  return new AdeliError("not_configured", message, 500);
}
