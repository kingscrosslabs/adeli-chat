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

export const triggerSchema = z.object({
  postScope: z.literal("specific"),
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
  finalDms: z.number(),
});
export type AutomationStats = z.infer<typeof automationStatsSchema>;

/** The editable content of an automation, everything the editor form owns. */
export const automationContentSchema = z.object({
  name: z.string(),
  trigger: triggerSchema,
  commentReply: commentReplySchema,
  openingDm: openingDmSchema,
  finalDm: finalDmSchema,
});
export type AutomationContent = z.infer<typeof automationContentSchema>;

export const automationSchema = automationContentSchema.extend({
  id: z.string(),
  type: z.literal("comment_to_dm"),
  status: automationStatusSchema,
  stats: automationStatsSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  liveAt: z.string().nullable(),
});
export type Automation = z.infer<typeof automationSchema>;
