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

/** Which posts each scope covers, most specific first. An unbound Next post automation covers nothing yet. */
const SCOPE_ORDER = ["specific", "next", "any"] as const;

function watches(automation: Automation, mediaId: string) {
  return automation.trigger.postScope === "any" || automation.trigger.mediaId === mediaId;
}

/**
 * The live automation a comment triggers, or null. Self-comments never
 * trigger, so our own public replies can't loop. A post's own automation
 * wins over Next post, which wins over Any post. Go Live's conflict rule
 * guarantees at most one match within a scope.
 */
export function matchComment(comment: IncomingComment, accountIgUserId: string | null, automations: Automation[]): Automation | null {
  if (comment.isSelf) return null;
  if (accountIgUserId && comment.fromId === accountIgUserId) return null;
  for (const scope of SCOPE_ORDER) {
    for (const automation of automations) {
      if (automation.status !== "live" || automation.type !== "comment_to_dm" || automation.trigger.postScope !== scope || !watches(automation, comment.mediaId)) continue;
      if (automation.trigger.match === "any" || matchesKeywords(comment.text, automation.trigger.keywords)) return automation;
    }
  }
  return null;
}

/**
 * The live Story Reply automation a reply to one of the account's stories
 * triggers, or null. A reply with no text (a reaction, a sticker) only
 * matches Any reply. Go Live's conflict rule guarantees at most one match.
 */
export function matchStoryReply(reply: { text: string | null; fromId: string }, accountIgUserId: string | null, automations: Automation[]): Automation | null {
  if (accountIgUserId && reply.fromId === accountIgUserId) return null;
  return automations.find((automation) => automation.status === "live" && automation.type === "story_reply"
    && (automation.trigger.match === "any" || matchesKeywords(reply.text ?? "", automation.trigger.keywords))) ?? null;
}

/**
 * The post a Next post automation should watch: the earliest one published
 * at or after it went live, or null while there isn't one yet.
 */
export function nextPostAfter<T extends { publishedAt: string }>(media: T[], liveAt: string | null): T | null {
  if (!liveAt) return null;
  const since = Date.parse(liveAt);
  const after = media.filter((item) => Date.parse(item.publishedAt) >= since);
  after.sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt));
  return after[0] ?? null;
}
