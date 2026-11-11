import { z } from "zod";

/**
 * Shapes shared by the UI, API and worker (PRD §6). The JSON columns on
 * `automations` are validated with these, so the editor and the runtime can
 * never disagree about what an automation looks like.
 */

export const LIMITS = {
  name: 80,
  keywords: 20,
  keyword: 50,
  replyVariants: 10,
  replyVariant: 300,
  dmText: 640,
  buttonLabel: 20,
  url: 2048,
} as const;

/**
 * What starts an automation. `comment_to_dm` is a comment on a post.
 * `story_reply` is a DM replying to one of the account's stories: it has no
 * public reply, and its trigger watches one story (`postScope: "specific"`, the
 * story's id in `mediaId`) or every story (`"any"`), never `"next"`.
 * Everything after the trigger, from the Opening DM on, is the same flow.
 */
export const automationTypeSchema = z.enum(["comment_to_dm", "story_reply"]);
export type AutomationType = z.infer<typeof automationTypeSchema>;

export const mediaTypeSchema = z.enum(["IMAGE", "VIDEO", "REEL", "CAROUSEL_ALBUM"]);
export type MediaType = z.infer<typeof mediaTypeSchema>;

export const mediaSnapshotSchema = z.object({
  thumbUrl: z.string().nullable(),
  mediaType: mediaTypeSchema,
  caption: z.string(),
  permalink: z.string().nullable(),
  publishedAt: z.string().nullable(),
});
export type MediaSnapshot = z.infer<typeof mediaSnapshotSchema>;

/** Instagram keeps a story up for 24 hours. */
export const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;

/** Whether an automation's picked story has expired, so it can't get new replies. False when nothing is picked. */
export function storyExpired(automation: { type: AutomationType; trigger: { postScope: PostScope; mediaSnapshot: MediaSnapshot | null } }, now = Date.now()) {
  const publishedAt = automation.trigger.mediaSnapshot?.publishedAt;
  if (automation.type !== "story_reply" || automation.trigger.postScope !== "specific" || !publishedAt) return false;
  return Date.parse(publishedAt) + STORY_LIFETIME_MS <= now;
}

/**
 * Which posts an automation watches. `specific` is the post in `mediaId`.
 * `next` is the first post published after it goes live: the runtime fills
 * `mediaId` on that post's first comment, and from then on it acts like
 * `specific`. `any` is every post. A comment on a post with a `specific`
 * automation goes to that one first, then `next`, then `any`.
 */
export const postScopeSchema = z.enum(["specific", "next", "any"]);
export type PostScope = z.infer<typeof postScopeSchema>;

export const triggerSchema = z.object({
  postScope: postScopeSchema,
  mediaId: z.string().nullable(),
  mediaSnapshot: mediaSnapshotSchema.nullable(),
  match: z.enum(["keywords", "any"]),
  keywords: z.array(z.string()),
});
export type Trigger = z.infer<typeof triggerSchema>;

export const commentReplySchema = z.object({
  enabled: z.boolean(),
  variants: z.array(z.string()),
});
export type CommentReply = z.infer<typeof commentReplySchema>;

export const openingDmSchema = z.object({
  text: z.string(),
  buttonLabel: z.string(),
});
export type OpeningDm = z.infer<typeof openingDmSchema>;

/** Asks for an email after the tap. The Final DM goes out once they reply with a valid one, and the email is saved as a lead. */
export const emailCaptureSchema = z.object({
  enabled: z.boolean(),
  /** The question, sent after they tap the Opening DM button. */
  text: z.string(),
  /** Sent once when a reply doesn't contain an email. */
  retryText: z.string(),
});
export type EmailCapture = z.infer<typeof emailCaptureSchema>;

/**
 * Comment to DM only: after the tap, checks that they follow the account
 * before sending anything else. If they don't, sends `text` with a button
 * that checks again; each later tap that still finds no follow gets `retryText`.
 */
export const followGateSchema = z.object({
  enabled: z.boolean(),
  text: z.string(),
  buttonLabel: z.string(),
  retryText: z.string(),
});
export type FollowGate = z.infer<typeof followGateSchema>;

export const linkButtonSchema = z.object({
  label: z.string(),
  url: z.string(),
});
export type LinkButton = z.infer<typeof linkButtonSchema>;

export const finalDmSchema = z.object({
  type: z.literal("text_buttons"),
  text: z.string(),
  /** The data model allows up to 3 buttons. The v1 UI edits only the first. */
  buttons: z.array(linkButtonSchema).min(1).max(3),
});
export type FinalDm = z.infer<typeof finalDmSchema>;

export const automationStatusSchema = z.enum(["draft", "live", "paused"]);
export type AutomationStatus = z.infer<typeof automationStatusSchema>;

export const automationStatsSchema = z.object({
  triggered: z.number(),
  commentReplies: z.number(),
  openingDms: z.number(),
  buttonTaps: z.number(),
  emails: z.number(),
  finalDms: z.number(),
});
export type AutomationStats = z.infer<typeof automationStatsSchema>;

/** The editable content of an automation, everything the editor form owns. */
export const automationContentSchema = z.object({
  /** Set when it's created and never changed by a save. Defaults so older callers (MCP clients, saved drafts) still parse. */
  type: automationTypeSchema.default("comment_to_dm"),
  name: z.string(),
  trigger: triggerSchema,
  commentReply: commentReplySchema,
  openingDm: openingDmSchema,
  /** Optional so older callers (MCP clients, saved drafts) still parse; read it through `emailCaptureOf`. */
  emailCapture: emailCaptureSchema.optional(),
  /** Optional for the same reason; read it through `followGateOf`. */
  followGate: followGateSchema.optional(),
  finalDm: finalDmSchema,
});
export type AutomationContent = z.infer<typeof automationContentSchema>;

export const automationSchema = automationContentSchema.extend({
  id: z.string(),
  status: automationStatusSchema,
  stats: automationStatsSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  liveAt: z.string().nullable(),
});
export type Automation = z.infer<typeof automationSchema>;

export const DEFAULT_EMAIL_CAPTURE: EmailCapture = {
  enabled: false,
  text: "What's the best email to send it to?",
  retryText: "Hmm, that doesn't look like an email. Can you send it again?",
};

export function emailCaptureOf(content: Pick<AutomationContent, "emailCapture">): EmailCapture {
  return content.emailCapture ?? DEFAULT_EMAIL_CAPTURE;
}

export const DEFAULT_FOLLOW_GATE: FollowGate = {
  enabled: false,
  text: "One last step! Follow me, then tap below and I'll send it over.",
  buttonLabel: "I'm following",
  retryText: "I don't see your follow yet. Follow me, then tap below again.",
};

/** The follow gate as the runtime applies it: always off for a Story Reply. */
export function followGateOf(content: Pick<AutomationContent, "type" | "followGate">): FollowGate {
  const gate = content.followGate ?? DEFAULT_FOLLOW_GATE;
  return content.type === "story_reply" ? { ...gate, enabled: false } : gate;
}
