import { AdeliApiError, AuthenticationError, ConfigurationError, NetworkError, TimeoutError } from "@adeli/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { adeliCall, serverKeyRejected, toAdeliError } from "./client";
import { getAdeliConfig, normalizeBaseURL } from "./key";
import { AdeliError } from "./types";

const KEY = `rk_live_${"a".repeat(43)}`;

beforeEach(() => {
  vi.stubEnv("ADELI_API_KEY", KEY);
  vi.stubEnv("ADELI_API_BASE_URL", "http://localhost:3000");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("normalizeBaseURL", () => {
  it("keeps an origin", () => {
    expect(normalizeBaseURL("http://localhost:3000")).toBe("http://localhost:3000");
    expect(normalizeBaseURL("https://app.tryadeli.com/")).toBe("https://app.tryadeli.com");
  });

  it("strips the legacy /api/v1 path", () => {
    expect(normalizeBaseURL("http://localhost:3000/api/v1")).toBe("http://localhost:3000");
    expect(normalizeBaseURL("https://app.tryadeli.com/api/v1/")).toBe("https://app.tryadeli.com");
  });

  it("rejects other paths and non-http URLs", () => {
    expect(() => normalizeBaseURL("http://localhost:3000/foo")).toThrow(/must be an origin/);
    expect(() => normalizeBaseURL("ftp://localhost")).toThrow(/must be an origin/);
    expect(() => normalizeBaseURL("not a url")).toThrow(/must be an origin/);
  });
});

describe("getAdeliConfig", () => {
  it("reads the key and base URL from the environment", () => {
    expect(getAdeliConfig()).toEqual({ baseURL: "http://localhost:3000", apiKey: KEY });
  });

  it("accepts an /api/v1 base URL, and defaults to production", () => {
    vi.stubEnv("ADELI_API_BASE_URL", "http://localhost:3000/api/v1");
    expect(getAdeliConfig().baseURL).toBe("http://localhost:3000");
    vi.stubEnv("ADELI_API_BASE_URL", "");
    expect(getAdeliConfig().baseURL).toBe("https://app.tryadeli.com");
  });

  it("points to the README when there's no key", () => {
    vi.stubEnv("ADELI_API_KEY", "");
    expect(() => getAdeliConfig()).toThrow(/ADELI_API_KEY.*README/);
  });
});

describe("toAdeliError", () => {
  it("maps SDK errors to Adeli Chat codes", () => {
    expect(toAdeliError(new AuthenticationError("bad key", { status: 401, code: "unauthorized" })).code).toBe("unauthorized");
    expect(toAdeliError(new NetworkError("offline")).code).toBe("network");
    expect(toAdeliError(new TimeoutError("slow")).code).toBe("network");
    expect(toAdeliError(new ConfigurationError("baseURL must be an origin")).code).toBe("not_configured");
    const api = toAdeliError(new AdeliApiError("Missing permission", { status: 403, code: "permission_required" }));
    expect(api).toMatchObject({ code: "permission_required", status: 403 });
  });

  it("passes Adeli Chat errors through", () => {
    const error = new AdeliError("not_configured", "ADELI_API_KEY is not set.");
    expect(toAdeliError(error)).toBe(error);
  });

  it("never puts the key in a message", () => {
    const mapped = toAdeliError(new AdeliApiError(`Key ${KEY} is not allowed`, { status: 400, code: "invalid_request" }));
    expect(mapped.message).not.toContain(KEY);
  });
});

describe("adeliCall", () => {
  it("sends the server's key to the configured origin", async () => {
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      void input;
      void init;
      return Response.json({ profiles: [] });
    });
    vi.stubGlobal("fetch", fetch);
    await adeliCall((client) => client.profiles.listProfiles());
    const request = new Request(fetch.mock.calls[0][0], fetch.mock.calls[0][1]);
    expect(request.url).toBe("http://localhost:3000/api/v1/profiles");
    expect(request.headers.get("authorization")).toBe(`Bearer ${KEY}`);
  });

  it("flags a rejected key until Adeli accepts it again", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { code: "unauthorized", message: "A valid Bearer API key is required" } }, { status: 401 })));
    const error = await adeliCall((client) => client.profiles.listProfiles()).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: "unauthorized" });
    expect((error as Error).message).not.toContain(KEY);
    expect(serverKeyRejected()).toBe(true);

    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ profiles: [] })));
    await adeliCall((client) => client.profiles.listProfiles());
    expect(serverKeyRejected()).toBe(false);
  });

  it("reports a missing key without calling Adeli", async () => {
    vi.stubEnv("ADELI_API_KEY", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(adeliCall((client) => client.profiles.listProfiles())).rejects.toMatchObject({ code: "not_configured" });
    expect(fetch).not.toHaveBeenCalled();
  });
});
