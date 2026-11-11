import "server-only";

import { and, desc, eq, ne } from "drizzle-orm";
import { redirect } from "next/navigation";

import type { AdeliAccount } from "@/lib/adeli/types";
import { DEFAULT_EMAIL_CAPTURE, type Automation, type AutomationStats } from "@/lib/automations/schemas";
import { NO_STATS, statsFor } from "@/lib/automations/stats";
import { db, schema } from "@/lib/db";

/** Server reads for pages. Mutations live in `src/lib/actions.ts`. */

type AccountRow = typeof schema.accounts.$inferSelect;
type AutomationRow = typeof schema.automations.$inferSelect;

export type ConnectedAccount = AdeliAccount & { id: string };

export function toAccount(row: AccountRow): ConnectedAccount {
  return {
    id: row.id,
    accountId: row.adeliAccountId,
    profileId: row.adeliProfileId,
    providerId: row.igUserId ?? "",
    displayName: row.displayName,
    displayIdentifier: row.handle,
    avatarUrl: null,
    connectionStatus: "connected",
  };
}

export function toAutomation(row: AutomationRow, stats: AutomationStats = NO_STATS): Automation {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    name: row.name,
    trigger: row.trigger,
    commentReply: row.commentReply,
    openingDm: row.openingDm,
    emailCapture: row.emailCapture ?? { ...DEFAULT_EMAIL_CAPTURE },
    finalDm: row.finalDm,
    stats,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    liveAt: row.liveAt?.toISOString() ?? null,
  };
}

/** The user's connected Instagram account. Everything else hangs off it, so this is the ownership check. */
export async function getConnectedAccount(userId: string): Promise<ConnectedAccount | null> {
  const [row] = await db().select().from(schema.accounts)
    .where(and(eq(schema.accounts.userId, userId), eq(schema.accounts.status, "connected")))
    .limit(1);
  return row ? toAccount(row) : null;
}

/** For pages that need an Instagram account: sends you to `/connect` without one. */
export async function requireAccount(userId: string): Promise<ConnectedAccount> {
  const account = await getConnectedAccount(userId);
  if (!account) redirect("/connect");
  return account;
}

/** The account's automations, most recently updated first. */
export async function listAutomations(accountId: string): Promise<Automation[]> {
  const rows = await db().select().from(schema.automations).where(eq(schema.automations.accountId, accountId)).orderBy(desc(schema.automations.updatedAt));
  const stats = await statsFor(rows.map((row) => row.id));
  return rows.map((row) => toAutomation(row, stats.get(row.id)));
}

export async function getAutomation(accountId: string, id: string): Promise<Automation | null> {
  const [row] = await db().select().from(schema.automations).where(and(eq(schema.automations.id, id), eq(schema.automations.accountId, accountId))).limit(1);
  if (!row) return null;
  return toAutomation(row, (await statsFor([row.id])).get(row.id));
}

/** Live automations on the account other than `selfId`, for the Go Live conflict rule. */
export async function otherLiveAutomations(accountId: string, selfId: string): Promise<Automation[]> {
  const rows = await db().select().from(schema.automations).where(and(
    eq(schema.automations.accountId, accountId),
    eq(schema.automations.status, "live"),
    ne(schema.automations.id, selfId),
  ));
  return rows.map((row) => toAutomation(row));
}
