import "server-only";

import { createHmac, createHash, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "adeli_chat_session";
const SESSION_SECONDS = 30 * 24 * 60 * 60;

function isMockMode() {
  return process.env.ADELI_MOCK === "1";
}

function secret() {
  if (isMockMode()) return process.env.SESSION_SECRET || "adeli-chat-local-mock";
  const value = process.env.SESSION_SECRET?.trim();
  if (!value) throw new Error("SESSION_SECRET is required unless ADELI_MOCK=1.");
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
  if (isMockMode()) return password !== "wrong";
  const configured = process.env.ADMIN_PASSWORD;
  if (!configured) throw new Error("ADMIN_PASSWORD is required unless ADELI_MOCK=1.");
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

export function hasValidSession(request: Request) {
  const cookie = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`));
  const value = cookie?.slice(COOKIE_NAME.length + 1);
  if (!value) return false;
  const [expiresAt, suppliedSignature] = value.split(".");
  if (!expiresAt || !suppliedSignature || Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false;
  try {
    return safeEqual(suppliedSignature, signature(expiresAt));
  } catch {
    return false;
  }
}

export function requireSession(request: Request): Response | null {
  return hasValidSession(request)
    ? null
    : Response.json({ error: { code: "session_unauthorized", message: "Log in to this Adeli Chat install first." } }, { status: 401 });
}
