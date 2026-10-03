import { MOCK_MEDIA } from "@/lib/adeli/mock";
import type { AdeliMedia } from "@/lib/adeli/types";
import { defaultAutomationContent } from "@/lib/automations/defaults";
import type { Automation, MediaSnapshot } from "@/lib/automations/schemas";

export function snapshotOf(media: AdeliMedia): MediaSnapshot {
  return { thumbUrl: media.thumbnailUrl, mediaType: media.mediaType, caption: media.caption, permalink: media.permalink, publishedAt: media.publishedAt };
}

const HOUR = 60 * 60 * 1000;

/** Three automations covering every status, for "Load sample data". */
export function sampleAutomations(): Automation[] {
  const at = (hoursAgo: number) => new Date(Date.now() - hoursAgo * HOUR).toISOString();
  const base = defaultAutomationContent(0);
  const [guide, , , system, , , brain] = MOCK_MEDIA;
  return [
    {
      ...base,
      id: "auto_sample_guide",
      type: "comment_to_dm",
      name: "AI tools guide",
      status: "live",
      trigger: { postScope: "specific", mediaId: guide.id, mediaSnapshot: snapshotOf(guide), match: "keywords", keywords: ["guide", "tools"] },
      finalDm: { type: "text_buttons", text: "Here are the 5 AI tools! Enjoy and tell me which one you try first.", buttons: [{ label: "Get the guide", url: "https://mikareyes.com/ai" }] },
      stats: { triggered: 1284, commentReplies: 1279, openingDms: 1270, buttonTaps: 912, finalDms: 909 },
      createdAt: at(24 * 6),
      updatedAt: at(3),
      liveAt: at(24 * 6),
    },
    {
      ...base,
      id: "auto_sample_system",
      type: "comment_to_dm",
      name: "Content system template",
      status: "paused",
      trigger: { postScope: "specific", mediaId: system.id, mediaSnapshot: snapshotOf(system), match: "any", keywords: [] },
      finalDm: { type: "text_buttons", text: "Here's the content system template. Duplicate it and make it yours!", buttons: [{ label: "Open template", url: "https://notion.so/template" }] },
      stats: { triggered: 342, commentReplies: 340, openingDms: 338, buttonTaps: 201, finalDms: 201 },
      createdAt: at(24 * 12),
      updatedAt: at(28),
      liveAt: at(24 * 12),
    },
    {
      ...base,
      id: "auto_sample_brain",
      type: "comment_to_dm",
      name: "Second brain setup",
      status: "draft",
      trigger: { postScope: "specific", mediaId: brain.id, mediaSnapshot: snapshotOf(brain), match: "keywords", keywords: ["brain"] },
      stats: { triggered: 0, commentReplies: 0, openingDms: 0, buttonTaps: 0, finalDms: 0 },
      createdAt: at(5),
      updatedAt: at(5),
      liveAt: null,
    },
  ];
}
