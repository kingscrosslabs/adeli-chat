import "server-only";

import { and, desc, eq, ne } from "drizzle-orm";
import { redirect } from "next/navigation";

import type { AdeliAccount } from "@/lib/adeli/types";
import type { Automation } from "@/lib/automations/schemas";
import { db, schema } from "@/lib/db";

/** Server reads for pages. Mutations live in `src/lib/actions.ts`. */

type AccountRow = typeof schema.accounts.$inferSelect;
type AutomationRow = typeof schema.automations.$inferSelect;

/** Stats are counted from `runs` once the Comment to DM runtime sends anything. */
const NO_STATS = { triggered: 0, commentReplies: 0, openingDms: 0, buttonTaps: 0, finalDms: 0 };

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

export function toAutomation(row: AutomationRow): Automation {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    name: row.name,
    trigger: row.trigger,
    commentReply: row.commentReply,
    openingDm: row.openingDm,
    finalDm: row.finalDm,
    stats: NO_STATS,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    liveAt: row.liveAt?.toISOString() ?? null,
  };
}

export async function getConnectedAccount(): Promise<ConnectedAccount | null> {
  const [row] = await db().select().from(schema.accounts).where(eq(schema.accounts.status, "connected")).limit(1);
  return row ? toAccount(row) : null;
}

/** For pages that need an Instagram account: sends you to `/connect` without one. */
export async function requireAccount(): Promise<ConnectedAccount> {
  const account = await getConnectedAccount();
  if (!account) redirect("/connect");
  return account;
}

/** The account's automations, most recently updated first. */
export async function listAutomations(accountId: string): Promise<Automation[]> {
  const rows = await db().select().from(schema.automations).where(eq(schema.automations.accountId, accountId)).orderBy(desc(schema.automations.updatedAt));
  return rows.map(toAutomation);
}

export async function getAutomation(accountId: string, id: string): Promise<Automation | null> {
  const [row] = await db().select().from(schema.automations).where(and(eq(schema.automations.id, id), eq(schema.automations.accountId, accountId))).limit(1);
  return row ? toAutomation(row) : null;
}

/** Live automations on the account other than `selfId`, for the Go Live conflict rule. */
export async function otherLiveAutomations(accountId: string, selfId: string): Promise<Automation[]> {
  const rows = await db().select().from(schema.automations).where(and(
    eq(schema.automations.accountId, accountId),
    eq(schema.automations.status, "live"),
    ne(schema.automations.id, selfId),
  ));
  return rows.map(toAutomation);
}
