import "server-only";

import { Adeli, AdeliApiError, AuthenticationError, ConfigurationError, NetworkError, TimeoutError } from "@adeli/sdk";

import { getAdeliConfig } from "./key";
import { AdeliError } from "./types";

/** When Adeli last rejected the server's key, in this process. Cleared by the next accepted call. Drives the key banner. */
let keyRejectedAt: Date | null = null;

export function serverKeyRejected() {
  return keyRejectedAt !== null;
}

/** A client for the server's key. Throws `not_configured` without one. */
export function adeli(): Adeli {
  try {
    return new Adeli(getAdeliConfig());
  } catch (error) {
    throw toAdeliError(error);
  }
}

/**
 * Runs one Adeli call with the server's key and maps SDK errors to Adeli
 * Chat's `AdeliError`. The key reaches every user's profile, so callers pass
 * only the signed-in user's profile and accounts (`profile.ts`, `instagram.ts`).
 */
export async function adeliCall<T>(fn: (client: Adeli) => Promise<T>): Promise<T> {
  try {
    const result = await fn(adeli());
    keyRejectedAt = null;
    return result;
  } catch (error) {
    const mapped = toAdeliError(error);
    if (mapped.code === "unauthorized") keyRejectedAt = new Date();
    throw mapped;
  }
}

export function toAdeliError(error: unknown): AdeliError {
  if (error instanceof AdeliError) return error;
  if (error instanceof AuthenticationError) {
    return new AdeliError("unauthorized", "Adeli didn't accept this server's API key (ADELI_API_KEY).", 401);
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
  return message.replace(/rk_(live|test)_[A-Za-z0-9_-]+/g, "rk_$1_…");
}
