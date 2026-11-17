import "server-only";

import { emailCaptureOf, followGateOf } from "@adeli-chat/ui/automation/schemas";
import { loadOwn } from "@/lib/automations/service";

import { track, type Source } from "./server";

/**
 * `automation_went_live`, with the shape of what went live (never its text),
 * for both the app and MCP. Analytics never fails the action: a lookup
 * problem only drops the extra properties.
 */
export async function trackWentLive(userId: string, id: string, source: Source) {
  const automation = await loadOwn(userId, id).then((own) => own.automation).catch(() => null);
  track(userId, "automation_went_live", {
    automation_id: id,
    source,
    ...(automation && {
      automation_type: automation.type,
      post_scope: automation.trigger.postScope,
      trigger_match: automation.trigger.match,
      keyword_count: automation.trigger.keywords.length,
      comment_reply_enabled: automation.commentReply.enabled,
      email_capture_enabled: emailCaptureOf(automation).enabled,
      follow_gate_enabled: followGateOf(automation).enabled,
      final_dm_buttons: automation.finalDm.buttons.length,
    }),
  });
}
