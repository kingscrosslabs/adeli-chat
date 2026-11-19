import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fakeAdeli } from "../../../test/fake-adeli";
import { resetDatabase, seedAccount, seedLiveAutomation, seedUser } from "../../../test/db-helpers";

import { db, schema } from "@/lib/db";

import { handleMcpRequest } from "./handler";
import { createToken, revokeToken } from "./tokens";

const MCP_URL = "http://localhost:3030/mcp";

const POSTS = {
  posts: [
    { id: "post_1", providerId: "media_1", caption: "Free guide inside", permalink: "https://instagram.com/p/1", publishedAt: "2026-11-01T00:00:00Z", media: [{ type: "image", url: "https://cdn.example.com/1.jpg", thumbnailUrl: null }], engagement: { likes: 10, comments: 4 } },
    { id: "post_2", providerId: "media_2", caption: "Reel", permalink: "https://instagram.com/p/2", publishedAt: "2026-11-02T00:00:00Z", media: [{ type: "reel", url: "https://cdn.example.com/2.mp4", thumbnailUrl: "https://cdn.example.com/2.jpg" }], engagement: { likes: 3, comments: 1 } },
  ],
};

type ConnectOptions = {
  /** Protocol 2026-07-28 (per-request capabilities, `input_required`) instead of the default 2025 handshake. */
  modern?: boolean;
  capabilities?: ConstructorParameters<typeof Client>[1] extends infer O ? O extends { capabilities?: infer C } ? C : never : never;
  /** Every HTTP status `/mcp` answered a POST with (the GET stream is a 405 on our stateless server). */
  statuses?: number[];
};

/** An MCP client whose HTTP goes straight to our `/mcp` handler. */
async function connect(token: string, { modern = false, capabilities, statuses }: ConnectOptions = {}) {
  const client = new Client({ name: "test", version: "1.0.0" }, { ...(capabilities ? { capabilities } : {}), ...(modern ? { versionNegotiation: { mode: "auto" as const } } : {}) });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    fetch: async (input, init) => {
      const request = new Request(input, init);
      const response = await handleMcpRequest(request);
      if (request.method === "POST") statuses?.push(response.status);
      return response;
    },
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  await client.connect(transport);
  return client;
}

const SETUP = { next: "connect_instagram", message: "Connect an Instagram professional account to continue.", tool: "connect_instagram" };
const CONNECT_LINK = /^http:\/\/localhost:3030\/connect\/start\/[A-Za-z0-9_-]{43}$/;

const STORY_AT = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const STORIES = {
  platform: "instagram",
  accountId: "acc_1",
  profileId: "profile_1",
  stories: [
    { id: "story_1", mediaType: "VIDEO", mediaProductType: "STORY", mediaUrl: null, thumbnailUrl: "https://cdn.example.com/s1.jpg", permalink: "https://instagram.com/stories/birds/story_1", timestamp: STORY_AT, expiresAt: new Date(Date.parse(STORY_AT) + 86_400_000).toISOString() },
  ],
};

function text(result: Awaited<ReturnType<Client["callTool"]>>) {
  const first = (result.content as Array<{ type: string; text?: string }>)[0];
  return first?.text ?? "";
}

function data(result: Awaited<ReturnType<Client["callTool"]>>) {
  expect(result.isError, text(result)).toBeFalsy();
  return JSON.parse(text(result));
}

beforeEach(async () => {
  vi.stubEnv("APP_URL", "http://localhost:3030");
  await resetDatabase();
  await seedUser("user_1");
  await seedUser("user_2");
  fakeAdeli([
    (sent) => (sent.method === "GET" && sent.path === "/posts" ? { status: 200, body: POSTS } : undefined),
    (sent) => (sent.method === "GET" && sent.path === "/posts/instagram/stories" ? { status: 200, body: STORIES } : undefined),
  ]);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("/mcp authentication", () => {
  it("answers without a token with a 401 that points at the protected resource metadata", async () => {
    const response = await handleMcpRequest(new Request(MCP_URL, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) }));
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("resource_metadata=");
  });

  it("rejects unknown, revoked and expired API tokens", async () => {
    const post = (token: string) => handleMcpRequest(new Request(MCP_URL, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) }));
    expect((await post("adc_not-a-real-token")).status).toBe(401);

    const revoked = await createToken("user_1", { name: "old", readOnly: false, expiry: "never" });
    await revokeToken("user_1", revoked.apiToken.id);
    expect((await post(revoked.token)).status).toBe(401);

    const expired = await createToken("user_1", { name: "short", readOnly: false, expiry: "30d" }, new Date("2020-01-01T00:00:00Z"));
    expect((await post(expired.token)).status).toBe(401);
  });
});

