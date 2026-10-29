import "server-only";

import { Adeli, AdeliApiError, AuthenticationError, ConfigurationError, NetworkError, TimeoutError } from "@adeli/sdk";

import { markKeyStatus } from "@/lib/app-settings";

import { getAdeliConfig } from "./key";
import { AdeliError } from "./types";

/** A client for this install's key. Throws `not_configured` without one. */
export function adeli(): Adeli {
  try {
    return new Adeli(getAdeliConfig());
  } catch (error) {
    throw toAdeliError(error);
  }
}

/**
 * Runs one Adeli call and maps SDK errors to Adeli Chat's `AdeliError`. A
 * rejected key also marks the key invalid, which shows the key banner.
 */
export async function adeliCall<T>(fn: (client: Adeli) => Promise<T>): Promise<T> {
  try {
    return await fn(adeli());
  } catch (error) {
    const mapped = toAdeliError(error);
    if (mapped.code === "unauthorized") await markKeyStatus("invalid").catch(() => undefined);
    throw mapped;
  }
}

export function toAdeliError(error: unknown): AdeliError {
  if (error instanceof AdeliError) return error;
  if (error instanceof AuthenticationError) {
    return new AdeliError("unauthorized", "Adeli didn't accept the key in ADELI_API_KEY. Create a new one in Adeli and restart.", 401);
  }
  if (error instanceof NetworkError || error instanceof TimeoutError) {
    return new AdeliError("network", "We couldn't reach Adeli. Try again in a minute.", 502);
  }
  if (error instanceof AdeliApiError) return new AdeliError(error.code, redact(error.message), error.status);
  if (error instanceof ConfigurationError) return new AdeliError("not_configured", redact(error.message), 500);
  return new AdeliError("network", "Something went wrong while talking to Adeli.", 502);
}

/** Adeli keys never belong in an error message. */
function redact(message: string) {
  return message.replace(/rk_live_[A-Za-z0-9_-]+/g, "rk_live_…");
}
