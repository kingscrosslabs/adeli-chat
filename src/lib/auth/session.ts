import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { authEnabled, isAllowedEmail } from "./config";
import { auth } from "./server";

export type CurrentUser = { id: string; name: string; email: string; image: string | null };

/** The signed-in user. Null when signed out, or when login is off (local, no Google variables). */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!authEnabled()) return null;
  const session = await auth().api.getSession({ headers: await headers() }).catch(() => null);
  if (!session || !isAllowedEmail(session.user.email)) return null;
  const { id, name, email, image } = session.user;
  return { id, name, email, image: image ?? null };
}

/** True when this request may use the app: login is off, or someone allowed is signed in. */
export async function isAuthorized(): Promise<boolean> {
  return !authEnabled() || Boolean(await getCurrentUser());
}

/** For pages: sends signed-out visitors to `/sign-in`. */
export async function requireUserPage(): Promise<CurrentUser | null> {
  if (!authEnabled()) return null;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

/** For API routes: a 401 response when signed out, otherwise null. */
export async function unauthorizedResponse(): Promise<Response | null> {
  if (await isAuthorized()) return null;
  return Response.json({ error: { code: "unauthorized", message: "Sign in to Adeli Chat first." } }, { status: 401 });
}
