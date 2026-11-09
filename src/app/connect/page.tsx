import { redirect } from "next/navigation";

import { ConnectCard } from "@/components/onboarding/connect-card";
import { OnboardingLayout } from "@/components/onboarding/onboarding-layout";
import { getAppSettings } from "@/lib/app-settings";
import { listProfiles } from "@/lib/adeli/instagram";
import { findAdeliConfig } from "@/lib/adeli/key";
import { requireUserPage } from "@/lib/auth/session";
import { getConnectedAccount } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ConnectPage() {
  await requireUserPage();
  if (!(await findAdeliConfig().catch(() => null))) redirect("/setup");
  const [settings, account] = await Promise.all([getAppSettings(), getConnectedAccount()]);
  // Setup records the key's default profile. Ask Adeli if Setup was skipped.
  const profileId = settings.adeliProfileId ?? (await listProfiles().catch(() => []))[0]?.id ?? null;
  return (
    <OnboardingLayout step="account">
      <ConnectCard profileId={profileId} currentAccountId={account?.accountId ?? null} />
    </OnboardingLayout>
  );
}
