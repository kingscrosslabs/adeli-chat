const DEFAULT_APP_URL = "http://localhost:3030";

/**
 * Where this install is reachable: `APP_URL` when set, otherwise the Vercel
 * production domain (or this deployment's own URL on a preview), otherwise
 * the local dev server. Used for sign-in callbacks, the Instagram connect
 * redirect and the Adeli webhook URL.
 */
export function appUrl(): string {
  const explicit = process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercelHost = process.env.VERCEL_ENV === "production"
    ? process.env.VERCEL_PROJECT_PRODUCTION_URL
    : process.env.VERCEL_URL;
  if (vercelHost?.trim()) return `https://${vercelHost.trim()}`;
  return DEFAULT_APP_URL;
}

/** True on Vercel and in `next start`. Login and an encryption secret are required there. */
export function isDeployed(): boolean {
  return Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";
}
