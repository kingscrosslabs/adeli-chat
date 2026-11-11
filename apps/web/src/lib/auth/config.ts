import { isDeployed } from "@/lib/app-url";

/**
 * Google sign-in settings, read from the environment. Kept free of database
 * imports so `src/proxy.ts` can use it.
 */
export function googleCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/**
 * Sign-in is on when Google is configured, and always when deployed, so a
 * deployment missing its Google variables stays locked instead of open.
 * Locally, without Google variables, Adeli Chat runs with no login.
 */
export function authEnabled(): boolean {
  return Boolean(googleCredentials()) || isDeployed();
}

/** In local no-login mode everything belongs to this user. */
export const LOCAL_USER = { id: "local", name: "Local", email: "local@adeli-chat.invalid" } as const;

/** `ALLOWED_EMAILS`, lowercased. Empty means anyone with a Google account can sign in. */
export function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
}

export function isAllowedEmail(email: string): boolean {
  const allowed = allowedEmails();
  return allowed.length === 0 || allowed.includes(email.trim().toLowerCase());
}

/**
 * Who may sign in: anyone with Google, each in their own workspace, unless
 * `ALLOWED_EMAILS` limits it. Returns a reason when the sign-in is refused.
 */
export function signInRefusal(email: string): string | null {
  return isAllowedEmail(email) ? null : "This Google account isn't allowed to use this Adeli Chat.";
}
