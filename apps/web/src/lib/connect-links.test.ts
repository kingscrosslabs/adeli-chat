import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/connect/start/[code]/route";
import { auth } from "@/lib/auth/server";
import { db, schema } from "@/lib/db";

import { resetDatabase, seedUser } from "../../test/db-helpers";

import { createConnectLink, isConnectLinkUrl } from "./connect-links";

const ORIGIN = "http://localhost:3030";

function open(url: string) {
  const code = url.slice(`${ORIGIN}/connect/start/`.length);
  return GET(new Request(url, { headers: { "user-agent": "test-browser" } }), { params: Promise.resolve({ code }) });
}

function codeOf(url: string) {
  return url.split("/").at(-1) ?? "";
}

beforeEach(async () => {
  vi.stubEnv("APP_URL", ORIGIN);
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-for-connect-links-0123456789abcdef");
  vi.stubEnv("GOOGLE_CLIENT_ID", "google-client");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "google-secret");
  await resetDatabase();
  await seedUser("user_1");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("connect links", () => {
  it("signs the user in once and opens /connect from the agent", async () => {
    const { url } = await createConnectLink("user_1", "instagram");
    expect(url).toMatch(/^http:\/\/localhost:3030\/connect\/start\/[A-Za-z0-9_-]{43}$/);
    expect(isConnectLinkUrl(url)).toBe(true);

    const response = await open(url);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${ORIGIN}/connect?via=mcp&start=instagram`);
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");

    const session = await auth().api.getSession({ headers: new Headers({ cookie: cookie.split(";")[0] }) });
    expect(session?.user.id).toBe("user_1");

    const again = await open(url);
    expect(again.headers.get("location")).toBe(`${ORIGIN}/connect`);
    expect(again.headers.get("set-cookie")).toBeNull();
    const [row] = await db().select().from(schema.connectLinks);
    expect(row.usedAt).not.toBeNull();
  });

  it("only lets one of two simultaneous clicks in", async () => {
    const { url } = await createConnectLink("user_1", null);
    const [first, second] = await Promise.all([open(url), open(url)]);
    const signedIn = [first, second].filter((response) => response.headers.get("set-cookie"));
    expect(signedIn).toHaveLength(1);
    expect(signedIn[0].headers.get("location")).toBe(`${ORIGIN}/connect?via=mcp`);
  });

  it("refuses an expired link", async () => {
    const { url } = await createConnectLink("user_1", "facebook", new Date(Date.now() - 16 * 60_000));
    const response = await open(url);
    expect(response.headers.get("location")).toBe(`${ORIGIN}/connect`);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("refuses unknown codes", async () => {
    for (const code of ["nope", "", "a".repeat(43), "../sign-in", "x".repeat(500)]) {
      const response = await GET(new Request(`${ORIGIN}/connect/start/x`), { params: Promise.resolve({ code }) });
      expect(response.headers.get("location")).toBe(`${ORIGIN}/connect`);
      expect(response.headers.get("set-cookie")).toBeNull();
    }
  });

  it("refuses a link once its user is deleted", async () => {
    const { url } = await createConnectLink("user_1", "instagram");
    await db().delete(schema.authUser).where(eq(schema.authUser.id, "user_1"));
    expect(await db().select().from(schema.connectLinks)).toEqual([]);
    const response = await open(url);
    expect(response.headers.get("location")).toBe(`${ORIGIN}/connect`);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("refuses a user ALLOWED_EMAILS no longer lets in", async () => {
    vi.stubEnv("ALLOWED_EMAILS", "someone-else@example.com");
    const { url } = await createConnectLink("user_1", "instagram");
    const response = await open(url);
    expect(response.headers.get("location")).toBe(`${ORIGIN}/connect`);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("just opens /connect in local no-login mode", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    const { url } = await createConnectLink("user_1", "instagram");
    const response = await open(url);
    expect(response.headers.get("location")).toBe(`${ORIGIN}/connect?via=mcp&start=instagram`);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("only ever redirects to /connect and only trusts its own links", async () => {
    expect(isConnectLinkUrl("https://evil.example/connect/start/" + "a".repeat(43))).toBe(false);
    expect(isConnectLinkUrl(`${ORIGIN}/connect/start/../../sign-in`)).toBe(false);
    expect(isConnectLinkUrl(undefined)).toBe(false);
    for (const method of ["instagram", "facebook", null] as const) {
      const { url } = await createConnectLink("user_1", method);
      expect(codeOf(url)).not.toContain("user_1");
      const location = (await open(url)).headers.get("location") ?? "";
      expect(location.startsWith(`${ORIGIN}/connect?`)).toBe(true);
    }
  });
});
