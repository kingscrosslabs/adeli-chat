import "server-only";

/**
 * Stripe billing is on only when both keys are set: the hosted LedaChat.
 * Without them (local development, every self-hosted install) there are no
 * plans, so nothing is limited. (Branding follows LEDACHAT_BRANDING, `src/lib/plan.ts`.) See docs/billing.md.
 */
export type StripeConfig = { secretKey: string; webhookSecret: string };

export function getStripeConfig(): StripeConfig | null {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secretKey || !webhookSecret) return null;
  if (secretKey.startsWith("pk_")) throw new Error("STRIPE_SECRET_KEY is a publishable key (pk_). Use a restricted key (rk_) or a secret key (sk_).");
  return { secretKey, webhookSecret };
}

export function billingEnabled(): boolean {
  return getStripeConfig() !== null;
}
