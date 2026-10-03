"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useDemoState, type DemoState } from "@/lib/demo/store";

/**
 * Client-side stand-in for `proxy.ts` (PRD FR-0.1, FR-S.1). The order is the
 * onboarding order: log in, add an Adeli key, connect Instagram.
 */
export type Requirement = "session" | "key" | "ready";

export function nextOnboardingPath(state: DemoState): string {
  if (!state.session) return "/login";
  if (!state.adeliKey) return "/setup";
  if (!state.account) return "/connect";
  return "/automations";
}

function redirectFor(state: DemoState, requirement: Requirement): string | null {
  if (!state.session) return "/login";
  if (requirement === "session") return null;
  if (!state.adeliKey) return "/setup";
  if (requirement === "key") return null;
  if (!state.account) return "/connect";
  return null;
}

export function FullPageLoader() {
  return (
    <div className="grid min-h-screen place-items-center" role="status" aria-label="Loading">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}

export function Guard({ require, children }: { require: Requirement; children: React.ReactNode }) {
  const state = useDemoState();
  const router = useRouter();
  const redirect = state ? redirectFor(state, require) : null;
  useEffect(() => {
    if (redirect) router.replace(redirect);
  }, [redirect, router]);
  if (!state || redirect) return <FullPageLoader />;
  return children;
}
