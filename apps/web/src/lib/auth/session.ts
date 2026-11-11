import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db, schema } from "@/lib/db";

import { authEnabled, isAllowedEmail, LOCAL_USER } from "./config";
import { auth } from "./server";

export type CurrentUser = { id: string; name: string; email: string; image: string | null };

/** Thrown when a Server Action or route needs a signed-in user and there isn't one. */
export class SignedOutError extends Error {
  constructor() {
    super("Your session ended. Sign in again.");
  }
}

/**
 * Who is using the app. Signed in with Google: that user. Login off (local,
 * no Google variables): the `local` user, created on first use. Otherwise null.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!authEnabled()) return localUser();
  const session = await auth().api.getSession({ headers: await headers() }).catch(() => null);
  if (!session || !isAllowedEmail(session.user.email)) return null;
  const { id, name, email, image } = session.user;
  return { id, name, email, image: image ?? null };
}

let localUserReady: Promise<void> | undefined;

async function localUser(): Promise<CurrentUser> {
  localUserReady ??= db().insert(schema.authUser).values({ ...LOCAL_USER, emailVerified: false }).onConflictDoNothing().then(() => undefined);
  await localUserReady.catch((error: unknown) => {
    localUserReady = undefined;
    throw error;
  });
  return { ...LOCAL_USER, image: null };
}

/** For Server Actions and server code: the user's id, or `SignedOutError`. */
export async function requireUserId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new SignedOutError();
  return user.id;
}

/** For pages: sends signed-out visitors to `/sign-in`. */
export async function requireUserPage(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

/** For API routes: the user's id, or a 401 response. */
export async function userOrUnauthorized(): Promise<{ userId: string } | { response: Response }> {
  const user = await getCurrentUser();
  if (user) return { userId: user.id };
  return { response: Response.json({ error: { code: "unauthorized", message: "Sign in to LedaChat first." } }, { status: 401 }) };
}
