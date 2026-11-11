import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LandingPage } from "@/components/landing/landing-page";
import { authEnabled } from "@/lib/auth/config";
import { getCurrentUser } from "@/lib/auth/session";
import { landingEnabled } from "@/lib/landing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Adeli Chat: Free, Open-Source ManyChat Alternative for Instagram" },
  description: "Comment-to-DM workflow, with an MCP. Free & open source.",
};

/**
 * `/` is the landing page when `LANDING_PAGE=on` and nobody is signed in.
 * Otherwise it goes to your automations (PRD §4); `proxy.ts` and the
 * automations pages send you to the first unfinished onboarding step instead.
 */
export default async function Home() {
  if (landingEnabled() && !(authEnabled() && (await getCurrentUser()))) return <LandingPage />;
  redirect("/automations");
}
