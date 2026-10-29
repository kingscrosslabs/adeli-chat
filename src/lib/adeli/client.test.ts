import { AdeliApiError, AuthenticationError, ConfigurationError, NetworkError, TimeoutError } from "@adeli/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { adeliCall, toAdeliError } from "./client";
import { getAdeliConfig, normalizeBaseURL } from "./key";
import { AdeliError } from "./types";

const markKeyStatus = vi.fn(async () => undefined);
vi.mock("@/lib/app-settings", () => ({ markKeyStatus: (...args: unknown[]) => markKeyStatus(...(args as [])) }));

const KEY = `rk_live_${"a".repeat(43)}`;

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("ADELI_API_KEY", KEY);
  vi.stubEnv("ADELI_BASE_URL", "http://localhost:3000");
  vi.stubEnv("ADELI_API_BASE_URL", "");
  markKeyStatus.mockClear();
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
  it("reads the key and base URL", () => {
    expect(getAdeliConfig()).toEqual({ baseURL: "http://localhost:3000", apiKey: KEY });
  });

  it("falls back to a legacy ADELI_API_BASE_URL, then production", () => {
    vi.stubEnv("ADELI_BASE_URL", "");
    vi.stubEnv("ADELI_API_BASE_URL", "http://localhost:3000/api/v1");
    expect(getAdeliConfig().baseURL).toBe("http://localhost:3000");
    vi.stubEnv("ADELI_API_BASE_URL", "");
    expect(getAdeliConfig().baseURL).toBe("https://app.tryadeli.com");
  });

  it("names the missing key", () => {
    vi.stubEnv("ADELI_API_KEY", "");
    expect(() => getAdeliConfig()).toThrow(expect.objectContaining({ code: "not_configured", message: expect.stringContaining("ADELI_API_KEY") }));
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
  it("marks the key invalid when Adeli answers 401", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { code: "unauthorized", message: "A valid Bearer API key is required" } }, { status: 401 })));
    const error = await adeliCall((client) => client.profiles.listProfiles()).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AdeliError);
    expect(error).toMatchObject({ code: "unauthorized" });
    expect((error as Error).message).not.toContain(KEY);
    expect(markKeyStatus).toHaveBeenCalledWith("invalid");
  });

  it("sends requests to the configured origin", async () => {
    const fetch = vi.fn(async () => Response.json({ profiles: [] }));
    vi.stubGlobal("fetch", fetch);
    await adeliCall((client) => client.profiles.listProfiles());
    expect(String((fetch.mock.calls[0] as unknown[])[0])).toBe("http://localhost:3000/api/v1/profiles");
    expect(markKeyStatus).not.toHaveBeenCalled();
  });

  it("reports a missing key without calling Adeli", async () => {
    vi.stubEnv("ADELI_API_KEY", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(adeliCall((client) => client.profiles.listProfiles())).rejects.toMatchObject({ code: "not_configured" });
    expect(fetch).not.toHaveBeenCalled();
  });
});
