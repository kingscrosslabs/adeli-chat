import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { deleteUserProfile } from "@/lib/adeli/profile";
import { LOCAL_USER } from "@/lib/auth/config";
import { ServiceError } from "@/lib/automations/service";
import { getBillingCustomer, planOf } from "@/lib/billing/state";
import { db, schema } from "@/lib/db";
import { deleteLoopsContact } from "@/lib/loops";
import { getUserSettings } from "@/lib/user-settings";

/** Why an account can't be deleted yet, or null when it can. Shown to the user as is. */
export async function deletionBlocker(userId: string): Promise<string | null> {
  if (userId === LOCAL_USER.id) return "The local user can't be deleted. Sign-in is off on this server.";
  const [connected] = await db().select({ id: schema.accounts.id }).from(schema.accounts)
    .where(and(eq(schema.accounts.userId, userId), eq(schema.accounts.status, "connected"))).limit(1);
  if (connected) return "Disconnect your Instagram account first.";
  if (planOf(await getBillingCustomer(userId)) === "pro") return "Cancel your Pro subscription in Manage billing first.";
  return null;
}

/**
 * Deletes a user and everything LedaChat keeps for them: automations, runs,
 * leads, Instagram account rows, settings, API tokens, sessions, MCP grants
 * and billing row. Refused while an Instagram account is connected or Pro is
 * active (`deletionBlocker`), so nothing live is left running.
 *
 * Afterwards it deletes their Adeli profile and Loops contact. Those are best
 * effort: a failure is logged and never undoes the deletion.
 */
export async function deleteUserAccount(user: { id: string; email: string }): Promise<void> {
  const blocker = await deletionBlocker(user.id);
  if (blocker) throw new ServiceError(blocker);
  const settings = await getUserSettings(user.id);

  await db().transaction(async (tx) => {
    const accounts = tx.select({ id: schema.accounts.id }).from(schema.accounts).where(eq(schema.accounts.userId, user.id));
    // Automations point at the account without a cascade; runs and leads cascade from them.
    await tx.delete(schema.automations).where(inArray(schema.automations.accountId, accounts));
    // Everything else references the user with ON DELETE CASCADE.
    await tx.delete(schema.authUser).where(eq(schema.authUser.id, user.id));
  });

  if (settings.adeliProfileId) {
    await deleteUserProfile(settings.adeliProfileId, settings.adeliWebhookId).catch((error: unknown) => console.warn(`Couldn't delete the Adeli profile of deleted user ${user.id}: ${error instanceof Error ? error.message : String(error)}`));
  }
  await deleteLoopsContact(user.email).catch((error: unknown) => console.warn(`Couldn't delete the Loops contact of deleted user ${user.id}: ${error instanceof Error ? error.message : String(error)}`));
}
