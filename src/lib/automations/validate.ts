import { LIMITS, type Automation, type AutomationContent } from "./schemas";

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
  if (content.finalDm.text.length > LIMITS.dmText) errors["finalDm.text"] = `Instagram allows up to ${LIMITS.dmText} characters.`;
  const button = content.finalDm.buttons[0];
  if (button && button.label.length > LIMITS.buttonLabel) errors["finalDm.buttons.0.label"] = `Button labels can be up to ${LIMITS.buttonLabel} characters.`;
  return errors;
}

/** Full validation for Go Live and for Save while Live (FR-7.2). */
export function validateForLive(content: AutomationContent): FieldErrors {
  const errors: FieldErrors = { ...validateLimits(content) };
  if (!content.name.trim()) errors.name = "Give this automation a name.";
  if (!content.trigger.mediaId) errors["trigger.mediaId"] = "Pick the post or reel people will comment on.";
  if (content.trigger.match === "keywords" && content.trigger.keywords.length === 0) errors["trigger.keywords"] = "Add at least one keyword, or choose Any comment.";
  if (content.commentReply.enabled && !content.commentReply.variants.some((variant) => variant.trim())) errors["commentReply.variants"] = "Write at least one reply, or turn replies off.";
  if (!content.openingDm.text.trim()) errors["openingDm.text"] = "The opening DM needs a message.";
  if (!content.openingDm.buttonLabel.trim()) errors["openingDm.buttonLabel"] = "The opening DM needs a button label.";
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
 * Conflict rule at Go Live (FR-7.3): two Live automations on the same post may
 * not overlap. Overlap is a shared keyword (case-insensitive) or either one
 * using Any comment.
 */
export function findConflict(content: AutomationContent, selfId: string, others: Automation[]) {
  if (!content.trigger.mediaId) return null;
  const mine = new Set(content.trigger.keywords.map((keyword) => keyword.trim().toLowerCase()));
  for (const other of others) {
    if (other.id === selfId || other.status !== "live" || other.trigger.mediaId !== content.trigger.mediaId) continue;
    if (content.trigger.match === "any" || other.trigger.match === "any") return { automation: other, reason: "any" as const };
    const shared = other.trigger.keywords.find((keyword) => mine.has(keyword.trim().toLowerCase()));
    if (shared) return { automation: other, reason: "keyword" as const, keyword: shared };
  }
  return null;
}

export function triggerSummary(automation: Pick<Automation, "trigger">) {
  if (automation.trigger.match === "any") return "Any comment";
  if (!automation.trigger.keywords.length) return "No keywords yet";
  return automation.trigger.keywords.map((keyword) => keyword.toUpperCase()).join(", ");
}
