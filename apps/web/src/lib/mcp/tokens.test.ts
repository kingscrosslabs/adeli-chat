import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { db, schema } from "@/lib/db";

import { resetDatabase, seedUser } from "../../../test/db-helpers";

import { createToken, ensureDefaultToken, listTokens, revealToken, revokeToken, userForToken } from "./tokens";

beforeEach(async () => {
  await resetDatabase();
  await seedUser("user_1");
  await seedUser("user_2");
});

describe("revealing and the Default token", () => {
  it("reveals a token to its owner only, and not once it's revoked", async () => {
    const { token, apiToken } = await createToken("user_1", { name: "Cursor", readOnly: false, expiry: "never" });
    expect(apiToken.revealable).toBe(true);
    expect(await revealToken("user_1", apiToken.id)).toBe(token);
    expect(await revealToken("user_2", apiToken.id)).toBeNull();
    await revokeToken("user_1", apiToken.id);
    expect(await revealToken("user_1", apiToken.id)).toBeNull();
  });

  it("keeps tokens from before reveal hidden", async () => {
    const { apiToken } = await createToken("user_1", { name: "Old", readOnly: false, expiry: "never" });
    await db().update(schema.apiTokens).set({ tokenEncrypted: null }).where(eq(schema.apiTokens.id, apiToken.id));
    expect(await revealToken("user_1", apiToken.id)).toBeNull();
    expect((await listTokens("user_1"))[0].revealable).toBe(false);
  });

  it("creates one Default token per user, and a new one after it's revoked", async () => {
    const first = await ensureDefaultToken("user_1");
    expect(first).toMatchObject({ name: "Default", isDefault: true, readOnly: false, expiresAt: null, revealable: true });
    expect((await ensureDefaultToken("user_1")).id).toBe(first.id);
    expect((await ensureDefaultToken("user_2")).id).not.toBe(first.id);
    await revokeToken("user_1", first.id);
    expect((await ensureDefaultToken("user_1")).id).not.toBe(first.id);
  });
});

describe("API tokens", () => {
  it("never stores the token in plain text, and finds the user by it", async () => {
    const { token, apiToken } = await createToken("user_1", { name: "Claude Code", readOnly: false, expiry: "never" });
    expect(token).toMatch(/^adc_[A-Za-z0-9_-]{40,}$/);
    expect(token.startsWith(apiToken.prefix)).toBe(true);

    const [row] = await db().select().from(schema.apiTokens).where(eq(schema.apiTokens.id, apiToken.id));
    expect(row.tokenHash).not.toContain(token);
    expect(JSON.stringify(row)).not.toContain(token);

    expect(await userForToken(token)).toEqual({ userId: "user_1", tokenId: apiToken.id, readOnly: false });
    expect(await userForToken(`${token}x`)).toBeNull();
    expect(await userForToken("rk_live_something")).toBeNull();
  });

  it("never expires by default, and expires when asked to", async () => {
    const forever = await createToken("user_1", { name: "forever", readOnly: false, expiry: "never" });
    expect(forever.apiToken.expiresAt).toBeNull();
    expect(await userForToken(forever.token, new Date("2099-01-01T00:00:00Z"))).not.toBeNull();

    const created = new Date("2026-11-09T00:00:00Z");
    const month = await createToken("user_1", { name: "month", readOnly: true, expiry: "30d" }, created);
    expect(month.apiToken.expiresAt).toBe("2026-12-09T00:00:00.000Z");
    expect(month.apiToken.daysLeft).toBe(30);
    expect(await userForToken(month.token, new Date("2026-12-08T23:59:00Z"))).toMatchObject({ readOnly: true });
    expect(await userForToken(month.token, new Date("2026-12-09T00:00:00Z"))).toBeNull();

    const listed = await listTokens("user_1", new Date("2026-12-10T00:00:00Z"));
    expect(listed.find((token) => token.name === "month")).toMatchObject({ expired: true, daysLeft: 0 });
    expect(listed.find((token) => token.name === "forever")).toMatchObject({ expired: false, daysLeft: null });
  });

  it("revokes only the owner's own tokens", async () => {
    const { token, apiToken } = await createToken("user_1", { name: "mine", readOnly: false, expiry: "never" });
    expect(await revokeToken("user_2", apiToken.id)).toBe(false);
    expect(await userForToken(token)).not.toBeNull();

    expect(await revokeToken("user_1", apiToken.id)).toBe(true);
    expect(await userForToken(token)).toBeNull();
    expect(await listTokens("user_1")).toEqual([]);
    expect(await revokeToken("user_1", apiToken.id)).toBe(false);
  });

  it("records when a token was last used", async () => {
    const { token, apiToken } = await createToken("user_1", { name: "mine", readOnly: false, expiry: "never" });
    expect((await listTokens("user_1"))[0].lastUsedAt).toBeNull();
    const used = new Date("2026-11-09T12:00:00Z");
    await userForToken(token, used);
    expect((await listTokens("user_1")).find((item) => item.id === apiToken.id)?.lastUsedAt).toBe(used.toISOString());
  });
});
