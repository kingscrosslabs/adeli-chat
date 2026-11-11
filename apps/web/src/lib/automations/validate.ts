import { LIMITS, emailCaptureOf, followGateOf, storyExpired, type Automation, type AutomationContent } from "@adeli-chat/ui/automation/schemas";

/**
 * Field paths double as DOM anchors: the editor gives each field
 * `data-field="<path>"` so the first error can be scrolled into view.
 */
export type FieldPath =
  | "name"
  | "trigger.mediaId"
  | "trigger.keywords"
  | "commentReply.variants"
  | "openingDm.text"
  | "openingDm.buttonLabel"
  | "followGate.text"
  | "followGate.buttonLabel"
  | "followGate.retryText"
  | "emailCapture.text"
  | "emailCapture.retryText"
  | "finalDm.text"
  | "finalDm.buttons.0.label"
  | "finalDm.buttons.0.url";

export type FieldErrors = Partial<Record<FieldPath, string>>;

/** Order of sections top to bottom, so "first error" means first on screen. */
export const FIELD_ORDER: FieldPath[] = [
  "name",
  "trigger.mediaId",
  "trigger.keywords",
  "commentReply.variants",
  "openingDm.text",
  "openingDm.buttonLabel",
  "followGate.text",
  "followGate.buttonLabel",
  "followGate.retryText",
  "emailCapture.text",
  "emailCapture.retryText",
  "finalDm.text",
  "finalDm.buttons.0.label",
  "finalDm.buttons.0.url",
];

export function isValidHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && url.hostname.includes(".");
  } catch {
    return false;
  }
}

/**
 * Hard limits that apply even to Drafts (you can't save 900 characters into a
 * 640 character field). Missing content is fine in a Draft.
 */
export function validateLimits(content: AutomationContent): FieldErrors {
  const errors: FieldErrors = {};
  if (content.name.length > LIMITS.name) errors.name = `Keep the name under ${LIMITS.name} characters.`;
  if (content.trigger.keywords.some((keyword) => keyword.length > LIMITS.keyword)) errors["trigger.keywords"] = `Each keyword can be up to ${LIMITS.keyword} characters.`;
  if (content.commentReply.variants.some((variant) => variant.length > LIMITS.replyVariant)) errors["commentReply.variants"] = `Each reply can be up to ${LIMITS.replyVariant} characters.`;
  if (content.openingDm.text.length > LIMITS.dmText) errors["openingDm.text"] = `Instagram allows up to ${LIMITS.dmText} characters.`;
  if (content.openingDm.buttonLabel.length > LIMITS.buttonLabel) errors["openingDm.buttonLabel"] = `Button labels can be up to ${LIMITS.buttonLabel} characters.`;
  const follow = followGateOf(content);
  if (follow.text.length > LIMITS.dmText) errors["followGate.text"] = `Instagram allows up to ${LIMITS.dmText} characters.`;
  if (follow.buttonLabel.length > LIMITS.buttonLabel) errors["followGate.buttonLabel"] = `Button labels can be up to ${LIMITS.buttonLabel} characters.`;
  if (follow.retryText.length > LIMITS.dmText) errors["followGate.retryText"] = `Instagram allows up to ${LIMITS.dmText} characters.`;
  const email = emailCaptureOf(content);
  if (email.text.length > LIMITS.dmText) errors["emailCapture.text"] = `Instagram allows up to ${LIMITS.dmText} characters.`;
  if (email.retryText.length > LIMITS.dmText) errors["emailCapture.retryText"] = `Instagram allows up to ${LIMITS.dmText} characters.`;
  if (content.finalDm.text.length > LIMITS.dmText) errors["finalDm.text"] = `Instagram allows up to ${LIMITS.dmText} characters.`;
  const button = content.finalDm.buttons[0];
  if (button && button.label.length > LIMITS.buttonLabel) errors["finalDm.buttons.0.label"] = `Button labels can be up to ${LIMITS.buttonLabel} characters.`;
  return errors;
}

