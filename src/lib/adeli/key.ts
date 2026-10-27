import "server-only";

/**
 * The only place server code reads the Adeli API key.
 *
 * The encrypted database fallback from PRD FR-S.4 will land with the backend.
 * Until then, the real API demo uses ADELI_API_KEY. The key is never returned
 * to the browser.
 */
export function getAdeliApiKey(): string | null {
  const key = process.env.ADELI_API_KEY?.trim();
  return key || null;
}