describe("/mcp tools", () => {
  it("lists every automation tool", async () => {
    const { token } = await createToken("user_1", { name: "test", readOnly: false, expiry: "never" });
    const client = await connect(token);
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "connect_instagram", "create_automation", "delete_automation", "duplicate_automation", "get_automation", "get_workspace",
      "go_live", "list_audience", "list_automations", "list_posts", "list_stories", "message_earlier_comments", "pause_automation", "reset_runs", "update_automation",
    ]);
    expect(tools.find((tool) => tool.name === "delete_automation")?.annotations?.destructiveHint).toBe(true);
  });

  it("creates a draft, fills it in and takes it live", async () => {
    await seedAccount("user_1");
    const { token } = await createToken("user_1", { name: "test", readOnly: false, expiry: "never" });
    const client = await connect(token);

    const posts = data(await client.callTool({ name: "list_posts", arguments: {} }));
    expect(posts.posts[0]).toMatchObject({ id: "media_1", caption: "Free guide inside" });

    const created = data(await client.callTool({ name: "create_automation", arguments: { name: "Guide", postId: "media_1", keywords: ["guide"], linkUrl: "https://example.com/guide" } }));
    expect(created).toMatchObject({ name: "Guide", status: "draft", postId: "media_1", keywords: ["guide"], linkUrl: "https://example.com/guide" });
    expect(created.post.caption).toBe("Free guide inside");

    const updated = data(await client.callTool({ name: "update_automation", arguments: { id: created.id, keywords: ["guide", "free"], finalDmText: "Here you go" } }));
    expect(updated).toMatchObject({ keywords: ["guide", "free"], finalDmText: "Here you go", name: "Guide" });

    const linked = data(await client.callTool({ name: "update_automation", arguments: { id: created.id, extraLinks: [{ label: "Course", url: " https://example.com/course " }] } }));
    expect(linked).toMatchObject({ linkUrl: "https://example.com/guide", extraLinks: [{ label: "Course", url: "https://example.com/course" }] });

    const live = data(await client.callTool({ name: "go_live", arguments: { id: created.id } }));
    expect(live.status).toBe("live");

    const listed = data(await client.callTool({ name: "list_automations", arguments: { status: "live" } }));
    expect(listed.map((item: { id: string }) => item.id)).toEqual([created.id]);
    expect(listed[0].url).toBe(`http://localhost:3030/automations/${created.id}`);

    expect(data(await client.callTool({ name: "pause_automation", arguments: { id: created.id } })).status).toBe("paused");
    expect(data(await client.callTool({ name: "delete_automation", arguments: { id: created.id } })).deleted).toBe(true);
    expect(data(await client.callTool({ name: "list_automations", arguments: {} }))).toEqual([]);
  });

  it("lists the audience, and one automation's people", async () => {
    const account = await seedAccount("user_1");
    const automation = await seedLiveAutomation(account.id);
    await db().insert(schema.runs).values({ automationId: automation.id, igUserId: "ig_fan", igUsername: "fan", commentId: "c_1", commentText: "guide", state: "final_sent" });
    const { token } = await createToken("user_1", { name: "test", readOnly: true, expiry: "never" });
    const client = await connect(token);

    const everyone = data(await client.callTool({ name: "list_audience", arguments: {} }));
    expect(everyone).toMatchObject({ total: 1, people: [{ igUsername: "fan", automations: 1, finalDms: 1 }] });

    const people = data(await client.callTool({ name: "list_audience", arguments: { automationId: automation.id } }));
    expect(people).toMatchObject({ total: 1, people: [{ igUsername: "fan", stage: "final_sent", commentText: "guide" }] });

    const missing = await client.callTool({ name: "list_audience", arguments: { automationId: "nope" } });
    expect(missing.isError).toBe(true);
  });

  it("lists stories and creates a Story Reply on one of them", async () => {
    await seedAccount("user_1");
    const { token } = await createToken("user_1", { name: "test", readOnly: false, expiry: "never" });
    const client = await connect(token);

    const { stories } = data(await client.callTool({ name: "list_stories", arguments: {} }));
    expect(stories).toEqual([{ id: "story_1", type: "VIDEO", permalink: "https://instagram.com/stories/birds/story_1", publishedAt: STORY_AT }]);

    const created = data(await client.callTool({ name: "create_automation", arguments: { type: "story_reply", storyId: "story_1", keywords: ["guide"] } }));
    expect(created).toMatchObject({ type: "story_reply", postScope: "specific", postId: "story_1", storyExpired: false, commentReplyEnabled: false });
    expect(created.post).toMatchObject({ thumbUrl: "https://cdn.example.com/s1.jpg", mediaType: "VIDEO", publishedAt: STORY_AT });
    expect(data(await client.callTool({ name: "go_live", arguments: { id: created.id } })).status).toBe("live");
  });

  it("refuses a story that isn't live, and storyId on a Comment to DM automation", async () => {
    await seedAccount("user_1");
    const { token } = await createToken("user_1", { name: "test", readOnly: false, expiry: "never" });
    const client = await connect(token);

    const missing = await client.callTool({ name: "create_automation", arguments: { type: "story_reply", storyId: "story_gone" } });
    expect(missing.isError).toBe(true);
    expect(text(missing)).toContain("Use list_stories");
    expect(data(await client.callTool({ name: "list_automations", arguments: {} }))).toEqual([]);

    const wrongType = await client.callTool({ name: "create_automation", arguments: { storyId: "story_1" } });
    expect(wrongType.isError).toBe(true);
    expect(text(wrongType)).toContain("only for Story Reply");
  });

  it("explains what to fix when an automation can't go live", async () => {
    await seedAccount("user_1");
    const { token } = await createToken("user_1", { name: "test", readOnly: false, expiry: "never" });
    const client = await connect(token);
    const created = data(await client.callTool({ name: "create_automation", arguments: {} }));

    const result = await client.callTool({ name: "go_live", arguments: { id: created.id } });
    expect(result.isError).toBe(true);
    expect(text(result)).toContain("trigger.mediaId");
    expect(text(result)).toContain("trigger.keywords");
  });

  it("refuses to go live over another live automation's keyword", async () => {
    const account = await seedAccount("user_1");
    const existing = await seedLiveAutomation(account.id);
    const { token } = await createToken("user_1", { name: "test", readOnly: false, expiry: "never" });
    const client = await connect(token);
    const created = data(await client.callTool({ name: "create_automation", arguments: { postId: "media_1", keywords: ["GUIDE"], linkUrl: "https://example.com" } }));

    const result = await client.callTool({ name: "go_live", arguments: { id: created.id } });
    expect(result.isError).toBe(true);
    expect(text(result)).toContain(existing.id);
  });

  it("explains the Free limit at go live, and reports the plan", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_test_ledachat");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
    const account = await seedAccount("user_1");
    for (let index = 0; index < 10; index += 1) await seedLiveAutomation(account.id, { trigger: { postScope: "specific", mediaId: `media_live_${index}`, mediaSnapshot: null, match: "keywords", keywords: [`live${index}`] } });
    const { token } = await createToken("user_1", { name: "test", readOnly: false, expiry: "never" });
    const client = await connect(token);
    const created = data(await client.callTool({ name: "create_automation", arguments: { postId: "media_2", keywords: ["NEW"], linkUrl: "https://example.com" } }));

    const result = await client.callTool({ name: "go_live", arguments: { id: created.id } });
    expect(result.isError).toBe(true);
    expect(text(result)).toContain("10 live automations, the most on Free");
    expect(text(result)).toContain("http://localhost:3030/settings#plan");
    expect(data(await client.callTool({ name: "get_workspace", arguments: {} }))).toMatchObject({ plan: "free", liveAutomationLimit: 10, finalDmBranded: true, upgradeUrl: "http://localhost:3030/settings#plan" });
  });

  it("rejects a post that isn't on the account", async () => {
    await seedAccount("user_1");
    const { token } = await createToken("user_1", { name: "test", readOnly: false, expiry: "never" });
    const client = await connect(token);
    const result = await client.callTool({ name: "create_automation", arguments: { postId: "media_404" } });
    expect(result.isError).toBe(true);
    expect(data(await client.callTool({ name: "list_automations", arguments: {} }))).toEqual([]);
  });

  it("only allows reading with a read-only token", async () => {
    const account = await seedAccount("user_1");
    const automation = await seedLiveAutomation(account.id);
    const { token } = await createToken("user_1", { name: "reader", readOnly: true, expiry: "never" });
    const client = await connect(token);

    expect(data(await client.callTool({ name: "get_automation", arguments: { id: automation.id } })).name).toBe("Guide");
    const result = await client.callTool({ name: "pause_automation", arguments: { id: automation.id } });
    expect(result.isError).toBe(true);
    expect(text(result)).toContain("read only");
  });

  it("never reaches another user's automations", async () => {
    const mine = await seedAccount("user_1");
    const automation = await seedLiveAutomation(mine.id);
    await seedAccount("user_2");
    const { token } = await createToken("user_2", { name: "theirs", readOnly: false, expiry: "never" });
    const client = await connect(token);

    expect(data(await client.callTool({ name: "list_automations", arguments: {} }))).toEqual([]);
    expect((await client.callTool({ name: "get_automation", arguments: { id: automation.id } })).isError).toBe(true);
    expect((await client.callTool({ name: "delete_automation", arguments: { id: automation.id } })).isError).toBe(true);
    expect((await client.callTool({ name: "update_automation", arguments: { id: automation.id, name: "Mine now" } })).isError).toBe(true);
  });

});

