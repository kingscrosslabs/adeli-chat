"use client";

import { useEffect, useState } from "react";

import { defaultAutomationContent } from "@adeli-chat/ui/automation/defaults";
import type { AutomationContent } from "@adeli-chat/ui/automation/schemas";
import { PhonePreview, type PreviewAccount, type PreviewTab } from "@adeli-chat/ui/preview/phone-preview";

const base = defaultAutomationContent(0);

/** A sample automation, so the landing page shows the same preview the editor does. */
const SAMPLE: AutomationContent = {
  ...base,
  name: "AI guide",
  trigger: {
    ...base.trigger,
    keywords: ["GUIDE"],
    mediaSnapshot: {
      thumbUrl: "/landing/sample-post.svg",
      mediaType: "REEL",
      caption: "5 AI tools that save me 10 hours a week. Comment GUIDE and I'll send you the full list 👇",
      permalink: null,
      publishedAt: null,
    },
  },
  openingDm: { text: "Hey! Thanks for the comment. Tap below and I'll send you the guide.", buttonLabel: "Send it" },
  finalDm: { type: "text_buttons", text: "Here's the AI guide. Enjoy!", buttons: [{ label: "Open the guide", url: "https://tryadeli.com" }] },
};

/** Whose account the sample shows. Display only: the preview reads the name, handle and avatar. */
const ACCOUNT: PreviewAccount = {
  displayName: "Mika Reyes",
  displayIdentifier: "its.mikareyes",
  avatarUrl: null,
};

const CYCLE: PreviewTab[] = ["post", "comments", "dm"];
const CYCLE_MS = 3500;

/** Steps through Post, Comments and DM until the visitor picks a tab. Stays put with reduced motion. */
export function HeroPreview() {
  const [tab, setTab] = useState<PreviewTab>("post");
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setTab((current) => CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length]), CYCLE_MS);
    return () => window.clearInterval(timer);
  }, [auto]);

  function choose(next: PreviewTab) {
    setAuto(false);
    setTab(next);
  }

  return <PhonePreview content={SAMPLE} account={ACCOUNT} tab={tab} onTabChange={choose} disclaimer={false} />;
}
