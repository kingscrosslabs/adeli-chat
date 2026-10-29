/** Runs once when the server starts (Next.js instrumentation). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { migrateDatabase } = await import("@/lib/db");
  await migrateDatabase();
  const { ensureAdeliWebhook } = await import("@/lib/runtime/webhook-registration");
  try {
    const webhook = await ensureAdeliWebhook();
    console.info(`Adeli webhook ${webhook.created ? "created" : "reused"}: ${webhook.id}`);
  } catch (error) {
    // Setup retries this once the key works, so a bad key or a down Adeli doesn't stop the app starting.
    console.warn(`Couldn't register the Adeli webhook: ${error instanceof Error ? error.message : String(error)}`);
  }
}
