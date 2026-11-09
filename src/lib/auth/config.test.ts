import { afterEach, describe, expect, it, vi } from "vitest";

import { authEnabled, signInRefusal } from "./config";

afterEach(() => vi.unstubAllEnvs());

describe("signInRefusal", () => {
  it("lets anyone with Google in when ALLOWED_EMAILS is empty", () => {
    vi.stubEnv("ALLOWED_EMAILS", "");
    expect(signInRefusal("owner@example.com")).toBeNull();
    expect(signInRefusal("someone@example.com")).toBeNull();
  });

  it("only lets ALLOWED_EMAILS in when it's set, ignoring case", () => {
    vi.stubEnv("ALLOWED_EMAILS", "Owner@Example.com, teammate@example.com");
    expect(signInRefusal("owner@example.com")).toBeNull();
    expect(signInRefusal("TEAMMATE@example.com")).toBeNull();
    expect(signInRefusal("stranger@example.com")).toMatch(/isn't allowed/);
  });
});

describe("authEnabled", () => {
  it("is off locally without Google, and always on when deployed", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    vi.stubEnv("VERCEL", "");
    expect(authEnabled()).toBe(false);
    vi.stubEnv("VERCEL", "1");
    expect(authEnabled()).toBe(true);
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("GOOGLE_CLIENT_ID", "id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");
    expect(authEnabled()).toBe(true);
  });
});
