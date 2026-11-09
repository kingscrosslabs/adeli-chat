import { afterEach, describe, expect, it, vi } from "vitest";

import { authEnabled, signInRefusal } from "./config";

afterEach(() => vi.unstubAllEnvs());

describe("signInRefusal", () => {
  it("lets the first Google account in, then nobody new", () => {
    vi.stubEnv("ALLOWED_EMAILS", "");
    expect(signInRefusal({ email: "owner@example.com", creatingUser: true, existingUsers: 0 })).toBeNull();
    expect(signInRefusal({ email: "owner@example.com", creatingUser: false, existingUsers: 0 })).toBeNull();
    expect(signInRefusal({ email: "someone@example.com", creatingUser: true, existingUsers: 1 })).toMatch(/already has an owner/);
  });

  it("only lets ALLOWED_EMAILS in when it's set, ignoring case", () => {
    vi.stubEnv("ALLOWED_EMAILS", "Owner@Example.com, teammate@example.com");
    expect(signInRefusal({ email: "owner@example.com", creatingUser: true, existingUsers: 3 })).toBeNull();
    expect(signInRefusal({ email: "TEAMMATE@example.com", creatingUser: false, existingUsers: 3 })).toBeNull();
    expect(signInRefusal({ email: "stranger@example.com", creatingUser: true, existingUsers: 0 })).toMatch(/isn't allowed/);
    expect(signInRefusal({ email: "stranger@example.com", creatingUser: false, existingUsers: 3 })).toMatch(/isn't allowed/);
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