describe("/mcp on an empty workspace", () => {
  it("answers every tool normally, with setup saying to call connect_instagram, never 401 or 403", async () => {
    const { token } = await createToken("user_1", { name: "test", readOnly: false, expiry: "never" });
    const statuses: number[] = [];
    const client = await connect(token, { statuses });

    const workspace = data(await client.callTool({ name: "get_workspace", arguments: {} }));
    expect(workspace).toMatchObject({ instagram: null, setup: SETUP });
    expect(workspace).not.toHaveProperty("setupNeeded");
    expect(data(await client.callTool({ name: "list_automations", arguments: {} }))).toEqual({ automations: [], setup: SETUP });
    expect(data(await client.callTool({ name: "list_automations", arguments: { status: "live" } }))).toEqual({ automations: [], setup: SETUP });
    expect(data(await client.callTool({ name: "list_audience", arguments: {} }))).toMatchObject({ people: [], setup: SETUP });
    expect(data(await client.callTool({ name: "list_audience", arguments: { automationId: "a_1" } }))).toMatchObject({ people: [], setup: SETUP });
    expect(data(await client.callTool({ name: "get_automation", arguments: { id: "a_1" } }))).toEqual({ status: "setup_required", setup: SETUP });

    const blocked: Array<[string, Record<string, unknown>]> = [
      ["list_posts", {}], ["list_stories", {}],
      ["create_automation", {}], ["create_automation", { type: "story_reply" }], ["update_automation", { id: "a_1", name: "x" }],
      ["go_live", { id: "a_1" }], ["pause_automation", { id: "a_1" }], ["duplicate_automation", { id: "a_1" }],
      ["delete_automation", { id: "a_1" }], ["reset_runs", { id: "a_1" }],
      ["message_earlier_comments", { id: "a_1", send: false }], ["message_earlier_comments", { id: "a_1", send: true }],
    ];
    for (const [name, args] of blocked) {
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError, name).toBe(true);
      expect(JSON.parse(text(result)), name).toEqual({ status: "setup_required", setup: SETUP });
    }

    const link = data(await client.callTool({ name: "connect_instagram", arguments: {} }));
    expect(link.url).toMatch(CONNECT_LINK);
    expect(statuses.length).toBeGreaterThan(0);
    expect(statuses.every((status) => status === 200 || status === 202)).toBe(true);
    expect(await db().select().from(schema.automations)).toEqual([]);
  });

  it("says read only before setup on a read-only connection, and still answers reads", async () => {
    const { token } = await createToken("user_1", { name: "reader", readOnly: true, expiry: "never" });
    const client = await connect(token);
    expect(text(await client.callTool({ name: "create_automation", arguments: {} }))).toContain("read only");
    expect(data(await client.callTool({ name: "list_automations", arguments: {} }))).toEqual({ automations: [], setup: SETUP });
  });
});

