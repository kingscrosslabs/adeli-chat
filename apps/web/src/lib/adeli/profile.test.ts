import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db, schema } from "@/lib/db";
import { getUserSettings } from "@/lib/user-settings";

import { fakeAdeli, type Sent } from "../../../test/fake-adeli";
import { resetDatabase, seedAccount, seedUser } from "../../../test/db-helpers";

import { listInstagramAccounts, listMedia, startConnect } from "./instagram";
import { ensureUserProfile, localProfileName, profileName, renameLocalProfile } from "./profile";

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
        if (profiles.some((existing) => existing.name === sent.body?.name)) return { status: 409, body: { error: { code: "profile_name_conflict", message: "A profile with this name already exists" } } };
        const key = sent.idempotencyKey ?? crypto.randomUUID();
        let created = byKey.get(key);
        if (!created) {
          created = profile(`profile_${profiles.length + 1}`, String(sent.body?.externalId), String(sent.body?.name));
          byKey.set(key, created);
          profiles.push(created);
        }
        return { status: 201, body: created };
      }
      const one = profiles.find((existing) => sent.path === `/profiles/${existing.id}`);
      if (one && sent.method === "GET") return { status: 200, body: one };
      if (one && sent.method === "PUT") {
        if (profiles.some((existing) => existing.id !== one.id && existing.name === sent.body?.name)) return { status: 409, body: { error: { code: "profile_name_conflict", message: "A profile with this name already exists" } } };
        Object.assign(one, { name: sent.body?.name, externalId: sent.body?.externalId ?? null, metadata: sent.body?.metadata ?? null });
        return { status: 200, body: one };
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

describe("the local profile", () => {
  it("creates a new profile for this database instead of looking one up in Adeli", async () => {
    await seedUser("local", { profileId: null });
    // Another developer's local database already made a profile on the same key.
    const adeli = profileAdeli([profile("theirs", "local", "Local")]);

    const mine = await ensureUserProfile("local");
    expect(mine.id).not.toBe("theirs");
    expect(mine.name).toBe(localProfileName());
    expect(adeli.sent.some((sent) => sent.method === "GET" && sent.path === "/profiles")).toBe(false);
    const create = adeli.sent.find((sent) => sent.method === "POST");
    expect(create?.body).toMatchObject({ metadata: { app: "adeli-chat", local: true } });
    expect(String(create?.body?.externalId)).toMatch(/^adeli-chat-local-/);
    expect(await getUserSettings("local")).toMatchObject({ adeliProfileId: mine.id });
  });

  it("gets a suffix when its name is taken", async () => {
    await seedUser("local", { profileId: null });
    profileAdeli([profile("old", "adeli-chat-local-old", localProfileName())]);
    const mine = await ensureUserProfile("local");
    expect(mine.id).not.toBe("old");
    expect(mine.name.slice(localProfileName().length)).toMatch(/^ \([0-9a-f]{4}\)$/);
  });

  it("renames the local profile and keeps its tag", async () => {
    await seedUser("local", { profileId: "profile_1" });
    const adeli = profileAdeli([profile("profile_1", "adeli-chat-local-abc", "Local: someone")]);
    expect(await renameLocalProfile("local", "  Nick's laptop ")).toEqual({ id: "profile_1", name: "Nick's laptop" });
    expect(adeli.sent.find((sent) => sent.method === "PUT")?.body).toMatchObject({ name: "Nick's laptop", externalId: "adeli-chat-local-abc" });
    expect(await getUserSettings("local")).toMatchObject({ adeliProfileName: "Nick's laptop" });
  });

  it("says when the name belongs to another profile", async () => {
    await seedUser("local", { profileId: "profile_1" });
    profileAdeli([profile("profile_1", "adeli-chat-local-abc", "Mine"), profile("profile_2", "adeli-chat-local-def", "Theirs")]);
    await expect(renameLocalProfile("local", "Theirs")).rejects.toMatchObject({ code: "profile_name_conflict" });
  });

  it("only renames the local user's profile", async () => {
    await seedUser("user_1", { profileId: "profile_1" });
    profileAdeli([profile("profile_1", "user_1", "Ada")]);
    await expect(renameLocalProfile("user_1", "New")).rejects.toMatchObject({ code: "forbidden" });
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

  it("starts Facebook Login on the user's own profile when asked", async () => {
    await seedUser("user_1", { profileId: "profile_1" });
    const adeli = fakeAdeli([(sent) => (sent.path.endsWith("/connect") ? { status: 201, body: { id: "cs_1", profileId: "profile_1", platform: "instagram", status: "pending_authorization", authUrl: "https://facebook.com/dialog/oauth", accountId: null, error: null, expiresAt: now, createdAt: now, updatedAt: now } } : undefined)]);
    await startConnect("user_1", "http://localhost:3030/connect", "facebook_login");
    expect(adeli.sent[0]).toMatchObject({ method: "POST", path: "/profiles/profile_1/connect", body: { platform: "instagram", authMethod: "facebook_login" } });
  });

  it("overrides the other login: disconnects the profile's accounts on it, then starts again", async () => {
    await seedUser("user_1", { profileId: "profile_1" });
    const session = { id: "cs_1", profileId: "profile_1", platform: "instagram", status: "pending_authorization", authUrl: "https://facebook.com/dialog/oauth", accountId: null, error: null, expiresAt: now, createdAt: now, updatedAt: now };
    const account = (accountId: string, profileId: string, authMethod: string) => ({ accountId, profileId, platform: "instagram", authMethod, providerId: "ig_1", displayName: "Birds", displayIdentifier: "birds", connectionStatus: "connected" });
    let disconnected = false;
    const adeli = fakeAdeli([(sent) => {
      if (sent.path.endsWith("/connect") && sent.method === "POST") {
        return disconnected ? { status: 201, body: session } : { status: 409, body: { error: { code: "auth_method_conflict", message: "This profile's Instagram is connected with Instagram Login" } } };
      }
      if (sent.path === "/accounts" && sent.method === "GET") return { status: 200, body: { accounts: [account("acc_ig", "profile_1", "instagram_login"), account("acc_fb", "profile_1", "facebook_login"), account("acc_other", "profile_2", "instagram_login")] } };
      if (sent.method === "DELETE") {
        disconnected = true;
        return { status: 200, body: { id: "acc_ig", disconnected: true } };
      }
      return undefined;
    }]);
    await expect(startConnect("user_1", "http://localhost:3030/connect", "facebook_login")).resolves.toMatchObject({ id: "cs_1" });
    const deletes = adeli.sent.filter((sent) => sent.method === "DELETE");
    expect(deletes.map((sent) => sent.path)).toEqual(["/profiles/profile_1/accounts/acc_ig"]);
    expect(adeli.sent.filter((sent) => sent.path.endsWith("/connect"))).toHaveLength(2);
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
