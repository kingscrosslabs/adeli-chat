import { vi } from "vitest";

export type Sent = { method: string; path: string; body: Record<string, unknown> | null };

type Reply = { status: number; body?: unknown };
type Route = (sent: Sent) => Reply | undefined;

/**
 * A fake Adeli behind the SDK's `fetch`. Records every request and answers
 * from `routes`, falling back to plausible successes for the runtime's calls.
 * `delayMs` holds each answer, so concurrent deliveries overlap in tests.
 */
export function fakeAdeli(routes: Route[] = [], options: { delayMs?: number } = {}) {
  const sent: Sent[] = [];
  const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const text = await request.text();
    const entry: Sent = { method: request.method, path: new URL(request.url).pathname.replace(/^\/api\/v1/, ""), body: text ? JSON.parse(text) : null };
    sent.push(entry);
    if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    for (const route of routes) {
      const reply = route(entry);
      if (reply) return Response.json(reply.body ?? {}, { status: reply.status });
    }
    return Response.json(defaultBody(entry), { status: entry.method === "POST" ? 201 : 200 });
  });
  vi.stubGlobal("fetch", fetch);
  return { sent, fetch, messages: () => sent.filter((item) => item.path === "/messages/instagram"), comments: () => sent.filter((item) => item.path === "/comments") };
}

let counter = 0;

function defaultBody(sent: Sent) {
  const now = new Date().toISOString();
  counter += 1;
  if (sent.path === "/messages/instagram") {
    return { id: `msg_${counter}`, providerId: `mid_${counter}`, platform: "instagram", accountId: sent.body?.accountId, profileId: "profile_1", direction: "outbound", type: "buttons", recipient: "ig_commenter", sender: "ig_self", body: sent.body?.text, status: "sent", occurredAt: now, createdAt: now };
  }
  if (sent.path === "/comments") {
    return { platform: "instagram", accountId: sent.body?.accountId, profileId: "profile_1", comment: { id: `reply_${counter}`, mediaId: "media_1", parentId: sent.body?.parentId ?? null, authorName: "self", authorFullName: null, authorHandle: "self", avatarUrl: null, profileUrl: null, body: sent.body?.message, likeCount: 0, isCreator: true, isHidden: false, createdAt: now } };
  }
  return {};
}

export function apiError(status: number, code: string, message = code): Reply {
  return { status, body: { error: { code, message } } };
}
