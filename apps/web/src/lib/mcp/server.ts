import "server-only";

import { McpServer, inputRequired, inputResponse, type CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";

import { serverKeyRejected } from "@/lib/adeli/client";
import { findMedia, listMedia, listStories, missingGrantsFor, missingGrantsMessage } from "@/lib/adeli/instagram";
import { findAdeliConfig } from "@/lib/adeli/key";
import { AdeliError } from "@/lib/adeli/types";
import { trackWentLive } from "@/lib/analytics/automations";
import { getPlan, liveAutomationLimit } from "@/lib/billing/state";
import { showsBranding } from "@/lib/plan";
import { track } from "@/lib/analytics/server";
import { appUrl } from "@/lib/app-url";
import { CONNECT_LINK_MINUTES, createConnectLink, isConnectLinkUrl } from "@/lib/connect-links";
import { listAudience, listAutomationPeople } from "@/lib/audience";
import { snapshotOf } from "@/lib/automations/snapshot";
import { LIMITS, automationTypeSchema, emailCaptureOf, followGateOf, storyExpired, type Automation, type AutomationContent } from "@adeli-chat/ui/automation/schemas";
import { FREE_LIVE_AUTOMATIONS } from "@adeli-chat/ui/billing/plans";
import * as service from "@/lib/automations/service";
import { triggerSummary } from "@/lib/automations/validate";
import { EARLIER_SEND_LIMIT, EARLIER_WINDOW_HOURS } from "@/lib/runtime/earlier";
import { getAutomation, getConnectedAccount, listAutomations, type ConnectedAccount } from "@/lib/data";

import { MCP_DISPLAY_NAME, MCP_SERVER_NAME } from "./config";

/**
 * The LedaChat MCP server: list, create and manage Comment to DM
 * automations. One instance per request, for one user (`principal`), who was
 * already authenticated by `/mcp`. Every tool goes through the same service as
 * the app (`src/lib/automations/service.ts`) and only reaches automations on
 * that user's own Instagram account.
 */

export type McpPrincipal = { userId: string; canWrite: boolean };

const INSTRUCTIONS = `LedaChat runs Instagram Comment to DM and Story Reply automations for the signed-in user's connected Instagram account.

How an automation works:
1. Something starts it (trigger). The type, chosen at create_automation and fixed after, says what:
   - "comment_to_dm" (default): someone comments. postScope says where: "specific" (one post, set postId), "next" (the first post published after it goes live) or "any" (every post; a post with its own automation uses that one first).
   - "story_reply": someone replies to one of the account's stories. postScope is "specific" (one story, set storyId from list_stories; the default) or "any" (every story; a story with its own automation uses that one first). Stories expire after 24 hours, and so does a specific-story automation. There's no postId or public reply.
   It matches either specific keywords (case-insensitive) or any comment or reply.
2. Comment to DM only, optionally: a public reply is posted under their comment (one variant is picked at random).
3. They get an Opening DM: a message with one button. Instagram only allows this one message until they tap.
4. Comment to DM only, optionally: after the tap we check that they follow the account (followGateEnabled). If they don't, they get followGateText with a followGateButtonLabel button that checks again; each later tap that still finds no follow gets followGateRetryText. Nothing else is sent until they follow.
5. Optionally, after that we ask for their email (emailCaptureEnabled). The Final DM waits until they reply with a valid email, which is saved as a lead the user can export in the app.
6. They get the Final DM: a message with one to three link buttons (https only): linkButtonLabel and linkUrl, plus extraLinks.
Each person gets the flow once per automation.

Limits: name ${LIMITS.name} chars, keywords up to ${LIMITS.keyword} chars each, replies ${LIMITS.replyVariant} chars each, DM text ${LIMITS.dmText} chars, button labels ${LIMITS.buttonLabel} chars.

Statuses: draft (not running), live (running), paused. New automations are always drafts. Use go_live to start one; it checks every field and that no other live automation of the same type and scope (and, for "specific", the same post) shares a keyword (or matches anything).
On the hosted LedaChat, the Free plan allows ${FREE_LIVE_AUTOMATIONS} live automations at once and sends "Powered by LedaChat" after the Final DM; Pro removes both. get_workspace reports the plan. go_live at the limit fails: tell the user rather than retrying.
If the user went live after people already commented, message_earlier_comments sends the flow to matching comments from the last 24 hours on a live Comment to DM automation for one post. Call it with send false first and tell the user how many people it will message; only send once they agree. Sending is Pro only on the hosted LedaChat: when the count comes back with proRequired, tell the user they can upgrade at upgradeUrl instead of sending.
list_audience shows who engages: everyone who triggered the account's automations, most engaged first, or one automation's people with how far each got.
Use list_posts to find a post id before setting postId. Saving a live automation applies at once and must still pass the go live checks.
Setup: if a result has setup.next = "connect_instagram", call connect_instagram and give the user its link before anything else. After they say they're done, call get_workspace to confirm, and confirm the Instagram handle with the user. The account is managed in ${"{appUrl}"}/settings.`;

function json(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function fail(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/**
 * What a tool answers on a workspace with no Instagram account yet: a normal
 * result (never an auth error, which would make the client restart OAuth)
 * telling the agent to call `connect_instagram`. `isError` on writes and
 * Instagram reads, so the model doesn't think something was saved or found.
 */
function setupRequired(isError: boolean): CallToolResult {
  return { ...json({ status: "setup_required", setup: service.CONNECT_INSTAGRAM_SETUP }), ...(isError ? { isError: true } : {}) };
}

/** Writes change automations (refused on read-only connections). Instagram reads need the account. Plain reads don't. */
type ToolKind = "read" | "instagram" | "write";

function automationUrl(id: string) {
  return `${appUrl()}/automations/${id}`;
}

function summary(automation: Automation) {
  return {
    id: automation.id,
    type: automation.type,
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
    type: automation.type,
    name: automation.name,
    status: automation.status,
    url: automationUrl(automation.id),
    postScope: automation.trigger.postScope,
    postId: automation.trigger.mediaId,
    post: automation.trigger.mediaSnapshot,
    ...(automation.type === "story_reply" ? { storyExpired: storyExpired(automation) } : {}),
    match: automation.trigger.match,
    keywords: automation.trigger.keywords,
    commentReplyEnabled: automation.commentReply.enabled,
    commentReplies: automation.commentReply.variants,
    openingDmText: automation.openingDm.text,
    openingDmButtonLabel: automation.openingDm.buttonLabel,
    followGateEnabled: followGateOf(automation).enabled,
    followGateText: followGateOf(automation).text,
    followGateButtonLabel: followGateOf(automation).buttonLabel,
    followGateRetryText: followGateOf(automation).retryText,
    emailCaptureEnabled: emailCaptureOf(automation).enabled,
    emailCaptureText: emailCaptureOf(automation).text,
    emailCaptureRetryText: emailCaptureOf(automation).retryText,
    finalDmText: automation.finalDm.text,
    linkButtonLabel: button?.label ?? "",
    linkUrl: button?.url ?? "",
    extraLinks: automation.finalDm.buttons.slice(1),
    stats: automation.stats,
    createdAt: automation.createdAt,
    updatedAt: automation.updatedAt,
    liveAt: automation.liveAt,
  };
}

/** Editable fields, flattened so they're easy to fill in. Every one is optional. */
const fieldsSchema = {
  name: z.string().max(LIMITS.name).optional().describe("Name shown in LedaChat."),
  postScope: z.enum(["specific", "next", "any"]).optional().describe("Which posts or stories trigger it. Comment to DM: one specific post (set postId), the next post published after going live, or any post. Story Reply: one specific story (set storyId) or any story."),
  postId: z.string().optional().describe("Instagram media id of the post or reel, from list_posts. Only for postScope specific; setting it also sets postScope to specific. Comment to DM only."),
  storyId: z.string().optional().describe("Instagram media id of a live story, from list_stories. Story Reply only; setting it also sets postScope to specific."),
  match: z.enum(["keywords", "any"]).optional().describe("Reply to comments with specific keywords, or to any comment."),
  keywords: z.array(z.string().max(LIMITS.keyword)).max(LIMITS.keywords).optional().describe("Keywords that trigger the automation (case-insensitive). Replaces the whole list."),
  commentReplyEnabled: z.boolean().optional().describe("Post a public reply under the comment."),
  commentReplies: z.array(z.string().max(LIMITS.replyVariant)).max(LIMITS.replyVariants).optional().describe("Public reply variants; one is picked at random. Replaces the whole list."),
  openingDmText: z.string().max(LIMITS.dmText).optional().describe("First DM. Sent right after the comment."),
  openingDmButtonLabel: z.string().max(LIMITS.buttonLabel).optional().describe("Button on the first DM. Tapping it sends the final DM."),
  followGateEnabled: z.boolean().optional().describe("Only send the rest of the flow to people who follow the account, checked after the tap. Comment to DM only."),
  followGateText: z.string().max(LIMITS.dmText).optional().describe("Sent after the tap to someone who doesn't follow yet."),
  followGateButtonLabel: z.string().max(LIMITS.buttonLabel).optional().describe("Button on the follow message. Tapping it checks again."),
  followGateRetryText: z.string().max(LIMITS.dmText).optional().describe("Sent each time they tap that button without following."),
  emailCaptureEnabled: z.boolean().optional().describe("Ask for their email after the tap, before the final DM. Emails are saved as leads."),
  emailCaptureText: z.string().max(LIMITS.dmText).optional().describe("The message that asks for their email."),
  emailCaptureRetryText: z.string().max(LIMITS.dmText).optional().describe("Sent once if their reply doesn't contain an email."),
  finalDmText: z.string().max(LIMITS.dmText).optional().describe("Final DM, sent after they tap the button (or send their email, when that step is on)."),
  linkButtonLabel: z.string().max(LIMITS.buttonLabel).optional().describe("Label of the link button on the final DM."),
  linkUrl: z.string().max(LIMITS.url).optional().describe("Where the link button goes. Must start with https://"),
  extraLinks: z.array(z.object({ label: z.string().max(LIMITS.buttonLabel), url: z.string().max(LIMITS.url) })).max(LIMITS.finalDmButtons - 1).optional()
    .describe(`Up to ${LIMITS.finalDmButtons - 1} more link buttons on the final DM, after the first. Each url must start with https://. Replaces the whole list; [] removes them.`),
};
const fieldsObject = z.object(fieldsSchema);
type Fields = z.infer<typeof fieldsObject>;

/** Applies `fields` onto `content`. A new `postId` is looked up on Instagram for its caption and thumbnail. */
async function applyFields(userId: string, account: ConnectedAccount, content: AutomationContent, fields: Fields): Promise<AutomationContent> {
  const next: AutomationContent = structuredClone(content);
  if (fields.name !== undefined) next.name = fields.name;
  const story = content.type === "story_reply";
  if (story && (fields.postId !== undefined || fields.postScope === "next" || fields.commentReplyEnabled || fields.commentReplies !== undefined)) {
    throw new service.ServiceError("A Story Reply automation picks a story with storyId (or postScope any) and has no public reply, so postId, postScope next and comment replies don't apply.");
  }
  if (!story && fields.storyId !== undefined) throw new service.ServiceError("storyId is only for Story Reply automations. Use postId for a post.");
  if (fields.storyId !== undefined && fields.storyId !== content.trigger.mediaId) {
    const found = (await listStories(userId, account.accountId)).find((item) => item.id === fields.storyId);
    if (!found) throw new service.ServiceError(`There's no live story with id ${fields.storyId} on @${account.displayIdentifier}. Use list_stories to find one.`);
    next.trigger.postScope = "specific";
    next.trigger.mediaId = found.id;
    next.trigger.mediaSnapshot = snapshotOf(found);
  }
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
  if (fields.followGateEnabled !== undefined || fields.followGateText !== undefined || fields.followGateButtonLabel !== undefined || fields.followGateRetryText !== undefined) {
    const follow = followGateOf(next);
    next.followGate = {
      enabled: fields.followGateEnabled ?? follow.enabled,
      text: fields.followGateText ?? follow.text,
      buttonLabel: fields.followGateButtonLabel ?? follow.buttonLabel,
      retryText: fields.followGateRetryText ?? follow.retryText,
    };
  }
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
  if (fields.extraLinks !== undefined) {
    const [first] = next.finalDm.buttons;
    next.finalDm.buttons = [first ?? { label: "", url: "" }, ...fields.extraLinks.map((link) => ({ label: link.label, url: link.url.trim() }))];
  }
  return next;
}

function rejected(result: Exclude<service.ActionResult, { ok: true }>): CallToolResult {
  if (result.reason === "invalid") {
    const lines = Object.entries(result.errors).map(([field, message]) => `- ${field}: ${message}`);
    return fail(`This automation can't be live yet. Fix ${result.count === 1 ? "this field" : "these fields"} and try again:\n${lines.join("\n")}`);
  }
  if (result.reason === "conflict") return fail(`${result.message} Pause that one (id ${result.conflictId}) or use different keywords.`);
  if (result.reason === "limit") return fail(`${result.message} Don't retry: tell the user, who can pause one with pause_automation or upgrade at ${result.upgradeUrl}.`);
  if (result.reason === "pro") return fail(`${result.message} Don't retry: tell the user, who can upgrade at ${result.upgradeUrl}.`);
  return fail(result.message);
}

export function createAdeliChatMcpServer(principal: McpPrincipal): McpServer {
  const { userId } = principal;
  const server = new McpServer(
    { name: MCP_SERVER_NAME, title: MCP_DISPLAY_NAME, version: "1.0.0" },
    { instructions: INSTRUCTIONS.replaceAll("{appUrl}", appUrl()) },
  );

  /** Runs a tool, turning problems the user can fix into tool errors Claude can read. */
  async function run(tool: string, kind: ToolKind, body: () => Promise<CallToolResult>): Promise<CallToolResult> {
    const write = kind === "write";
    const result = await runTool(kind, body);
    track(userId, "mcp_tool_called", { tool, write, ok: !result.isError });
    return result;
  }

  async function runTool(kind: ToolKind, body: () => Promise<CallToolResult>): Promise<CallToolResult> {
    if (kind === "write" && !principal.canWrite) return fail("This connection is read only. Create a token with write access on the Connect to AI Agent page in LedaChat, or reconnect and allow changes.");
    try {
      return await body();
    } catch (error) {
      if (error instanceof service.SetupRequired) return setupRequired(kind !== "read");
      if (error instanceof service.ServiceError || error instanceof AdeliError) return fail(error.message);
      throw error;
    }
  }

  async function account() {
    return service.requireAccount(userId);
  }

  server.registerTool("get_workspace", {
    title: "Get workspace",
    description: "Call this first. The connected Instagram account (null until one is connected, with setup saying to call connect_instagram), whether the server has a working Adeli key, how many automations there are by status, and the plan (free, pro, or unlimited when self-hosted) with its live automation limit.",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, () => run("get_workspace", "read", async () => {
    const connected = await getConnectedAccount(userId);
    const automations = connected ? await listAutomations(connected.id) : [];
    const counts = { draft: 0, live: 0, paused: 0 };
    for (const automation of automations) counts[automation.status] += 1;
    const plan = await getPlan(userId);
    const missing = connected ? await missingGrantsFor(userId, connected.accountId) : [];
    return json({
      instagram: connected ? {
        handle: `@${connected.displayIdentifier}`,
        // Adeli's display name for Instagram is the @handle itself; only repeat it when it's a real name.
        ...(connected.displayName && connected.displayName !== `@${connected.displayIdentifier}` ? { name: connected.displayName } : {}),
        // Someone can untick comments or DMs on Facebook Login; automations can't run without them.
        ...(missing.length ? { missingPermissions: missing, fix: `${missingGrantsMessage(missing)} Call connect_instagram for a link.` } : {}),
      } : null,
      adeliKey: !findAdeliConfig() ? "missing" : serverKeyRejected() ? "rejected" : "configured",
      automations: counts,
      plan,
      liveAutomationLimit: liveAutomationLimit(plan),
      finalDmBranded: await showsBranding(userId),
      upgradeUrl: plan === "free" ? service.upgradeUrl() : null,
      settingsUrl: `${appUrl()}/settings`,
      setup: connected ? null : service.CONNECT_INSTAGRAM_SETUP,
    });
  }));

  server.registerTool("list_automations", {
    title: "List automations",
    description: "Every automation (Comment to DM and Story Reply) on the connected Instagram account, most recently updated first, with its trigger, post and stats. When there are none, next says what the user can do.",
    inputSchema: z.object({ status: z.enum(["draft", "live", "paused"]).optional().describe("Only automations with this status.") }),
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, ({ status }) => run("list_automations", "read", async () => {
    const connected = await getConnectedAccount(userId);
    if (!connected) return json({ automations: [], setup: service.CONNECT_INSTAGRAM_SETUP });
    const automations = await listAutomations(connected.id);
    const shown = automations.filter((automation) => !status || automation.status === status).map(summary);
    // Same shape as before Instagram is connected, so an agent reads one format. An empty account says what's next instead of a bare [].
    return json({
      automations: shown,
      automationsUrl: `${appUrl()}/automations`,
      ...(automations.length ? {} : { next: NO_AUTOMATIONS_YET }),
    });
  }));

  server.registerTool("get_automation", {
    title: "Get automation",
    description: "Everything about one automation: trigger, replies, both DMs, status and stats.",
    inputSchema: z.object({ id: z.string().describe("Automation id.") }),
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, ({ id }) => run("get_automation", "read", async () => {
    const automation = await getAutomation((await account()).id, id);
    return automation ? json(detail(automation)) : fail("There's no automation with that id.");
  }));

  server.registerTool("list_audience", {
    title: "List audience",
    description: "Who engages with the account's automations. Without automationId: everyone who triggered any of them, most engaged first (how many automations they triggered, button taps, Final DMs, email if they gave one, first and last seen). With automationId: that automation's people, newest first, with how far each got (stage), their comment and email. Reset runs removes people from it.",
    inputSchema: z.object({
      automationId: z.string().optional().describe("Only this automation's people."),
      limit: z.number().int().min(1).max(500).optional().describe("How many people to return. Default 50."),
    }),
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, ({ automationId, limit = 50 }) => run("list_audience", "read", async () => {
    const own = await getConnectedAccount(userId);
    if (!own) return json({ total: 0, people: [], setup: service.CONNECT_INSTAGRAM_SETUP });
    if (automationId) {
      const automation = await getAutomation(own.id, automationId);
      if (!automation) return fail("There's no automation with that id.");
      const people = await listAutomationPeople(own.id, automation.id);
      return json({ automation: { id: automation.id, name: automation.name }, total: people.length, people: people.slice(0, limit), audienceUrl: `${appUrl()}/audience?automation=${automation.id}` });
    }
    const contacts = await listAudience(own.id);
    return json({ total: contacts.length, people: contacts.slice(0, limit), audienceUrl: `${appUrl()}/audience` });
  }));

  server.registerTool("list_stories", {
    title: "List Instagram stories",
    description: "Live stories on the connected Instagram account, newest first. Stories expire 24 hours after they're posted. Use an id from here as storyId on a Story Reply automation.",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, openWorldHint: true },
  }, () => run("list_stories", "instagram", async () => {
    const stories = await listStories(userId, (await account()).accountId);
    return json({ stories: stories.map((item) => ({ id: item.id, type: item.mediaType, permalink: item.permalink, publishedAt: item.publishedAt })) });
  }));

  server.registerTool("list_posts", {
    title: "List Instagram posts",
    description: "Recent posts and reels on the connected Instagram account, newest first, 9 per page. Use an id from here as postId.",
    inputSchema: z.object({ page: z.number().int().min(0).default(0).describe("Page number, starting at 0.") }),
    annotations: { readOnlyHint: true, openWorldHint: true },
  }, ({ page }) => run("list_posts", "instagram", async () => {
    const { media, hasMore } = await listMedia(userId, (await account()).accountId, page);
    return json({
      posts: media.map((post) => ({ id: post.id, type: post.mediaType, caption: post.caption.slice(0, 200), permalink: post.permalink, publishedAt: post.publishedAt, comments: post.comments })),
      nextPage: hasMore ? page + 1 : null,
    });
  }));

  server.registerTool("create_automation", {
    title: "Create automation",
    description: "Creates a draft automation. Any field you leave out gets the app's default (friendly replies and DMs, a placeholder link). It doesn't run until you call go_live.",
    inputSchema: fieldsObject.extend({ type: automationTypeSchema.optional().describe("comment_to_dm (default): someone comments on a post. story_reply: someone replies to one of your stories. Can't be changed later.") }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, ({ type, ...fields }) => run("create_automation", "write", async () => {
    const connected = await account();
    const { id } = await service.createAutomation(userId, {}, type);
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
    track(userId, "automation_created", { automation_id: id, automation_type: type ?? "comment_to_dm", source: "mcp" });
    const automation = await getAutomation(connected.id, id);
    return json(automation ? detail(automation) : { id });
  }));

  server.registerTool("update_automation", {
    title: "Update automation",
    description: "Changes the fields you pass and keeps the rest. On a live automation the change applies at once, so it must still pass the go live checks.",
    inputSchema: fieldsObject.extend({ id: z.string().describe("Automation id.") }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, ({ id, ...fields }) => run("update_automation", "write", async () => {
    const { account: connected, automation } = await service.loadOwn(userId, id);
    const content = await applyFields(userId, connected, automation, fields);
    const saved = await service.saveAutomation(userId, id, content);
    if (!saved.ok) return rejected(saved);
    track(userId, "automation_saved", { automation_id: id, source: "mcp" });
    const updated = await getAutomation(connected.id, id);
    return json(updated ? detail(updated) : { id });
  }));

  server.registerTool("go_live", {
    title: "Go live",
    description: "Starts an automation: from now on it replies to matching comments and sends DMs from the user's Instagram account. Checks every field first.",
    inputSchema: z.object({ id: z.string().describe("Automation id.") }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, ({ id }) => run("go_live", "write", async () => {
    const result = await service.goLive(userId, id, undefined, "mcp");
    if (!result.ok) {
      track(userId, "automation_go_live_rejected", { automation_id: id, source: "mcp", reason: result.reason });
      return rejected(result);
    }
    await trackWentLive(userId, id, "mcp");
    const automation = await getAutomation((await account()).id, id);
    return json(automation ? summary(automation) : { id, status: "live" });
  }));

  server.registerTool("pause_automation", {
    title: "Pause automation",
    description: "Stops an automation. People already mid-flow can still tap their button and get the final DM.",
    inputSchema: z.object({ id: z.string().describe("Automation id.") }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, ({ id }) => run("pause_automation", "write", async () => {
    await service.pauseAutomation(userId, id);
    track(userId, "automation_paused", { automation_id: id, source: "mcp" });
    return json({ id, status: "paused" });
  }));

  server.registerTool("duplicate_automation", {
    title: "Duplicate automation",
    description: "Copies an automation into a new draft.",
    inputSchema: z.object({ id: z.string().describe("Automation id to copy.") }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, ({ id }) => run("duplicate_automation", "write", async () => {
    const copy = await service.duplicateAutomation(userId, id);
    track(userId, "automation_duplicated", { automation_id: copy.id, original_automation_id: id, source: "mcp" });
    const automation = await getAutomation((await account()).id, copy.id);
    return json(automation ? summary(automation) : copy);
  }));

  server.registerTool("delete_automation", {
    title: "Delete automation",
    description: "Deletes an automation and its history for good. This can't be undone.",
    inputSchema: z.object({ id: z.string().describe("Automation id.") }),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  }, ({ id }) => run("delete_automation", "write", async () => {
    await service.deleteAutomation(userId, id);
    track(userId, "automation_deleted", { automation_id: id, source: "mcp" });
    return json({ id, deleted: true });
  }));

  server.registerTool("message_earlier_comments", {
    title: "Message earlier comments",
    description: `For a live Comment to DM automation on one post: finds comments from the last ${EARLIER_WINDOW_HOURS} hours that it would have answered had it been live, from people it hasn't messaged yet. With send false it only counts them. With send true it starts the flow for up to ${EARLIER_SEND_LIMIT} of them (public reply, if on, then the Opening DM), in the background; call it again for the rest. Pro only on the hosted LedaChat.`,
    inputSchema: z.object({
      id: z.string().describe("Automation id."),
      send: z.boolean().describe("False to only count who would be messaged. True to message them; confirm with the user first."),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, ({ id, send }) => run("message_earlier_comments", send ? "write" : "instagram", async () => {
    const result = send ? await service.messageEarlierComments(userId, id) : await service.previewEarlierComments(userId, id);
    if (!result.ok) {
      if (send) track(userId, "earlier_comments_rejected", { automation_id: id, source: "mcp", reason: result.reason });
      return rejected(result);
    }
    if (send) track(userId, "earlier_comments_sent", { automation_id: id, people: result.count, matched: result.total, complete: result.complete, source: "mcp" });
    return json({ id, sent: send, people: result.count, matched: result.total, complete: result.complete, windowHours: result.windowHours, ...(result.allowed ? {} : { proRequired: true, upgradeUrl: result.upgradeUrl }) });
  }));

  server.registerTool("reset_runs", {
    title: "Reset runs",
    description: "Forgets everyone this automation has messaged, so the same people can trigger it again, and clears its stats. Handy when testing with your own account.",
    inputSchema: z.object({ id: z.string().describe("Automation id.") }),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  }, ({ id }) => run("reset_runs", "write", async () => {
    const reset = await service.resetRuns(userId, id);
    track(userId, "automation_runs_reset", { automation_id: id, runs_cleared: reset.count, source: "mcp" });
    return json({ id, ...reset });
  }));

  // Allowed on read-only connections too: it changes no automations, it only
  // hands the user a link to connect Instagram in the app.
  server.registerTool("connect_instagram", {
    title: "Connect Instagram",
    description: `Prompts the user to Continue with Instagram: a one-time link (valid ${CONNECT_LINK_MINUTES} minutes, single use) that opens LedaChat signed in and starts connecting their Instagram professional account. Call it when a result has setup.next connect_instagram, and give the user the link before anything else. When they say they're done, call get_workspace to confirm the handle.`,
    inputSchema: z.object({
      method: z.enum(["instagram", "facebook"]).optional().describe("Leave it out (usual) to open the connect page, where the user picks Continue with Instagram or Continue with Facebook. instagram or facebook starts that login right away, for when the user already said which."),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ method }, ctx) => {
    const connected = await getConnectedAccount(userId);
    if (connected) {
      track(userId, "mcp_tool_called", { tool: "connect_instagram", write: false, ok: true });
      return json({ url: null, instagram: `@${connected.displayIdentifier}`, message: `@${connected.displayIdentifier} is already connected. The user can switch accounts in ${appUrl()}/settings.` });
    }
    // The retry after a URL elicitation: the link we made is echoed back in requestState. Whatever the user chose, return it.
    const echoed = ctx.mcpReq.inputResponses ? ctx.mcpReq.requestState() : undefined;
    if (isConnectLinkUrl(echoed)) {
      const answer = inputResponse(ctx.mcpReq.inputResponses, "connect");
      track(userId, "mcp_tool_called", { tool: "connect_instagram", write: false, ok: true });
      return connectLinkResult(echoed, answer.kind === "elicit" ? answer.action : null);
    }
    const link = await createConnectLink(userId, method ?? null);
    const elicit = supportsUrlElicitation(ctx.mcpReq.envelope);
    track(userId, "mcp_connect_prompted", { method: method ?? "choose", elicitation: elicit });
    if (elicit) {
      return inputRequired({
        inputRequests: { connect: inputRequired.elicitUrl({ message: CONNECT_PROMPT, url: link.url }) },
        requestState: link.url,
      });
    }
    track(userId, "mcp_tool_called", { tool: "connect_instagram", write: false, ok: true });
    return connectLinkResult(link.url, null);
  });

  return server;
}

const NO_AUTOMATIONS_YET = "No automations yet. To start one, pick a post with list_posts (or a story with list_stories), then create_automation makes a draft; nothing runs until go_live. The user can also build one in the app.";

const CONNECT_PROMPT = "Continue with Instagram to finish setting up LedaChat.";

/**
 * Whether the client said it can open a URL for the user (MCP URL-mode
 * elicitation). Read from the per-request envelope (protocol 2026-07-28): our
 * handler is stateless, so a 2025-era client's `initialize` capabilities
 * aren't available, and it gets the link in the result instead.
 */
function supportsUrlElicitation(envelope: unknown): boolean {
  const capabilities = (envelope as Record<string, unknown> | undefined)?.["io.modelcontextprotocol/clientCapabilities"] as { elicitation?: { url?: unknown } } | undefined;
  return Boolean(capabilities?.elicitation?.url);
}

function connectLinkResult(url: string, elicitation: "accept" | "decline" | "cancel" | null): CallToolResult {
  const shown = elicitation === "accept";
  const message = shown
    ? `The user was asked to Continue with Instagram, and the link opened for them. If it didn't, show them this link: ${url} . When they say they're done, call get_workspace to confirm the handle.`
    : `Show the user this link and ask them to open it to Continue with Instagram: ${url} . It works once, for ${CONNECT_LINK_MINUTES} minutes. When they say they're done, call get_workspace to confirm the handle.`;
  return {
    content: [
      { type: "text", text: JSON.stringify({ url, expiresInMinutes: CONNECT_LINK_MINUTES, instagram: null, ...(elicitation ? { elicitation } : {}) }, null, 2) },
      { type: "text", text: message },
    ],
  };
}
