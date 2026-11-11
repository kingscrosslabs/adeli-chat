import { afterEach, describe, expect, it, vi } from "vitest";

import { appUrl } from "./app-url";

afterEach(() => vi.unstubAllEnvs());

describe("appUrl", () => {
  it("prefers APP_URL", () => {
    vi.stubEnv("APP_URL", "https://chat.example.com/");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "adeli-chat.vercel.app");
    expect(appUrl()).toBe("https://chat.example.com");
  });

  it("uses the Vercel production domain in production, and the deployment URL on previews", () => {
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "adeli-chat.vercel.app");
    vi.stubEnv("VERCEL_URL", "adeli-chat-git-branch.vercel.app");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(appUrl()).toBe("https://adeli-chat.vercel.app");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(appUrl()).toBe("https://adeli-chat-git-branch.vercel.app");
  });

  it("defaults to the local dev server", () => {
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("VERCEL_URL", "");
    expect(appUrl()).toBe("http://localhost:3030");
  });
});
