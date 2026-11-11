import { DEFAULT_EMAIL_CAPTURE, DEFAULT_FOLLOW_GATE, type Automation, type AutomationContent, type AutomationType } from "./schemas";

/** Defaults for a new automation (PRD FR-5.x). No em dashes in any copy. */
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

export const AUTOMATION_TYPE_LABEL: Record<AutomationType, string> = {
  comment_to_dm: "Comment to DM",
  story_reply: "Story Reply",
};

export function defaultAutomationName(createdCount: number, type: AutomationType = "comment_to_dm") {
  return `${AUTOMATION_TYPE_LABEL[type]} #${createdCount + 1}`;
}

export function defaultAutomationContent(createdCount: number, type: AutomationType = "comment_to_dm"): AutomationContent {
  const story = type === "story_reply";
  return {
    type,
    name: defaultAutomationName(createdCount, type),
    trigger: { postScope: "specific", mediaId: null, mediaSnapshot: null, match: "keywords", keywords: [] },
    // Stories have no public comments, so a story reply never posts one.
    commentReply: { enabled: !story, variants: [...DEFAULT_REPLY_VARIANTS] },
    openingDm: { ...DEFAULT_OPENING_DM },
    emailCapture: { ...DEFAULT_EMAIL_CAPTURE },
    followGate: { ...DEFAULT_FOLLOW_GATE },
    finalDm: { type: "text_buttons", text: DEFAULT_FINAL_DM.text, buttons: [{ label: DEFAULT_FINAL_DM.buttonLabel, url: DEFAULT_FINAL_DM.url }] },
  };
}

export function newDraftAutomation(id: string, createdCount: number, now = new Date()): Automation {
  const timestamp = now.toISOString();
  return {
    id,
    status: "draft",
    ...defaultAutomationContent(createdCount),
    stats: { triggered: 0, commentReplies: 0, openingDms: 0, buttonTaps: 0, emails: 0, finalDms: 0 },
    createdAt: timestamp,
    updatedAt: timestamp,
    liveAt: null,
  };
}
