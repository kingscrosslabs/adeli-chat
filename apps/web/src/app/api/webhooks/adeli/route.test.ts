import { createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const handleEvent = vi.fn(async () => undefined);
const after = vi.fn((task: () => Promise<void>) => void task());
vi.mock("@/lib/runtime/handle", () => ({ handleEvent: (...args: unknown[]) => handleEvent(...(args as [])) }));
vi.mock("next/server", () => ({ after: (task: () => Promise<void>) => after(task) }));
const secrets = [{ userId: "user_1", secret: "whsec_test" }, { userId: "user_2", secret: "whsec_other" }];
vi.mock("@/lib/user-settings", () => ({
  webhookSecrets: async (userId?: string) => secrets.filter((entry) => !userId || entry.userId === userId),
}));

const { POST: legacyPOST } = await import("./route");
const { POST: userPOST } = await import("./[userId]/route");

const event = JSON.stringify({
  id: "evt_1",
  type: "comment.created",
  platform: "instagram",
  createdAt: "2026-10-27T12:00:00.000Z",
  profileId: "profile_1",
  accountId: "acc_1",
  data: { commentId: "c1", mediaId: "m1", parentId: null, text: "guide", from: { id: "ig_fan", username: "fan" }, isSelf: false },
});

function sign(body: string, secret = "whsec_test", timestamp = Math.floor(Date.now() / 1000)) {
  return `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

function request(body: string, signature: string | null) {
  return new Request("http://localhost:3030/api/webhooks/adeli/user_1", { method: "POST", body, headers: signature ? { "Adeli-Signature": signature } : {} });
}

function deliver(body: string, signature: string | null, userId = "user_1") {
  return userPOST(request(body, signature), { params: Promise.resolve({ userId }) });
}

beforeEach(() => {
  handleEvent.mockClear();
  after.mockClear();
});

afterEach(() => vi.clearAllMocks());

describe("POST /api/webhooks/adeli/[userId]", () => {
  it("rejects a bad or missing signature with 401", async () => {
    expect((await deliver(event, sign(event, "wrong_secret"))).status).toBe(401);
    expect((await deliver(event, null)).status).toBe(401);
    expect((await deliver(`${event} `, sign(event))).status).toBe(401);
    expect(handleEvent).not.toHaveBeenCalled();
  });

  it("answers 400 for a signed but malformed event", async () => {
    const body = JSON.stringify({ type: "comment.created" });
    expect((await deliver(body, sign(body))).status).toBe(400);
    expect(handleEvent).not.toHaveBeenCalled();
  });

  it("answers 200 and handles a verified event after the response", async () => {
    const response = await deliver(event, sign(event));
    expect(response.status).toBe(200);
    expect(after).toHaveBeenCalledTimes(1);
    expect(handleEvent).toHaveBeenCalledWith("user_1", expect.objectContaining({ id: "evt_1", type: "comment.created" }));
  });

  it("only accepts the URL's own user's secret", async () => {
    expect((await deliver(event, sign(event, "whsec_other"), "user_1")).status).toBe(401);
    expect((await deliver(event, sign(event), "nobody")).status).toBe(404);
    expect(handleEvent).not.toHaveBeenCalled();
  });
});

describe("POST /api/webhooks/adeli (before per-user URLs)", () => {
  it("handles the event for the user whose secret signed it", async () => {
    expect((await legacyPOST(request(event, sign(event, "whsec_other")))).status).toBe(200);
    expect(handleEvent).toHaveBeenCalledWith("user_2", expect.objectContaining({ id: "evt_1" }));
    expect((await legacyPOST(request(event, sign(event, "wrong")))).status).toBe(401);
  });
});
