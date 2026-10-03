import type { Automation, AutomationContent } from "./schemas";

/** Defaults for a new Comment to DM automation (PRD FR-5.x). No em dashes in any copy. */
export const DEFAULT_REPLY_VARIANTS = [
  "Sent you a DM! 📩",
  "Check your DMs 👀",
  "Just sent it over, check your inbox ✨",
];

export const DEFAULT_OPENING_DM = {
  text: "Hey there! Click below and I'll send you the link in a second.",
  buttonLabel: "Yes please",
};

export const DEFAULT_FINAL_DM = {
  text: "Here it is! Enjoy!",
  buttonLabel: "Click for link!",
  url: "https://tryadeli.com",
};

/** Used by the preview when the user hasn't typed a keyword yet. */
export const PREVIEW_FALLBACK_KEYWORD = "GUIDE";

export function defaultAutomationName(createdCount: number) {
  return `Comment to DM #${createdCount + 1}`;
}

export function defaultAutomationContent(createdCount: number): AutomationContent {
  return {
    name: defaultAutomationName(createdCount),
    trigger: { postScope: "specific", mediaId: null, mediaSnapshot: null, match: "keywords", keywords: [] },
    commentReply: { enabled: true, variants: [...DEFAULT_REPLY_VARIANTS] },
    openingDm: { ...DEFAULT_OPENING_DM },
    finalDm: { type: "text_buttons", text: DEFAULT_FINAL_DM.text, buttons: [{ label: DEFAULT_FINAL_DM.buttonLabel, url: DEFAULT_FINAL_DM.url }] },
  };
}

export function newDraftAutomation(id: string, createdCount: number, now = new Date()): Automation {
  const timestamp = now.toISOString();
  return {
    id,
    type: "comment_to_dm",
    status: "draft",
    ...defaultAutomationContent(createdCount),
    stats: { triggered: 0, commentReplies: 0, openingDms: 0, buttonTaps: 0, finalDms: 0 },
    createdAt: timestamp,
    updatedAt: timestamp,
    liveAt: null,
  };
}
