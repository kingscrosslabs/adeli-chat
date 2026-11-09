import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getUserSettings } from "@/lib/user-settings";

import { fakeAdeli, type Sent } from "../../../test/fake-adeli";
import { resetDatabase, seedUser } from "../../../test/db-helpers";

import { ensureAdeliWebhook } from "./webhook-registration";

const USER = "user_1";
const URL_ = `http://localhost:3030/api/webhooks/adeli/${USER}`;

/** A fake Adeli that keeps the webhooks it creates. */
function webhookAdeli() {
  const webhooks: Array<{ id: string; profileId: string; url: string; events: string[]; status: "active"; createdAt: string }> = [];
  return fakeAdeli([
    (sent: Sent) => {
      if (sent.path === "/webhooks" && sent.method === "GET") return { status: 200, body: { webhooks } };
      if (sent.path === "/webhooks" && sent.method === "POST") {
        const webhook = { id: `wh_${webhooks.length + 1}`, profileId: String(sent.body?.profileId), url: String(sent.body?.url), events: sent.body?.events as string[], status: "active" as const, createdAt: new Date().toISOString() };
        webhooks.push(webhook);
        return { status: 201, body: { webhook, secret: `whsec_${webhook.id}` } };
      }
      return undefined;
    },
  ]);
}

beforeEach(async () => {
  vi.stubEnv("APP_URL", "http://localhost:3030");
  await resetDatabase();
  await seedUser(USER);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("ensureAdeliWebhook", () => {
  it("creates a webhook once, stores its secret, and reuses it after a restart", async () => {
    const adeli = webhookAdeli();
    expect(await ensureAdeliWebhook(USER)).toEqual({ id: "wh_1", created: true });
    const created = adeli.sent.find((item) => item.method === "POST");
    expect(created?.body).toEqual({ profileId: "profile_1", url: URL_, events: ["comment.created", "message.postback"] });
    expect(await getUserSettings(USER)).toMatchObject({ adeliWebhookId: "wh_1", adeliWebhookSecret: "whsec_wh_1" });

    expect(await ensureAdeliWebhook(USER)).toEqual({ id: "wh_1", created: false });
    expect(adeli.sent.filter((item) => item.method === "POST")).toHaveLength(1);
  });

  it("replaces the webhook when APP_URL changes", async () => {
    const adeli = webhookAdeli();
    await ensureAdeliWebhook(USER);
    vi.stubEnv("APP_URL", "https://chat.example.com");
    expect(await ensureAdeliWebhook(USER)).toEqual({ id: "wh_2", created: true });
    expect(adeli.sent.some((item) => item.method === "DELETE" && item.path === "/webhooks/wh_1")).toBe(true);
  });

  it("gives each user their own webhook URL and secret", async () => {
    const adeli = webhookAdeli();
    await seedUser("user_2", `rk_live_${"b".repeat(43)}`);
    await ensureAdeliWebhook(USER);
    await ensureAdeliWebhook("user_2");
    const urls = adeli.sent.filter((item) => item.method === "POST").map((item) => item.body?.url);
    expect(urls).toEqual([URL_, "http://localhost:3030/api/webhooks/adeli/user_2"]);
    expect((await getUserSettings("user_2")).adeliWebhookSecret).toBe("whsec_wh_2");
    expect((await getUserSettings(USER)).adeliWebhookSecret).toBe("whsec_wh_1");
  });
});