/** Full validation for Go Live and for Save while Live (FR-7.2). */
export function validateForLive(content: AutomationContent): FieldErrors {
  const errors: FieldErrors = { ...validateLimits(content) };
  if (!content.name.trim()) errors.name = "Give this automation a name.";
  const story = content.type === "story_reply";
  if (content.trigger.postScope === "specific" && !content.trigger.mediaId) errors["trigger.mediaId"] = story ? "Pick the story people will reply to." : "Pick the post or reel people will comment on.";
  if (content.trigger.match === "keywords" && content.trigger.keywords.length === 0) errors["trigger.keywords"] = `Add at least one keyword, or choose ${story ? "Any reply" : "Any comment"}.`;
  if (!story && content.commentReply.enabled && !content.commentReply.variants.some((variant) => variant.trim())) errors["commentReply.variants"] = "Write at least one reply, or turn replies off.";
  if (!content.openingDm.text.trim()) errors["openingDm.text"] = "The opening DM needs a message.";
  if (!content.openingDm.buttonLabel.trim()) errors["openingDm.buttonLabel"] = "The opening DM needs a button label.";
  const follow = followGateOf(content);
  if (follow.enabled && !follow.text.trim()) errors["followGate.text"] = "Write the message that asks them to follow you.";
  if (follow.enabled && !follow.buttonLabel.trim()) errors["followGate.buttonLabel"] = "Add a button label.";
  if (follow.enabled && !follow.retryText.trim()) errors["followGate.retryText"] = "Write the message for when they still don't follow you.";
  const email = emailCaptureOf(content);
  if (email.enabled && !email.text.trim()) errors["emailCapture.text"] = "Write the message that asks for their email.";
  if (email.enabled && !email.retryText.trim()) errors["emailCapture.retryText"] = "Write the message for when the email doesn't look right.";
  if (!content.finalDm.text.trim()) errors["finalDm.text"] = "The final DM needs a message.";
  const button = content.finalDm.buttons[0];
  if (!button?.label.trim()) errors["finalDm.buttons.0.label"] = "Add a button label.";
  if (!button || !isValidHttpsUrl(button.url.trim())) errors["finalDm.buttons.0.url"] = "Use a full link that starts with https://";
  return errors;
}

export function errorCount(errors: FieldErrors) {
  return Object.keys(errors).length;
}

export function firstErrorField(errors: FieldErrors): FieldPath | null {
  return FIELD_ORDER.find((field) => errors[field]) ?? null;
}

/**
 * Conflict rule at Go Live (FR-7.3): two Live automations that watch the same
 * posts may not overlap. Overlap is a shared keyword (case-insensitive) or
 * either one using Any comment. Automations of different scopes don't
 * conflict, since a comment goes to the most specific one (see `matchComment`).
 * Two Next post automations wait for the same post, so they count as the same.
 * Story Reply automations only conflict with each other, with the same rule:
 * one story is its own scope, and every story is another.
 */
export function findConflict(content: AutomationContent, selfId: string, others: Automation[]) {
  const { postScope, mediaId } = content.trigger;
  if (postScope === "specific" && !mediaId) return null;
  const mine = new Set(content.trigger.keywords.map((keyword) => keyword.trim().toLowerCase()));
  for (const other of others) {
    if (other.id === selfId || other.status !== "live" || other.type !== content.type || other.trigger.postScope !== postScope) continue;
    if (postScope === "specific" && other.trigger.mediaId !== mediaId) continue;
    if (content.trigger.match === "any" || other.trigger.match === "any") return { automation: other, reason: "any" as const };
    const shared = other.trigger.keywords.find((keyword) => mine.has(keyword.trim().toLowerCase()));
    if (shared) return { automation: other, reason: "keyword" as const, keyword: shared };
  }
  return null;
}

const SCOPE_LABEL = { specific: null, next: "Next post", any: "Any post" } as const;

function storyScope(automation: Pick<Automation, "type" | "trigger">) {
  if (automation.trigger.postScope !== "specific") return "Any story";
  if (!automation.trigger.mediaId) return "No story yet";
  return storyExpired(automation) ? "Expired story" : "One story";
}

export function triggerSummary(automation: Pick<Automation, "type" | "trigger">) {
  const story = automation.type === "story_reply";
  const scope = story ? storyScope(automation) : SCOPE_LABEL[automation.trigger.postScope];
  let words: string;
  if (automation.trigger.match === "any") words = story ? "Any reply" : "Any comment";
  else if (!automation.trigger.keywords.length) words = "No keywords yet";
  else words = automation.trigger.keywords.map((keyword) => keyword.toUpperCase()).join(", ");
  return scope ? `${scope} · ${words}` : words;
}
