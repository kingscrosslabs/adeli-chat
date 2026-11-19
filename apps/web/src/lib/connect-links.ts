import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { and, eq, gt, isNull } from "drizzle-orm";

import { appUrl } from "@/lib/app-url";
import { db, schema } from "@/lib/db";

/**
 * One-time links to `/connect`, made by the MCP `connect_instagram` tool. The
 * agent's OAuth window may have its own cookies (Claude Desktop and Claude
 * Code open the system browser, or the user taps the link on a phone), so the
 * link signs the user in on its way to `/connect`.
 *
 * A link only ever leads to `/connect`, works once, expires after 15 minutes,
 * and carries nothing but a random code (no Adeli key, profile or account id).
 * Only the code's SHA-256 hash is stored, like API tokens (`src/lib/mcp/tokens.ts`).
 */

export const CONNECT_LINK_MINUTES = 15;

export type ConnectMethod = "instagram" | "facebook";

/** Where a link leads: `/connect`, marked as coming from an agent, optionally starting one login. */
export function connectPath(method: ConnectMethod | null) {
  return `/connect?via=mcp${method ? `&start=${method}` : ""}`;
}

const START_PATH = "/connect/start/";

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** A new one-time link for `userId`. */
export async function createConnectLink(userId: string, method: ConnectMethod | null = null, now = new Date()): Promise<{ url: string; expiresAt: Date }> {
  const code = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + CONNECT_LINK_MINUTES * 60_000);
  await db().insert(schema.connectLinks).values({ userId, codeHash: hashCode(code), method, expiresAt });
  return { url: `${appUrl()}${START_PATH}${code}`, expiresAt };
}

/** True for a URL `createConnectLink` could have made on this install (used to trust an echoed value, never to redeem it). */
export function isConnectLinkUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const prefix = `${appUrl()}${START_PATH}`;
  return value.startsWith(prefix) && /^[A-Za-z0-9_-]{43}$/.test(value.slice(prefix.length));
}

/**
 * Uses up the link with `code`: one conditional update, so two clicks can't
 * both get in. Null for an unknown, used or expired code. The user's row is
 * gone with their links (cascade), so a deleted user's link is unknown.
 */
export async function redeemConnectLink(code: string, now = new Date()): Promise<{ userId: string; method: ConnectMethod | null } | null> {
  if (!code || code.length > 128) return null;
  const [row] = await db().update(schema.connectLinks)
    .set({ usedAt: now })
    .where(and(eq(schema.connectLinks.codeHash, hashCode(code)), isNull(schema.connectLinks.usedAt), gt(schema.connectLinks.expiresAt, now)))
    .returning({ userId: schema.connectLinks.userId, method: schema.connectLinks.method });
  return row ?? null;
}
