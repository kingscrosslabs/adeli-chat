import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db, schema } from "@/lib/db";
import { getUserSettings } from "@/lib/user-settings";

import { fakeAdeli, type Sent } from "../../../test/fake-adeli";
import { resetDatabase, seedAccount, seedUser } from "../../../test/db-helpers";

import { listInstagramAccounts, listMedia, startConnect } from "./instagram";
import { ensureUserProfile, profileName } from "./profile";

const now = new Date().toISOString();

function profile(id: string, externalId: string | null, name = "Someone") {
  return { id, name, externalId, metadata: null, isDefault: false, createdAt: now, updatedAt: now };
}

/** A fake Adeli organization: keeps the profiles it creates and answers a repeated idempotency key with the same profile. */
function profileAdeli(existing: ReturnType<typeof profile>[] = []) {
  const profiles = [...existing];
  const byKey = new Map<string, ReturnType<typeof profile>>();
  const adeli = fakeAdeli([
    (sent: Sent) => {
      if (sent.path === "/profiles" && sent.method === "GET") return { status: 200, body: { profiles } };
      if (sent.path === "/profiles" && sent.method === "POST") {
        const key = sent.idempotencyKey ?? crypto.randomUUID();
        let created = byKey.get(key);
        if (!created) {
          created = profile(`profile_${profiles.length + 1}`, String(sent.body?.externalId), String(sent.body?.name));
          byKey.set(key, created);
          profiles.push(created);
        }
        return { status: 201, body: created };
      }
      return undefined;
    },
  ]);
  return { ...adeli, profiles };
}

beforeEach(async () => {
  await resetDatabase();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("profileName", () => {
  it("is the user's Google name and email", () => {
    expect(profileName({ name: "Ada Lovelace", email: "ada@example.com" })).toBe("Ada Lovelace (ada@example.com)");
    expect(profileName({ name: "", email: "ada@example.com" })).toBe("ada@example.com");
    expect(profileName({ name: "ada@example.com", email: "ada@example.com" })).toBe("ada@example.com");
  });
});

describe("ensureUserProfile", () => {
  it("creates the user's profile once, named after them and tagged with their id", async () => {
    await db().insert(schema.authUser).values({ id: "user_1", name: "Ada Lovelace", email: "ada@example.com" });
    const adeli = profileAdeli([profile("default", null, "Default")]);

    expect(await ensureUserProfile("user_1")).toEqual({ id: "profile_2", name: "Ada Lovelace (ada@example.com)" });
    const create = adeli.sent.find((sent) => sent.method === "POST");
    expect(create?.body).toEqual({ name: "Ada Lovelace (ada@example.com)", externalId: "user_1", metadata: { app: "adeli-chat" } });
    expect(create?.idempotencyKey).toBe("adeli-chat-profile-user_1");
    expect(await getUserSettings("user_1")).toMatchObject({ adeliProfileId: "profile_2", adeliProfileName: "Ada Lovelace (ada@example.com)" });

    // Stored now: no more Adeli calls.
    const calls = adeli.sent.length;
    expect((await ensureUserProfile("user_1")).id).toBe("profile_2");
    expect(adeli.sent).toHaveLength(calls);
  });

  it("makes one profile when asked twice at once", async () => {
    await seedUser("user_1", { profileId: null });
    const adeli = profileAdeli();
    const [first, second] = await Promise.all([ensureUserProfile("user_1"), ensureUserProfile("user_1")]);
    expect(first.id).toBe(second.id);
    expect(adeli.profiles).toHaveLength(1);
  });

  it("finds the profile tagged with the user when the database lost it", async () => {
    await seedUser("user_1", { profileId: null });
    const adeli = profileAdeli([profile("profile_9", "user_1", "Ada")]);
    expect(await ensureUserProfile("user_1")).toEqual({ id: "profile_9", name: "Ada" });
    expect(adeli.sent.some((sent) => sent.method === "POST")).toBe(false);
  });

  it("gives each user their own profile", async () => {
    await seedUser("user_1", { profileId: null });
    await seedUser("user_2", { profileId: null });
    profileAdeli();
    const [one, two] = [await ensureUserProfile("user_1"), await ensureUserProfile("user_2")];
    expect(one.id).not.toBe(two.id);
  });
});

describe("one key, many users", () => {
  it("lists only the accounts on the user's own profile", async () => {
    await seedUser("user_1", { profileId: "profile_1" });
    const adeli = fakeAdeli([(sent) => {
      if (sent.path !== "/accounts") return undefined;
      // Even if Adeli ignored the filter, another profile's account stays out.
      return { status: 200, body: { accounts: [
        { accountId: "acc_1", profileId: "profile_1", platform: "instagram", providerId: "ig_1", displayName: "Birds", displayIdentifier: "birds", connectionStatus: "connected" },
        { accountId: "acc_2", profileId: "profile_2", platform: "instagram", providerId: "ig_2", displayName: "Cats", displayIdentifier: "cats", connectionStatus: "connected" },
      ] } };
    }]);
    const accounts = await listInstagramAccounts("user_1");
    expect(accounts.map((account) => account.accountId)).toEqual(["acc_1"]);
    expect(adeli.sent).toHaveLength(1);
    expect(adeli.sent[0].query.get("profileId")).toBe("profile_1");
  });

  it("starts Instagram Login on the user's own profile", async () => {
    await seedUser("user_1", { profileId: "profile_1" });
    const adeli = fakeAdeli([(sent) => (sent.path.endsWith("/connect") ? { status: 201, body: { id: "cs_1", profileId: "profile_1", platform: "instagram", status: "pending_authorization", authUrl: "https://instagram.com/oauth", accountId: null, error: null, expiresAt: now, createdAt: now, updatedAt: now } } : undefined)]);
    await startConnect("user_1", "http://localhost:3030/connect");
    expect(adeli.sent[0]).toMatchObject({ method: "POST", path: "/profiles/profile_1/connect", body: { platform: "instagram", authMethod: "instagram_login" } });
  });

  it("refuses posts of an account the user hasn't connected", async () => {
    await seedUser("user_1", { profileId: "profile_1" });
    await seedUser("user_2", { profileId: "profile_2" });
    await seedAccount("user_2");
    const adeli = fakeAdeli();
    await expect(listMedia("user_1", "acc_1", 0)).rejects.toMatchObject({ code: "not_found" });
    expect(adeli.sent).toHaveLength(0);
  });
});
