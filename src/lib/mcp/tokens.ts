import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { and, desc, eq, isNull } from "drizzle-orm";

import { db, schema } from "@/lib/db";

/**
 * Personal API tokens for `/mcp`. A token is `adc_` plus 32 random bytes; the
 * prefix makes a leaked one easy to recognize. Only its SHA-256 hash is
 * stored, so the token is shown once, when it's created. Tokens can be read
 * only, and can expire (optional; the default is never).
 */

export const TOKEN_PREFIX = "adc_";

export const TOKEN_EXPIRY_OPTIONS = ["never", "30d", "90d", "365d"] as const;
export type TokenExpiry = (typeof TOKEN_EXPIRY_OPTIONS)[number];

const EXPIRY_DAYS: Record<TokenExpiry, number | null> = { never: null, "30d": 30, "90d": 90, "365d": 365 };

export type ApiToken = {
  id: string;
  name: string;
  prefix: string;
  readOnly: boolean;
  createdAt: string;
  expiresAt: string | null;
  /** Whole days until it expires, rounded up, as of when it was listed. Null when it never expires. */
  daysLeft: number | null;
  expired: boolean;
  lastUsedAt: string | null;
};

export type TokenUser = { userId: string; tokenId: string; readOnly: boolean };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function looksLikeApiToken(value: string): boolean {
  return value.startsWith(TOKEN_PREFIX);
}

const DAY_MS = 24 * 60 * 60 * 1000;

function toApiToken(row: typeof schema.apiTokens.$inferSelect, now = new Date()): ApiToken {
  const msLeft = row.expiresAt ? row.expiresAt.getTime() - now.getTime() : null;
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    readOnly: row.readOnly,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    daysLeft: msLeft === null ? null : Math.max(0, Math.ceil(msLeft / DAY_MS)),
    expired: msLeft !== null && msLeft <= 0,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
  };
}

/** Creates a token and returns it in full. This is the only time anyone sees it. */
export async function createToken(userId: string, input: { name: string; readOnly: boolean; expiry: TokenExpiry }, now = new Date()): Promise<{ token: string; apiToken: ApiToken }> {
  const token = `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
  const days = EXPIRY_DAYS[input.expiry];
  const [row] = await db().insert(schema.apiTokens).values({
    userId,
    name: input.name.trim().slice(0, 60) || "API token",
    prefix: token.slice(0, TOKEN_PREFIX.length + 6),
    tokenHash: hashToken(token),
    readOnly: input.readOnly,
    expiresAt: days === null ? null : new Date(now.getTime() + days * DAY_MS),
    createdAt: now,
  }).returning();
  return { token, apiToken: toApiToken(row, now) };
}

/** The user's tokens that haven't been revoked, newest first. Expired ones stay listed so you can see why one stopped working. */
export async function listTokens(userId: string, now = new Date()): Promise<ApiToken[]> {
  const rows = await db().select().from(schema.apiTokens)
    .where(and(eq(schema.apiTokens.userId, userId), isNull(schema.apiTokens.revokedAt)))
    .orderBy(desc(schema.apiTokens.createdAt));
  return rows.map((row) => toApiToken(row, now));
}

/** Revokes one of the user's own tokens. Returns false when there's no such token. */
export async function revokeToken(userId: string, id: string): Promise<boolean> {
  const revoked = await db().update(schema.apiTokens).set({ revokedAt: new Date() })
    .where(and(eq(schema.apiTokens.id, id), eq(schema.apiTokens.userId, userId), isNull(schema.apiTokens.revokedAt)))
    .returning({ id: schema.apiTokens.id });
  return revoked.length > 0;
}

const LAST_USED_EVERY_MS = 60_000;

/** Who a bearer token belongs to, or null when it's unknown, revoked or expired. */
export async function userForToken(token: string, now = new Date()): Promise<TokenUser | null> {
  if (!looksLikeApiToken(token)) return null;
  const [row] = await db().select().from(schema.apiTokens).where(eq(schema.apiTokens.tokenHash, hashToken(token))).limit(1);
  if (!row || row.revokedAt || (row.expiresAt && row.expiresAt <= now)) return null;
  if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > LAST_USED_EVERY_MS) {
    await db().update(schema.apiTokens).set({ lastUsedAt: now }).where(eq(schema.apiTokens.id, row.id));
  }
  return { userId: row.userId, tokenId: row.id, readOnly: row.readOnly };
}
