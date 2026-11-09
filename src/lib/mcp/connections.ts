import "server-only";

import { and, eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";

/**
 * Apps connected to `/mcp` through OAuth (Claude's connectors), for Settings.
 * One per client the user consented to.
 */

export type ConnectedApp = { clientId: string; name: string; scopes: string[]; connectedAt: string; canWrite: boolean };

export async function listConnectedApps(userId: string): Promise<ConnectedApp[]> {
  const rows = await db().select({
    clientId: schema.oauthConsent.clientId,
    scopes: schema.oauthConsent.scopes,
    createdAt: schema.oauthConsent.createdAt,
    name: schema.oauthClient.name,
  }).from(schema.oauthConsent)
    .innerJoin(schema.oauthClient, eq(schema.oauthClient.clientId, schema.oauthConsent.clientId))
    .where(eq(schema.oauthConsent.userId, userId));
  return rows.map((row) => ({
    clientId: row.clientId,
    name: row.name || "Unnamed app",
    scopes: row.scopes,
    connectedAt: row.createdAt.toISOString(),
    canWrite: row.scopes.includes("automations:write"),
  })).sort((a, b) => b.connectedAt.localeCompare(a.connectedAt));
}

/**
 * Forgets the consent and deletes the app's refresh tokens, so it has to ask
 * again. An access token it already holds keeps working until it expires
 * (at most an hour), since those are checked by signature alone.
 */
export async function disconnectApp(userId: string, clientId: string): Promise<void> {
  await db().transaction(async (tx) => {
    await tx.delete(schema.oauthAccessToken).where(and(eq(schema.oauthAccessToken.userId, userId), eq(schema.oauthAccessToken.clientId, clientId)));
    await tx.delete(schema.oauthRefreshToken).where(and(eq(schema.oauthRefreshToken.userId, userId), eq(schema.oauthRefreshToken.clientId, clientId)));
    await tx.delete(schema.oauthConsent).where(and(eq(schema.oauthConsent.userId, userId), eq(schema.oauthConsent.clientId, clientId)));
  });
}
