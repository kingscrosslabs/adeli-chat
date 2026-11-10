/**
 * Runs once when the server starts (Next.js instrumentation). On Vercel every
 * cold start is a "start", so it does nothing there: the build applies
 * migrations, and connecting Instagram (or Check connection in Settings)
 * registers the webhook.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build" || process.env.VERCEL) return;
  const { migrateDatabase } = await import("@/lib/db");
  await migrateDatabase();
  const { ensureAdeliWebhook } = await import("@/lib/runtime/webhook-registration");
  const { usersWithProfile } = await import("@/lib/user-settings");
  for (const userId of await usersWithProfile()) {
    try {
      const webhook = await ensureAdeliWebhook(userId);
      console.info(`Adeli webhook for ${userId} ${webhook.created ? "created" : "reused"}: ${webhook.id}`);
    } catch (error) {
      // Connecting Instagram retries this, so a bad key or a down Adeli doesn't stop the app starting.
      console.warn(`Couldn't register the Adeli webhook for ${userId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
