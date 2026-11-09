import "server-only";

import { getAppSettings } from "@/lib/app-settings";
import { openSecret } from "@/lib/secret-box";

import { AdeliError } from "./types";

export const DEFAULT_BASE_URL = "https://app.tryadeli.com";

export type AdeliConfig = { baseURL: string; apiKey: string };

/** Where the key in use came from. Settings shows it. */
export type KeySource = "settings" | "env";

/**
 * The only place server code reads the Adeli base URL and API key.
 *
 * The key and base URL entered in Settings (stored in `app_settings`, the key
 * encrypted) win. `ADELI_API_KEY` and `ADELI_API_BASE_URL` are optional
 * fallbacks, handy for local development. A missing key throws
 * `not_configured`. The key is never returned to the browser.
 */
export async function getAdeliConfig(): Promise<AdeliConfig & { source: KeySource }> {
  const settings = await getAppSettings();
  const stored = settings.adeliApiKeyEncrypted ? openSecret(settings.adeliApiKeyEncrypted) : null;
  if (settings.adeliApiKeyEncrypted && !stored) {
    throw notConfigured("The saved Adeli key can't be read. BETTER_AUTH_SECRET may have changed. Enter the key again in Settings.");
  }
  const apiKey = stored ?? process.env.ADELI_API_KEY?.trim();
  if (!apiKey) throw notConfigured("Add your Adeli API key in Settings.");
  const rawBase = settings.adeliBaseUrl ?? process.env.ADELI_API_BASE_URL?.trim();
  return { baseURL: rawBase ? normalizeBaseURL(rawBase) : DEFAULT_BASE_URL, apiKey, source: stored ? "settings" : "env" };
}

/** Like `getAdeliConfig`, but null instead of throwing `not_configured`. */
export async function findAdeliConfig() {
  try {
    return await getAdeliConfig();
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
  const invalid = () => notConfigured("The Adeli URL must be an origin such as https://app.tryadeli.com.");
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
