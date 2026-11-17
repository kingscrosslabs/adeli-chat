import "server-only";

import { and, eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { escapeSlack } from "@/lib/slack";

/** "Ada Lovelace (ada@example.com) @ada", escaped for Slack. The handle only when an account is connected. */
export async function describeUser(userId: string): Promise<string> {
  const [user] = await db().select({ name: schema.authUser.name, email: schema.authUser.email }).from(schema.authUser).where(eq(schema.authUser.id, userId)).limit(1);
  const [account] = await db().select({ handle: schema.accounts.handle }).from(schema.accounts).where(and(eq(schema.accounts.userId, userId), eq(schema.accounts.status, "connected"))).limit(1);
  const who = user ? `${escapeSlack(user.name || user.email)} (${escapeSlack(user.email)})` : escapeSlack(userId);
  return account ? `${who} @${escapeSlack(account.handle)}` : who;
}
