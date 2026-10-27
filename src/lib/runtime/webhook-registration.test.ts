import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAppSettings, markKeyStatus } from "@/lib/app-settings";

import { fakeAdeli, type Sent } from "../../../test/fake-adeli";
import { resetDatabase } from "../../../test/db-helpers";

import { ensureAdeliWebhook } from "./webhook-registration";

const URL_ = "http://localhost:3030/api/webhooks/adeli";

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
  vi.stubEnv("ADELI_API_KEY", `rk_live_${"a".repeat(43)}`);
  vi.stubEnv("ADELI_BASE_URL", "http://localhost:3000");
  vi.stubEnv("APP_URL", "http://localhost:3030");
  await resetDatabase();
  await markKeyStatus("valid", { id: "profile_1", name: "Nick" });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("ensureAdeliWebhook", () => {
  it("creates a webhook once, stores its secret, and reuses it after a restart", async () => {
    const adeli = webhookAdeli();
    expect(await ensureAdeliWebhook()).toEqual({ id: "wh_1", created: true });
    const created = adeli.sent.find((item) => item.method === "POST");
    expect(created?.body).toEqual({ profileId: "profile_1", url: URL_, events: ["comment.created", "message.postback"] });
    expect(await getAppSettings()).toMatchObject({ adeliWebhookId: "wh_1", adeliWebhookSecret: "whsec_wh_1" });

    expect(await ensureAdeliWebhook()).toEqual({ id: "wh_1", created: false });
    expect(adeli.sent.filter((item) => item.method === "POST")).toHaveLength(1);
  });

  it("replaces the webhook when APP_URL changes", async () => {
    const adeli = webhookAdeli();
    await ensureAdeliWebhook();
    vi.stubEnv("APP_URL", "https://chat.example.com");
    expect(await ensureAdeliWebhook()).toEqual({ id: "wh_2", created: true });
    expect(adeli.sent.some((item) => item.method === "DELETE" && item.path === "/webhooks/wh_1")).toBe(true);
  });
});
