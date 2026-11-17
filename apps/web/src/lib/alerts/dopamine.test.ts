import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultAutomationContent } from "@adeli-chat/ui/automation/defaults";
import { goLive, saveAutomation } from "@/lib/automations/service";

import { resetDatabase, seedAccount, seedLiveAutomation, seedUser } from "../../../test/db-helpers";

import { alertSignup } from "./dopamine";

const USER = "user_1";
const SLACK = "https://hooks.slack.com/services/dopamine";
let accountId: string;

function fakeSlack(status = 200) {
  const posted: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    posted.push((JSON.parse(await request.text()) as { text: string }).text);
    return new Response("ok", { status });
  }));
  return posted;
}

async function seedDraft(keyword: string, name = "Free guide") {
  const automation = await seedLiveAutomation(accountId, { name, status: "draft", liveAt: null, trigger: { ...defaultAutomationContent(0).trigger, mediaId: `media_${keyword}`, match: "keywords", keywords: [keyword] } });
  return automation;
}

beforeEach(async () => {
  await resetDatabase();
  await seedUser(USER);
  accountId = (await seedAccount(USER)).id;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("#dopamine-hits alerts", () => {
  it("announces a sign-up, escaped for Slack", async () => {
    vi.stubEnv("SLACK_SIGNUP_WEBHOOK_URL", SLACK);
    const posted = fakeSlack();
    await alertSignup({ id: "u", name: "Ada <Lovelace>", email: "ada@example.com" });
    await vi.waitFor(() => expect(posted).toEqual([":tada: *New LedaChat signup: Ada &lt;Lovelace&gt;* (ada@example.com)"]));
  });

  it("announces an automation going live, marks the first one, and never its DM text", async () => {
    vi.stubEnv("SLACK_SIGNUP_WEBHOOK_URL", SLACK);
    const posted = fakeSlack();
    const first = await seedDraft("guide");
    expect(await goLive(USER, first.id, undefined, "mcp")).toEqual({ ok: true });
    await vi.waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toBe(":rocket: *user_1 (user_1@example.com) @birds put an automation live* via MCP\nFree guide: Comment to DM, GUIDE on one post\n:sparkles: First automation!");
    expect(posted[0]).not.toContain("Here it is!");

    const second = await seedDraft("recipe", "Recipes");
    await goLive(USER, second.id);
    await vi.waitFor(() => expect(posted).toHaveLength(2));
    expect(posted[1]).not.toContain("First automation");
    expect(posted[1]).not.toContain("via MCP");
  });

  it("stays quiet for saves and Go Live on an automation that's already live", async () => {
    vi.stubEnv("SLACK_SIGNUP_WEBHOOK_URL", SLACK);
    const posted = fakeSlack();
    const live = await seedLiveAutomation(accountId);
    await goLive(USER, live.id);
    await saveAutomation(USER, live.id, { ...live, name: "Renamed" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(posted).toEqual([]);
  });

  it("sends nothing without the webhook, and a Slack failure never fails Go Live", async () => {
    const posted = fakeSlack(500);
    expect(await goLive(USER, (await seedDraft("one")).id)).toEqual({ ok: true });
    expect(posted).toEqual([]);
    vi.stubEnv("SLACK_SIGNUP_WEBHOOK_URL", SLACK);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await goLive(USER, (await seedDraft("two")).id)).toEqual({ ok: true });
    await vi.waitFor(() => expect(warn).toHaveBeenCalledWith(expect.stringContaining("Couldn't post a Slack alert")));
    warn.mockRestore();
  });
});
