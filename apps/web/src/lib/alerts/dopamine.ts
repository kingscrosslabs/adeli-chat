import "server-only";

import { and, count, eq, isNotNull, ne } from "drizzle-orm";

import type { Source } from "@/lib/analytics/server";
import { db, schema } from "@/lib/db";
import { escapeSlack, notifySlack, slackWebhookUrl } from "@/lib/slack";
import type { Automation } from "@adeli-chat/ui/automation/schemas";

import { describeUser } from "./people";

/**
 * Good news for #dopamine-hits (`SLACK_SIGNUP_WEBHOOK_URL`, the same webhook
 * as Adeli's sign-up alerts): a new sign-up, and an automation going live.
 * Best-effort: these return once the message is built and queued, never
 * waiting on Slack, and a failure is logged, never retried.
 */

export async function alertSignup(user: { id: string; name: string; email: string }): Promise<void> {
  void notifySlack("signups", `:tada: *New LedaChat signup: ${escapeSlack(user.name || user.email)}* (${escapeSlack(user.email)})`);
}

const TYPE_NAMES: Record<Automation["type"], string> = { comment_to_dm: "Comment to DM", story_reply: "Story Reply" };

function triggerPhrase(automation: Automation): string {
  const { postScope, match, keywords } = automation.trigger;
  const story = automation.type === "story_reply";
  const where = story
    ? postScope === "specific" ? "one story" : "every story"
    : postScope === "next" ? "their next post" : postScope === "any" ? "every post" : "one post";
  const what = match === "any" ? (story ? "any reply" : "any comment") : `${keywords.map((keyword) => keyword.toUpperCase()).join(", ")}`;
  return `${what} on ${where}`;
}

/**
 * An automation just went live (from draft or paused). Never its DM text,
 * which can carry a creator's private links or offers. The first one a user
 * has ever put live gets a line of its own.
 */
export async function alertWentLive(userId: string, automation: Automation, source: Source): Promise<void> {
  if (!slackWebhookUrl("signups")) return;
  try {
    const [{ others }] = await db().select({ others: count() }).from(schema.automations)
      .innerJoin(schema.accounts, eq(schema.automations.accountId, schema.accounts.id))
      .where(and(eq(schema.accounts.userId, userId), isNotNull(schema.automations.liveAt), ne(schema.automations.id, automation.id)));
    const lines = [
      `:rocket: *${await describeUser(userId)} put an automation live*${source === "mcp" ? " via MCP" : ""}`,
      `${escapeSlack(automation.name)}: ${TYPE_NAMES[automation.type]}, ${escapeSlack(triggerPhrase(automation))}`,
      others === 0 ? ":sparkles: First automation!" : null,
    ];
    void notifySlack("signups", lines.filter(Boolean).join("\n"));
  } catch (error) {
    console.warn(`Couldn't build the go-live alert: ${error instanceof Error ? error.message : String(error)}`);
  }
}
