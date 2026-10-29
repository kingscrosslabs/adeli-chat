import "server-only";

import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "adeli_chat_session";
const SESSION_SECONDS = 30 * 24 * 60 * 60;

function secret() {
  const value = process.env.SESSION_SECRET?.trim();
  if (!value) throw new Error("SESSION_SECRET is not set on this server. Add it to .env.local and restart.");
  return value;
}

function signature(expiresAt: string) {
  return createHmac("sha256", secret()).update(expiresAt).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

export function verifyAdminPassword(password: string) {
  const configured = process.env.ADMIN_PASSWORD;
  if (!configured) throw new Error("ADMIN_PASSWORD is not set on this server. Add it to .env.local and restart.");
  return safeEqual(password, configured);
}

export function sessionCookie(request: Request) {
  const expiresAt = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
  const value = `${expiresAt}.${signature(expiresAt)}`;
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}${secure}`;
}

export function clearSessionCookie(request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

function isValidSessionValue(value: string | undefined) {
  if (!value) return false;
  const [expiresAt, suppliedSignature] = value.split(".");
  if (!expiresAt || !suppliedSignature || Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false;
  try {
    return safeEqual(suppliedSignature, signature(expiresAt));
  } catch {
    return false;
  }
}

export function hasValidSession(request: Request) {
  const cookie = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`));
  return isValidSessionValue(cookie?.slice(COOKIE_NAME.length + 1));
}

/** For Server Components and Server Actions, which don't get a `Request`. */
export async function isLoggedIn() {
  return isValidSessionValue((await cookies()).get(COOKIE_NAME)?.value);
}

export function requireSession(request: Request): Response | null {
  return hasValidSession(request)
    ? null
    : Response.json({ error: { code: "session_unauthorized", message: "Log in to this Adeli Chat install first." } }, { status: 401 });
}
