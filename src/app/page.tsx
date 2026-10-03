"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { FullPageLoader, nextOnboardingPath } from "@/components/guard";
import { useDemoState } from "@/lib/demo/store";

/** `/` sends you to the first unfinished step, or to your automations (PRD §4). */
export default function Home() {
  const state = useDemoState();
  const router = useRouter();
  useEffect(() => {
    if (state) router.replace(nextOnboardingPath(state));
  }, [state, router]);
  return <FullPageLoader />;
}
