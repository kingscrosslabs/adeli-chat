import "server-only";

import { randomUUID } from "node:crypto";
import { hostname, userInfo } from "node:os";

import { eq } from "drizzle-orm";

import { LOCAL_USER } from "@/lib/auth/config";
import { db, schema } from "@/lib/db";
import { getUserSettings, saveProfile } from "@/lib/user-settings";

import { adeliCall } from "./client";
import { AdeliError, type AdeliProfile } from "./types";

type ProfileOwner = { id: string; name: string; email: string };

/** What the user's profile is called in Adeli: their Google name and email. */
export function profileName(user: { name: string; email: string }) {
  const name = user.name.trim();
  const email = user.email.trim();
  if (!name || name === email) return email || "LedaChat user";
  return email ? `${name} (${email})` : name;
}

const pending = new Map<string, Promise<AdeliProfile>>();

/**
 * The user's own Adeli profile, created on first use. Every user has exactly
 * one, in the server key's organization, tagged with `externalId = userId`.
 *
 * Safe to call any time: it returns the stored profile, else finds the one
 * tagged with this user (say the database was reset), else creates it with
 * an idempotency key so two requests at once still make one profile.
 * `owner` saves a database read when the caller has the user (sign-up).
 *
 * The local no-login user is the exception: every local database has a user
 * with the same id, so it never looks a profile up in Adeli. Without one in
 * this database it creates a new profile, so two developers sharing a key
 * never share a profile (`createLocal`).
 */
export function ensureUserProfile(userId: string, owner?: ProfileOwner): Promise<AdeliProfile> {
  let running = pending.get(userId);
  if (!running) {
    running = findOrCreate(userId, owner).finally(() => pending.delete(userId));
    pending.set(userId, running);
  }
  return running;
}

async function findOrCreate(userId: string, owner?: ProfileOwner): Promise<AdeliProfile> {
  const settings = await getUserSettings(userId).catch(() => null);
  if (settings?.adeliProfileId) return { id: settings.adeliProfileId, name: settings.adeliProfileName ?? "" };

  const profile = userId === LOCAL_USER.id ? await createLocal() : await findOrCreateTagged(userId, owner);
  const result = { id: profile.id, name: profile.name };
  // At sign-up the user row may not be visible yet. The profile is in Adeli either way, and the next call finds it by `externalId`.
  await saveProfile(userId, result).catch((error: unknown) => console.warn(`Couldn't store the Adeli profile for ${userId}: ${error instanceof Error ? error.message : String(error)}`));
  return result;
}

async function findOrCreateTagged(userId: string, owner?: ProfileOwner) {
  const { data } = await adeliCall((client) => client.profiles.listProfiles());
  return data.profiles.find((profile) => profile.externalId === userId) ?? await create(userId, owner ?? await loadOwner(userId));
}

async function create(userId: string, owner: ProfileOwner) {
  const { data } = await adeliCall((client) => client.profiles.createProfile(
    { body: { name: profileName(owner), externalId: userId, metadata: { app: "adeli-chat" } } },
    { idempotencyKey: `adeli-chat-profile-${userId}` },
  ));
  return data;
}

/** What a new local profile is called: who is running it and where, say "Local: nick on Nicks-MacBook". Rename it in Settings. */
export function localProfileName() {
  let who = "";
  try {
    who = userInfo().username;
  } catch {
    // No user name on this machine: the host name alone still tells profiles apart.
  }
  const host = hostname().replace(/\.local$/, "");
  return `Local: ${[who, host].filter(Boolean).join(" on ") || "dev"}`;
}

/**
 * A new profile for this local database, tagged with a random id. Profile
 * names are unique in the organization, so a taken name (say the same
 * developer reset their database) gets a short suffix.
 */
async function createLocal() {
  const tag = randomUUID();
  const base = localProfileName();
  for (const name of [base, `${base} (${tag.slice(0, 4)})`]) {
    try {
      const { data } = await adeliCall((client) => client.profiles.createProfile(
        { body: { name, externalId: `adeli-chat-local-${tag}`, metadata: { app: "adeli-chat", local: true } } },
        { idempotencyKey: `adeli-chat-local-profile-${tag}-${name}` },
      ));
      return data;
    } catch (error) {
      if (!(error instanceof AdeliError && error.code === "profile_name_conflict") || name !== base) throw error;
    }
  }
  throw new AdeliError("profile_name_conflict", "A profile with this name already exists", 409);
}

/** Longest profile name Adeli accepts. */
export const PROFILE_NAME_MAX = 200;

/**
 * Renames the local user's own profile in Adeli. Only for local development,
 * where the profile is named after the machine. Keeps its tag and metadata,
 * since Adeli replaces the whole profile on update.
 */
export async function renameLocalProfile(userId: string, name: string): Promise<AdeliProfile> {
  if (userId !== LOCAL_USER.id) throw new AdeliError("forbidden", "Only the local profile can be renamed here.", 403);
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > PROFILE_NAME_MAX) throw new AdeliError("invalid_profile", `Use a name of 1 to ${PROFILE_NAME_MAX} characters.`, 400);
  const { id } = await ensureUserProfile(userId);
  const { data: current } = await adeliCall((client) => client.profiles.getProfile({ path: { profileId: id } }));
  try {
    const { data } = await adeliCall((client) => client.profiles.updateProfile({ path: { profileId: id }, body: { name: trimmed, externalId: current.externalId, metadata: current.metadata ?? undefined } }));
    const result = { id: data.id, name: data.name };
    await saveProfile(userId, result);
    return result;
  } catch (error) {
    if (error instanceof AdeliError && error.code === "profile_name_conflict") throw new AdeliError(error.code, "Another profile on this Adeli key already has that name.", 409);
    throw error;
  }
}

async function loadOwner(userId: string): Promise<ProfileOwner> {
  const [user] = await db().select({ id: schema.authUser.id, name: schema.authUser.name, email: schema.authUser.email })
    .from(schema.authUser).where(eq(schema.authUser.id, userId)).limit(1);
  return user ?? { id: userId, name: "", email: "" };
}
