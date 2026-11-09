import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fakeAdeli } from "../../../test/fake-adeli";
import { resetDatabase, seedAccount, seedLiveAutomation, seedUser } from "../../../test/db-helpers";

import { handleMcpRequest } from "./handler";
import { createToken, revokeToken } from "./tokens";

const MCP_URL = "http://localhost:3030/mcp";

const POSTS = {
  posts: [
    { id: "post_1", providerId: "media_1", caption: "Free guide inside", permalink: "https://instagram.com/p/1", publishedAt: "2026-11-01T00:00:00Z", media: [{ type: "image", url: "https://cdn.example.com/1.jpg", thumbnailUrl: null }], engagement: { likes: 10, comments: 4 } },
    { id: "post_2", providerId: "media_2", caption: "Reel", permalink: "https://instagram.com/p/2", publishedAt: "2026-11-02T00:00:00Z", media: [{ type: "reel", url: "https://cdn.example.com/2.mp4", thumbnailUrl: "https://cdn.example.com/2.jpg" }], engagement: { likes: 3, comments: 1 } },
  ],
};

/** An MCP client whose HTTP goes straight to our `/mcp` handler. */
async function connect(token: string) {
  const client = new Client({ name: "test", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    fetch: (input, init) => handleMcpRequest(new Request(input, init)),
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  await client.connect(transport);
  return client;
}

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
  fakeAdeli([(sent) => (sent.method === "GET" && sent.path === "/posts" ? { status: 200, body: POSTS } : undefined)]);
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
      "create_automation", "delete_automation", "duplicate_automation", "get_automation", "get_workspace",
      "go_live", "list_automations", "list_posts", "pause_automation", "reset_runs", "update_automation",
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

    const live = data(await client.callTool({ name: "go_live", arguments: { id: created.id } }));
    expect(live.status).toBe("live");

    const listed = data(await client.callTool({ name: "list_automations", arguments: { status: "live" } }));
    expect(listed.map((item: { id: string }) => item.id)).toEqual([created.id]);
    expect(listed[0].url).toBe(`http://localhost:3030/automations/${created.id}`);

    expect(data(await client.callTool({ name: "pause_automation", arguments: { id: created.id } })).status).toBe("paused");
    expect(data(await client.callTool({ name: "delete_automation", arguments: { id: created.id } })).deleted).toBe(true);
    expect(data(await client.callTool({ name: "list_automations", arguments: {} }))).toEqual([]);
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

  it("tells the client to connect Instagram first", async () => {
    const { token } = await createToken("user_1", { name: "test", readOnly: false, expiry: "never" });
    const client = await connect(token);
    const workspace = data(await client.callTool({ name: "get_workspace", arguments: {} }));
    expect(workspace.instagram).toBeNull();
    expect(workspace.setupNeeded).toContain("Connect an Instagram account");
    expect((await client.callTool({ name: "list_automations", arguments: {} })).isError).toBe(true);
  });
});
