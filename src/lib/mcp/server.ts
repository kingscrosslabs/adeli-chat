import "server-only";

import { McpServer, type CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";

import { findMedia, listMedia } from "@/lib/adeli/instagram";
import { AdeliError } from "@/lib/adeli/types";
import { appUrl } from "@/lib/app-url";
import { snapshotOf } from "@/lib/automations/snapshot";
import { LIMITS, emailCaptureOf, type Automation, type AutomationContent } from "@/lib/automations/schemas";
import * as service from "@/lib/automations/service";
import { triggerSummary } from "@/lib/automations/validate";
import { getAutomation, getConnectedAccount, listAutomations, type ConnectedAccount } from "@/lib/data";
import { getUserSettings } from "@/lib/user-settings";

import { MCP_DISPLAY_NAME, MCP_SERVER_NAME } from "./config";

/**
 * The Adeli Chat MCP server: list, create and manage Comment to DM
 * automations. One instance per request, for one user (`principal`), who was
 * already authenticated by `/mcp`. Every tool goes through the same service as
 * the app (`src/lib/automations/service.ts`) and only reaches automations on
 * that user's own Instagram account.
 */

export type McpPrincipal = { userId: string; canWrite: boolean };

const INSTRUCTIONS = `Adeli Chat runs Instagram Comment to DM automations for the signed-in user's connected Instagram account.

How an automation works:
1. Someone comments (trigger). postScope says where: "specific" (one post, set postId), "next" (the first post published after it goes live) or "any" (every post; a post with its own automation uses that one first). It matches either specific keywords (case-insensitive) or any comment.
2. Optionally, a public reply is posted under their comment (one variant is picked at random).
3. They get an Opening DM: a message with one button. Instagram only allows this one message until they tap.
4. Optionally, after the tap we ask for their email (emailCaptureEnabled). The Final DM waits until they reply with a valid email, which is saved as a lead the user can export in the app.
5. They get the Final DM: a message with a link button (https only).
Each person gets the flow once per automation.

Limits: name ${LIMITS.name} chars, keywords up to ${LIMITS.keyword} chars each, replies ${LIMITS.replyVariant} chars each, DM text ${LIMITS.dmText} chars, button labels ${LIMITS.buttonLabel} chars.

Statuses: draft (not running), live (running), paused. New automations are always drafts. Use go_live to start one; it checks every field and that no other live automation with the same scope (and, for "specific", the same post) shares a keyword (or uses any comment).
Use list_posts to find a post id before setting postId. Saving a live automation applies at once and must still pass the go live checks.
The Adeli API key and Instagram account are managed in the app at ${"{appUrl}"}/settings, not through these tools.`;

function json(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function fail(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

function automationUrl(id: string) {
  return `${appUrl()}/automations/${id}`;
}

function summary(automation: Automation) {
  return {
    id: automation.id,
    name: automation.name,
    status: automation.status,
    trigger: triggerSummary(automation),
    postScope: automation.trigger.postScope,
    post: automation.trigger.mediaSnapshot
      ? { id: automation.trigger.mediaId, caption: automation.trigger.mediaSnapshot.caption.slice(0, 120), permalink: automation.trigger.mediaSnapshot.permalink }
      : automation.trigger.mediaId ? { id: automation.trigger.mediaId } : null,
    stats: automation.stats,
    updatedAt: automation.updatedAt,
    url: automationUrl(automation.id),
  };
}

function detail(automation: Automation) {
  const button = automation.finalDm.buttons[0];
  return {
    id: automation.id,
    name: automation.name,
    status: automation.status,
    url: automationUrl(automation.id),
    postScope: automation.trigger.postScope,
    postId: automation.trigger.mediaId,
    post: automation.trigger.mediaSnapshot,
    match: automation.trigger.match,
    keywords: automation.trigger.keywords,
    commentReplyEnabled: automation.commentReply.enabled,
    commentReplies: automation.commentReply.variants,
    openingDmText: automation.openingDm.text,
    openingDmButtonLabel: automation.openingDm.buttonLabel,
    emailCaptureEnabled: emailCaptureOf(automation).enabled,
    emailCaptureText: emailCaptureOf(automation).text,
    emailCaptureRetryText: emailCaptureOf(automation).retryText,
    finalDmText: automation.finalDm.text,
    linkButtonLabel: button?.label ?? "",
    linkUrl: button?.url ?? "",
    stats: automation.stats,
    createdAt: automation.createdAt,
    updatedAt: automation.updatedAt,
    liveAt: automation.liveAt,
  };
}

/** Editable fields, flattened so they're easy to fill in. Every one is optional. */
const fieldsSchema = {
  name: z.string().max(LIMITS.name).optional().describe("Name shown in Adeli Chat."),
  postScope: z.enum(["specific", "next", "any"]).optional().describe("Which posts trigger it: one specific post (set postId), the next post published after going live, or any post."),
  postId: z.string().optional().describe("Instagram media id of the post or reel, from list_posts. Only for postScope specific; setting it also sets postScope to specific."),
  match: z.enum(["keywords", "any"]).optional().describe("Reply to comments with specific keywords, or to any comment."),
  keywords: z.array(z.string().max(LIMITS.keyword)).max(LIMITS.keywords).optional().describe("Keywords that trigger the automation (case-insensitive). Replaces the whole list."),
  commentReplyEnabled: z.boolean().optional().describe("Post a public reply under the comment."),
  commentReplies: z.array(z.string().max(LIMITS.replyVariant)).max(LIMITS.replyVariants).optional().describe("Public reply variants; one is picked at random. Replaces the whole list."),
  openingDmText: z.string().max(LIMITS.dmText).optional().describe("First DM. Sent right after the comment."),
  openingDmButtonLabel: z.string().max(LIMITS.buttonLabel).optional().describe("Button on the first DM. Tapping it sends the final DM."),
  emailCaptureEnabled: z.boolean().optional().describe("Ask for their email after the tap, before the final DM. Emails are saved as leads."),
  emailCaptureText: z.string().max(LIMITS.dmText).optional().describe("The message that asks for their email."),
  emailCaptureRetryText: z.string().max(LIMITS.dmText).optional().describe("Sent once if their reply doesn't contain an email."),
  finalDmText: z.string().max(LIMITS.dmText).optional().describe("Final DM, sent after they tap the button (or send their email, when that step is on)."),
  linkButtonLabel: z.string().max(LIMITS.buttonLabel).optional().describe("Label of the link button on the final DM."),
  linkUrl: z.string().max(LIMITS.url).optional().describe("Where the link button goes. Must start with https://"),
};
const fieldsObject = z.object(fieldsSchema);
type Fields = z.infer<typeof fieldsObject>;

/** Applies `fields` onto `content`. A new `postId` is looked up on Instagram for its caption and thumbnail. */
async function applyFields(userId: string, account: ConnectedAccount, content: AutomationContent, fields: Fields): Promise<AutomationContent> {
  const next: AutomationContent = structuredClone(content);
  if (fields.name !== undefined) next.name = fields.name;
  if (fields.postId !== undefined && fields.postId !== content.trigger.mediaId) {
    const media = await findMedia(userId, account.accountId, fields.postId);
    if (!media) throw new service.ServiceError(`There's no post with id ${fields.postId} on @${account.displayIdentifier}. Use list_posts to find one.`);
    next.trigger.postScope = "specific";
    next.trigger.mediaId = media.id;
    next.trigger.mediaSnapshot = snapshotOf(media);
  }
  if (fields.postScope !== undefined && fields.postScope !== next.trigger.postScope) {
    next.trigger.postScope = fields.postScope;
    if (fields.postScope !== "specific") {
      next.trigger.mediaId = null;
      next.trigger.mediaSnapshot = null;
    }
  }
  if (fields.match !== undefined) next.trigger.match = fields.match;
  if (fields.keywords !== undefined) next.trigger.keywords = fields.keywords.map((keyword) => keyword.trim()).filter(Boolean);
  if (fields.commentReplyEnabled !== undefined) next.commentReply.enabled = fields.commentReplyEnabled;
  if (fields.commentReplies !== undefined) next.commentReply.variants = fields.commentReplies;
  if (fields.openingDmText !== undefined) next.openingDm.text = fields.openingDmText;
  if (fields.openingDmButtonLabel !== undefined) next.openingDm.buttonLabel = fields.openingDmButtonLabel;
  if (fields.emailCaptureEnabled !== undefined || fields.emailCaptureText !== undefined || fields.emailCaptureRetryText !== undefined) {
    const email = emailCaptureOf(next);
    next.emailCapture = {
      enabled: fields.emailCaptureEnabled ?? email.enabled,
      text: fields.emailCaptureText ?? email.text,
      retryText: fields.emailCaptureRetryText ?? email.retryText,
    };
  }
  if (fields.finalDmText !== undefined) next.finalDm.text = fields.finalDmText;
  if (fields.linkButtonLabel !== undefined || fields.linkUrl !== undefined) {
    const [first, ...rest] = next.finalDm.buttons;
    next.finalDm.buttons = [{ label: fields.linkButtonLabel ?? first?.label ?? "", url: fields.linkUrl?.trim() ?? first?.url ?? "" }, ...rest];
  }
  return next;
}

function rejected(result: Exclude<service.ActionResult, { ok: true }>): CallToolResult {
  if (result.reason === "invalid") {
    const lines = Object.entries(result.errors).map(([field, message]) => `- ${field}: ${message}`);
    return fail(`This automation can't be live yet. Fix ${result.count === 1 ? "this field" : "these fields"} and try again:\n${lines.join("\n")}`);
  }
  if (result.reason === "conflict") return fail(`${result.message} Pause that one (id ${result.conflictId}) or use different keywords.`);
  return fail(result.message);
}

export function createAdeliChatMcpServer(principal: McpPrincipal): McpServer {
  const { userId } = principal;
  const server = new McpServer(
    { name: MCP_SERVER_NAME, title: MCP_DISPLAY_NAME, version: "1.0.0" },
    { instructions: INSTRUCTIONS.replace("{appUrl}", appUrl()) },
  );

  /** Runs a tool, turning problems the user can fix into tool errors Claude can read. */
  async function run(write: boolean, body: () => Promise<CallToolResult>): Promise<CallToolResult> {
    if (write && !principal.canWrite) return fail("This connection is read only. Create a token with write access on the Connect to AI Agent page in Adeli Chat, or reconnect and allow changes.");
    try {
      return await body();
    } catch (error) {
      if (error instanceof service.ServiceError || error instanceof AdeliError) return fail(error.message);
      throw error;
    }
  }

  async function account() {
    return service.requireAccount(userId);
  }

  server.registerTool("get_workspace", {
    title: "Get workspace",
    description: "The connected Instagram account, whether the Adeli key works, and how many automations there are by status. Call this first if other tools say setup isn't done.",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, () => run(false, async () => {
    const [connected, settings] = await Promise.all([getConnectedAccount(userId), getUserSettings(userId)]);
    const automations = connected ? await listAutomations(connected.id) : [];
    const counts = { draft: 0, live: 0, paused: 0 };
    for (const automation of automations) counts[automation.status] += 1;
    return json({
      instagram: connected ? { handle: `@${connected.displayIdentifier}`, name: connected.displayName } : null,
      adeliKey: settings.adeliKeyStatus,
      automations: counts,
      settingsUrl: `${appUrl()}/settings`,
      setupNeeded: connected ? null : "Connect an Instagram account in Adeli Chat first.",
    });
  }));

  server.registerTool("list_automations", {
    title: "List automations",
    description: "Every Comment to DM automation on the connected Instagram account, most recently updated first, with its trigger, post and stats.",
    inputSchema: z.object({ status: z.enum(["draft", "live", "paused"]).optional().describe("Only automations with this status.") }),
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, ({ status }) => run(false, async () => {
    const automations = await listAutomations((await account()).id);
    return json(automations.filter((automation) => !status || automation.status === status).map(summary));
  }));

  server.registerTool("get_automation", {
    title: "Get automation",
    description: "Everything about one automation: trigger, replies, both DMs, status and stats.",
    inputSchema: z.object({ id: z.string().describe("Automation id.") }),
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, ({ id }) => run(false, async () => {
    const automation = await getAutomation((await account()).id, id);
    return automation ? json(detail(automation)) : fail("There's no automation with that id.");
  }));

  server.registerTool("list_posts", {
    title: "List Instagram posts",
    description: "Recent posts and reels on the connected Instagram account, newest first, 9 per page. Use an id from here as postId.",
    inputSchema: z.object({ page: z.number().int().min(0).default(0).describe("Page number, starting at 0.") }),
    annotations: { readOnlyHint: true, openWorldHint: true },
  }, ({ page }) => run(false, async () => {
    const { media, hasMore } = await listMedia(userId, (await account()).accountId, page);
    return json({
      posts: media.map((post) => ({ id: post.id, type: post.mediaType, caption: post.caption.slice(0, 200), permalink: post.permalink, publishedAt: post.publishedAt, comments: post.comments })),
      nextPage: hasMore ? page + 1 : null,
    });
  }));

  server.registerTool("create_automation", {
    title: "Create automation",
    description: "Creates a draft automation. Any field you leave out gets the app's default (friendly replies and DMs, a placeholder link). It doesn't run until you call go_live.",
    inputSchema: fieldsObject,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, (fields) => run(true, async () => {
    const connected = await account();
    const { id } = await service.createAutomation(userId);
    const created = await getAutomation(connected.id, id);
    if (!created) throw new service.ServiceError("The automation couldn't be created. Try again.");
    try {
      const content = await applyFields(userId, connected, created, fields);
      const saved = await service.saveAutomation(userId, id, content);
      if (!saved.ok) return rejected(saved);
    } catch (error) {
      await service.deleteAutomation(userId, id);
      throw error;
    }
    const automation = await getAutomation(connected.id, id);
    return json(automation ? detail(automation) : { id });
  }));

  server.registerTool("update_automation", {
    title: "Update automation",
    description: "Changes the fields you pass and keeps the rest. On a live automation the change applies at once, so it must still pass the go live checks.",
    inputSchema: fieldsObject.extend({ id: z.string().describe("Automation id.") }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, ({ id, ...fields }) => run(true, async () => {
    const { account: connected, automation } = await service.loadOwn(userId, id);
    const content = await applyFields(userId, connected, automation, fields);
    const saved = await service.saveAutomation(userId, id, content);
    if (!saved.ok) return rejected(saved);
    const updated = await getAutomation(connected.id, id);
    return json(updated ? detail(updated) : { id });
  }));

  server.registerTool("go_live", {
    title: "Go live",
    description: "Starts an automation: from now on it replies to matching comments and sends DMs from the user's Instagram account. Checks every field first.",
    inputSchema: z.object({ id: z.string().describe("Automation id.") }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, ({ id }) => run(true, async () => {
    const result = await service.goLive(userId, id);
    if (!result.ok) return rejected(result);
    const automation = await getAutomation((await account()).id, id);
    return json(automation ? summary(automation) : { id, status: "live" });
  }));

  server.registerTool("pause_automation", {
    title: "Pause automation",
    description: "Stops an automation. People already mid-flow can still tap their button and get the final DM.",
    inputSchema: z.object({ id: z.string().describe("Automation id.") }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, ({ id }) => run(true, async () => {
    await service.pauseAutomation(userId, id);
    return json({ id, status: "paused" });
  }));

  server.registerTool("duplicate_automation", {
    title: "Duplicate automation",
    description: "Copies an automation into a new draft.",
    inputSchema: z.object({ id: z.string().describe("Automation id to copy.") }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, ({ id }) => run(true, async () => {
    const copy = await service.duplicateAutomation(userId, id);
    const automation = await getAutomation((await account()).id, copy.id);
    return json(automation ? summary(automation) : copy);
  }));

  server.registerTool("delete_automation", {
    title: "Delete automation",
    description: "Deletes an automation and its history for good. This can't be undone.",
    inputSchema: z.object({ id: z.string().describe("Automation id.") }),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  }, ({ id }) => run(true, async () => {
    await service.deleteAutomation(userId, id);
    return json({ id, deleted: true });
  }));

  server.registerTool("reset_runs", {
    title: "Reset runs",
    description: "Forgets everyone this automation has messaged, so the same people can trigger it again, and clears its stats. Handy when testing with your own account.",
    inputSchema: z.object({ id: z.string().describe("Automation id.") }),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  }, ({ id }) => run(true, async () => json({ id, ...(await service.resetRuns(userId, id)) })));

  return server;
}
