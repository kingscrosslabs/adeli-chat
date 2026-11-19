import "server-only";

import { after } from "next/server";

/**
 * Loops (loops.so) sends the welcome email when someone signs up. The app
 * sends a `signup` event; a Loops workflow on that event sends the email
 * (docs/email.md). Optional: without LOOPS_API_KEY nothing is sent, which is
 * how local dev and self-hosted installs run. Only the LedaChat user's own
 * details go to Loops, never a commenter's or lead's.
 */

const LOOPS_EVENTS_URL = "https://app.loops.so/api/v1/events/send";

/** The event the "Automate Instagram replies for free with LedaChat" workflow listens for. */
export const SIGNUP_EVENT = "signup";

export function loopsApiKey(): string | null {
  return process.env.LOOPS_API_KEY?.trim() || null;
}

export type LoopsEvent = {
  eventName: string;
  email: string;
  userId: string;
  /** Contact properties saved on the Loops contact, such as firstName. */
  contactProperties?: Record<string, string>;
  /** Loops ignores a repeat of the same key for 24 hours. */
  idempotencyKey?: string;
};

/**
 * Sends one event and waits for Loops. False when no key is set; throws when
 * Loops refuses. A 409 means Loops already took this idempotency key, so the
 * event was sent before: that counts as sent.
 */
export async function sendLoopsEvent(event: LoopsEvent): Promise<boolean> {
  const key = loopsApiKey();
  if (!key) return false;
  const headers: Record<string, string> = { authorization: `Bearer ${key}`, "content-type": "application/json" };
  if (event.idempotencyKey) headers["idempotency-key"] = event.idempotencyKey;
  const response = await fetch(LOOPS_EVENTS_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...event.contactProperties, email: event.email, userId: event.userId, eventName: event.eventName }),
    signal: AbortSignal.timeout(5000),
  });
  if (response.ok || response.status === 409) return true;
  throw new Error(`Loops answered ${response.status}`);
}

/** Google gives one full name; Loops wants first and last. */
export function splitName(name: string): { firstName: string; lastName: string } {
  const trimmed = name.trim();
  const space = trimmed.indexOf(" ");
  if (space === -1) return { firstName: trimmed, lastName: "" };
  return { firstName: trimmed.slice(0, space), lastName: trimmed.slice(space + 1).trim() };
}

/**
 * Starts the welcome email for a new user, after the response, never throwing
 * and never retried. Sign-up never waits on Loops or fails because of it.
 */
export function notifyLoopsSignup(user: { id: string; name: string; email: string }): Promise<void> {
  if (!loopsApiKey()) return Promise.resolve();
  const { firstName, lastName } = splitName(user.name);
  const sending = sendLoopsEvent({
    eventName: SIGNUP_EVENT,
    email: user.email,
    userId: user.id,
    contactProperties: { firstName, lastName, source: "ledachat-app", userGroup: "ledachat-user" },
    idempotencyKey: `ledachat-signup-${user.id}`,
  }).then(
    () => undefined,
    (error: unknown) => console.warn(`Couldn't send the Loops sign-up event: ${error instanceof Error ? error.message : String(error)}`),
  );
  try {
    after(sending);
  } catch {
    // Outside a request (tests, background work): it finishes on its own.
  }
  return sending;
}

const LOOPS_DELETE_CONTACT_URL = "https://app.loops.so/api/v1/contacts/delete";

/**
 * Removes a deleted user's contact from Loops, so their details leave Loops
 * too and signing up again with the same email sends the welcome email again.
 * False when no key is set. A contact Loops doesn't have (404) counts as removed.
 */
export async function deleteLoopsContact(email: string): Promise<boolean> {
  const key = loopsApiKey();
  if (!key) return false;
  const response = await fetch(LOOPS_DELETE_CONTACT_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ email }),
    signal: AbortSignal.timeout(5000),
  });
  if (response.ok || response.status === 404) return true;
  throw new Error(`Loops answered ${response.status}`);
}
