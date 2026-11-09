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

/** `ALLOWED_EMAILS`, lowercased. Empty means "the first person to sign in owns this install". */
export function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
}

export function isAllowedEmail(email: string): boolean {
  const allowed = allowedEmails();
  return allowed.length === 0 || allowed.includes(email.trim().toLowerCase());
}

/**
 * Who may sign in. With `ALLOWED_EMAILS`, only those addresses. Without it,
 * the first Google account creates the owner and nobody else can join.
 * Returns a reason when the sign-in is refused.
 */
export function signInRefusal(input: { email: string; creatingUser: boolean; existingUsers: number }): string | null {
  if (allowedEmails().length) return isAllowedEmail(input.email) ? null : "This Google account isn't allowed to use this Adeli Chat.";
  if (!input.creatingUser || input.existingUsers === 0) return null;
  return "This Adeli Chat already has an owner. Ask them to add your email to ALLOWED_EMAILS.";
}
