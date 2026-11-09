import "server-only";

import { LOCAL_USER } from "@/lib/auth/config";
import { getUserSettings } from "@/lib/user-settings";
import { openSecret } from "@/lib/secret-box";

import { AdeliError } from "./types";

export const DEFAULT_BASE_URL = "https://app.tryadeli.com";

export type AdeliConfig = { baseURL: string; apiKey: string };

/** Where the key in use came from. Settings shows it. */
export type KeySource = "settings" | "env";

/**
 * The only place server code reads the Adeli base URL and API key.
 *
 * Each user's key and base URL come from Setup or Settings (stored in
 * `user_settings`, the key encrypted). `ADELI_API_KEY` and
 * `ADELI_API_BASE_URL` are fallbacks only for the `local` user (no-login
 * mode), so a signed-in user never gets the server's key. A missing key
 * throws `not_configured`. The key is never returned to the browser.
 */
export async function getAdeliConfig(userId: string): Promise<AdeliConfig & { source: KeySource }> {
  const settings = await getUserSettings(userId);
  const isLocal = userId === LOCAL_USER.id;
  const stored = settings.adeliApiKeyEncrypted ? openSecret(settings.adeliApiKeyEncrypted) : null;
  if (settings.adeliApiKeyEncrypted && !stored) {
    throw notConfigured("The saved Adeli key can't be read. BETTER_AUTH_SECRET may have changed. Enter the key again in Settings.");
  }
  const apiKey = stored ?? (isLocal ? process.env.ADELI_API_KEY?.trim() : undefined);
  if (!apiKey) throw notConfigured("Add your Adeli API key in Settings.");
  const rawBase = settings.adeliBaseUrl ?? (isLocal ? process.env.ADELI_API_BASE_URL?.trim() : undefined);
  return { baseURL: rawBase ? normalizeBaseURL(rawBase) : DEFAULT_BASE_URL, apiKey, source: stored ? "settings" : "env" };
}

/** Like `getAdeliConfig`, but null instead of throwing `not_configured`. */
export async function findAdeliConfig(userId: string) {
  try {
    return await getAdeliConfig(userId);
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
