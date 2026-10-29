import "server-only";

import { AdeliError } from "./types";

const DEFAULT_BASE_URL = "https://app.tryadeli.com";

export type AdeliConfig = { baseURL: string; apiKey: string };

/**
 * The only place server code reads the Adeli base URL and API key.
 *
 * `baseURL` is an origin, as `@adeli/sdk` expects. A legacy
 * `ADELI_API_BASE_URL` such as `http://localhost:3000/api/v1` still works: its
 * trailing `/api/v1` is stripped. There is no mock fallback; a missing key
 * throws `not_configured`. The key is never returned to the browser.
 */
export function getAdeliConfig(): AdeliConfig {
  const apiKey = process.env.ADELI_API_KEY?.trim();
  if (!apiKey) throw notConfigured("ADELI_API_KEY is not set on this server. Add it to .env.local and restart.");
  return { baseURL: readBaseURL(), apiKey };
}

function readBaseURL(): string {
  const name = process.env.ADELI_BASE_URL?.trim() ? "ADELI_BASE_URL" : "ADELI_API_BASE_URL";
  const raw = process.env[name]?.trim();
  if (!raw) return DEFAULT_BASE_URL;
  return normalizeBaseURL(raw, name);
}

export function normalizeBaseURL(raw: string, name = "ADELI_BASE_URL"): string {
  const invalid = () => notConfigured(`${name} must be an origin such as http://localhost:3000.`);
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
