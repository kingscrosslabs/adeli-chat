import type { Automation } from "@/lib/automations/schemas";

export type IncomingComment = {
  mediaId: string;
  text: string;
  fromId: string | null;
  /** Adeli marks comments the connected account wrote itself, including our public replies. */
  isSelf: boolean;
};

function normalize(value: string) {
  return value.normalize("NFC").toLowerCase();
}

/** Case-insensitive containment, so "guide please" matches the keyword GUIDE. */
export function matchesKeywords(text: string, keywords: string[]) {
  const haystack = normalize(text);
  return keywords.some((keyword) => {
    const needle = normalize(keyword.trim());
    return needle.length > 0 && haystack.includes(needle);
  });
}

/**
 * The live automation a comment triggers, or null. Self-comments never
 * trigger, so our own public replies can't loop. Go Live's conflict rule
 * guarantees at most one live automation matches a comment.
 */
export function matchComment(comment: IncomingComment, accountIgUserId: string | null, automations: Automation[]): Automation | null {
  if (comment.isSelf) return null;
  if (accountIgUserId && comment.fromId === accountIgUserId) return null;
  for (const automation of automations) {
    if (automation.status !== "live" || automation.trigger.mediaId !== comment.mediaId) continue;
    if (automation.trigger.match === "any" || matchesKeywords(comment.text, automation.trigger.keywords)) return automation;
  }
  return null;
}
