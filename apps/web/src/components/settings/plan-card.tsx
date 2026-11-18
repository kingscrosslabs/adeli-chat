"use client";

import { AlertTriangle, CreditCard, Loader2, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@adeli-chat/ui/components/alert";
import { Badge } from "@adeli-chat/ui/components/badge";
import { Button } from "@adeli-chat/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@adeli-chat/ui/components/card";
import { BRANDING_TEXT, FREE_LIVE_AUTOMATIONS, PRO_MONTHLY_DOLLARS } from "@adeli-chat/ui/billing/plans";
import { openBillingPortal, startCheckout } from "@/lib/actions";

/** What Settings knows about the user's plan, from `billing_customers` (never Stripe). */
export type PlanStatus = {
  plan: "free" | "pro";
  status: string | null;
  cancelAtPeriodEnd: boolean;
  /** ISO date: when Pro renews, or ends when cancelling. */
  periodEnd: string | null;
  taxLocationInvalid: boolean;
  hasCustomer: boolean;
};

function day(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : null;
}

/** Free or Pro, with Upgrade (Stripe Checkout) or Manage billing (Customer Portal). Shown only when billing is on. */
export function PlanCard({ plan, liveCount }: { plan: PlanStatus; liveCount: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const [opening, setOpening] = useState(false);
  const refreshed = useRef(false);
  const pro = plan.plan === "pro";
  const returned = params.get("checkout") === "success";

  useEffect(() => {
    if (!returned) return;
    if (pro) {
      toast.success("You're on Pro.", { description: "Unlimited live automations, no LedaChat message after your DMs, and messaging earlier comments." });
      router.replace("/settings#plan");
    } else if (!refreshed.current) {
      // The webhook can land a moment after Stripe sends you back: look again once.
      refreshed.current = true;
      const timer = setTimeout(() => router.refresh(), 3000);
      return () => clearTimeout(timer);
    }
  }, [returned, pro, router]);

  async function open(action: typeof startCheckout) {
    setOpening(true);
    const result = await action();
    if (result.ok) {
      window.location.assign(result.url);
      return;
    }
    setOpening(false);
    toast.error(result.reason === "error" ? result.message : "Something went wrong. Try again.");
  }

  const renews = day(plan.periodEnd);
  return (
    <Card id="plan" className="scroll-mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-link" /> Plan <Badge variant={pro ? "default" : "secondary"}>{pro ? "Pro" : "Free"}</Badge></CardTitle>
        <CardDescription>
          {pro
            ? plan.cancelAtPeriodEnd ? `Pro until ${renews ?? "the end of this period"}. After that you're on Free.` : `Unlimited live automations, no LedaChat message after your DMs, and messaging earlier comments. ${renews ? `Renews ${renews}.` : ""}`
            : `${liveCount} of ${FREE_LIVE_AUTOMATIONS} live automations. Your Final DM is followed by "${BRANDING_TEXT}".`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {plan.status === "past_due" ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Your last payment didn&apos;t go through</AlertTitle>
            <AlertDescription>Stripe will try again. Update your card in Manage billing to keep Pro.</AlertDescription>
          </Alert>
        ) : null}
        {plan.taxLocationInvalid ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Check your billing address</AlertTitle>
            <AlertDescription>We can&apos;t work out the tax on your invoice. Fix your address in Manage billing.</AlertDescription>
          </Alert>
        ) : null}
        {returned && !pro ? <p className="text-sm text-muted-foreground"><Loader2 className="mr-1.5 inline size-3.5 animate-spin" />Confirming your payment…</p> : null}
        <div className="flex flex-wrap gap-2">
          {pro ? null : (
            <Button onClick={() => void open(startCheckout)} disabled={opening}>
              {opening ? <Loader2 className="animate-spin" /> : null} Upgrade to Pro, ${PRO_MONTHLY_DOLLARS}/month
            </Button>
          )}
          {plan.hasCustomer && (pro || plan.status) ? (
            <Button variant="outline" onClick={() => void open(openBillingPortal)} disabled={opening}><CreditCard /> Manage billing</Button>
          ) : null}
        </div>
        {pro ? null : <p className="text-sm text-muted-foreground">Pro removes the {FREE_LIVE_AUTOMATIONS}-automation limit and the LedaChat message. Cancel any time.</p>}
      </CardContent>
    </Card>
  );
}