describe("connect_instagram", () => {
  async function links() {
    return db().select().from(schema.connectLinks);
  }

  it("returns a one-time link in the result when the client can't open URLs", async () => {
    const { token } = await createToken("user_1", { name: "test", readOnly: false, expiry: "never" });
    const client = await connect(token);
    const result = await client.callTool({ name: "connect_instagram", arguments: {} });
    const body = data(result);
    expect(body).toMatchObject({ instagram: null, expiresInMinutes: 15 });
    expect(body.url).toMatch(CONNECT_LINK);
    expect(body).not.toHaveProperty("elicitation");
    const instruction = (result.content as Array<{ text: string }>)[1].text;
    expect(instruction).toContain("Show the user this link");
    expect(instruction).toContain(body.url);
    const [row] = await links();
    expect(row).toMatchObject({ userId: "user_1", method: null, usedAt: null });
    expect(body.url).not.toContain(row.codeHash);
  });

  it("passes the login method to the link", async () => {
    const { token } = await createToken("user_1", { name: "test", readOnly: false, expiry: "never" });
    const client = await connect(token);
    data(await client.callTool({ name: "connect_instagram", arguments: { method: "facebook" } }));
    expect((await links())[0].method).toBe("facebook");
  });

  it("prompts with URL elicitation when the client declares it, and still returns the link", async () => {
    const { token } = await createToken("user_1", { name: "test", readOnly: false, expiry: "never" });
    const client = await connect(token, { modern: true, capabilities: { elicitation: { url: {} } } });
    const prompts: Array<Record<string, unknown>> = [];
    client.setRequestHandler("elicitation/create", async (request) => {
      prompts.push(request.params as Record<string, unknown>);
      return { action: "accept" };
    });

    const body = data(await client.callTool({ name: "connect_instagram", arguments: {} }));
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toMatchObject({ mode: "url", message: "Continue with Instagram to finish setting up LedaChat." });
    expect(prompts[0].url).toMatch(CONNECT_LINK);
    expect(body).toMatchObject({ url: prompts[0].url, instagram: null, expiresInMinutes: 15, elicitation: "accept" });
    expect(await links()).toHaveLength(1);
  });

  it("returns the link even when the user declines the prompt", async () => {
    const { token } = await createToken("user_1", { name: "test", readOnly: false, expiry: "never" });
    const client = await connect(token, { modern: true, capabilities: { elicitation: { url: {} } } });
    client.setRequestHandler("elicitation/create", async () => ({ action: "decline" }));
    const body = data(await client.callTool({ name: "connect_instagram", arguments: {} }));
    expect(body).toMatchObject({ elicitation: "decline" });
    expect(body.url).toMatch(CONNECT_LINK);
  });

  it("doesn't elicit when a modern client only supports form elicitation", async () => {
    const { token } = await createToken("user_1", { name: "test", readOnly: false, expiry: "never" });
    const client = await connect(token, { modern: true, capabilities: { elicitation: { form: {} } } });
    let prompted = false;
    client.setRequestHandler("elicitation/create", async () => {
      prompted = true;
      return { action: "cancel" };
    });
    const body = data(await client.callTool({ name: "connect_instagram", arguments: {} }));
    expect(prompted).toBe(false);
    expect(body.url).toMatch(CONNECT_LINK);
  });

  it("works on a read-only connection", async () => {
    const { token } = await createToken("user_1", { name: "reader", readOnly: true, expiry: "never" });
    const client = await connect(token);
    expect(data(await client.callTool({ name: "connect_instagram", arguments: {} })).url).toMatch(CONNECT_LINK);
  });

  it("gives no link when an account is already connected", async () => {
    await seedAccount("user_1");
    const { token } = await createToken("user_1", { name: "test", readOnly: false, expiry: "never" });
    const client = await connect(token, { modern: true, capabilities: { elicitation: { url: {} } } });
    let prompted = false;
    client.setRequestHandler("elicitation/create", async () => {
      prompted = true;
      return { action: "accept" };
    });
    const body = data(await client.callTool({ name: "connect_instagram", arguments: {} }));
    expect(body).toMatchObject({ url: null, instagram: "@birds" });
    expect(prompted).toBe(false);
    expect(await links()).toEqual([]);
    expect(data(await client.callTool({ name: "get_workspace", arguments: {} }))).toMatchObject({ instagram: { handle: "@birds" }, setup: null });
  });
});
