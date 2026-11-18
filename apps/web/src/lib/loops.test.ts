import { afterEach, describe, expect, it, vi } from "vitest";

import { notifyLoopsSignup, sendLoopsEvent, splitName } from "./loops";

type Sent = { url: string; headers: Headers; body: Record<string, unknown> };

function fakeLoops(status = 200) {
  const sent: Sent[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    sent.push({ url: request.url, headers: request.headers, body: JSON.parse(await request.text()) as Record<string, unknown> });
    return new Response(JSON.stringify({ success: status < 300 }), { status });
  }));
  return sent;
}

const USER = { id: "user_1", name: "Ada King Lovelace", email: "ada@example.com" };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Loops sign-up event", () => {
  it("sends the signup event with the user's name, id and a once-per-user key", async () => {
    vi.stubEnv("LOOPS_API_KEY", "loops_test_key");
    const sent = fakeLoops();
    await notifyLoopsSignup(USER);
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe("https://app.loops.so/api/v1/events/send");
    expect(sent[0].headers.get("authorization")).toBe("Bearer loops_test_key");
    expect(sent[0].headers.get("idempotency-key")).toBe("ledachat-signup-user_1");
    expect(sent[0].body).toEqual({
      eventName: "signup",
      email: "ada@example.com",
      userId: "user_1",
      firstName: "Ada",
      lastName: "King Lovelace",
      source: "ledachat-app",
      userGroup: "ledachat-user",
    });
  });

  it("sends nothing without a key", async () => {
    const sent = fakeLoops();
    await notifyLoopsSignup(USER);
    expect(await sendLoopsEvent({ eventName: "signup", email: USER.email, userId: USER.id })).toBe(false);
    expect(sent).toEqual([]);
  });

  it("counts a repeated idempotency key (409) as sent", async () => {
    vi.stubEnv("LOOPS_API_KEY", "loops_test_key");
    fakeLoops(409);
    expect(await sendLoopsEvent({ eventName: "signup", email: USER.email, userId: USER.id, idempotencyKey: "k" })).toBe(true);
  });

  it("logs a Loops failure and never throws", async () => {
    vi.stubEnv("LOOPS_API_KEY", "loops_test_key");
    fakeLoops(500);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(notifyLoopsSignup(USER)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith("Couldn't send the Loops sign-up event: Loops answered 500");
  });

  it("splits a Google name into first and last", () => {
    expect(splitName("Ada")).toEqual({ firstName: "Ada", lastName: "" });
    expect(splitName("  Ada  Lovelace ")).toEqual({ firstName: "Ada", lastName: "Lovelace" });
    expect(splitName("")).toEqual({ firstName: "", lastName: "" });
  });
});
