import "server-only";

import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { getUserSettings, saveProfile } from "@/lib/user-settings";

import { adeliCall } from "./client";
import type { AdeliProfile } from "./types";

type ProfileOwner = { id: string; name: string; email: string };

/** What the user's profile is called in Adeli: their Google name and email. */
export function profileName(user: { name: string; email: string }) {
  const name = user.name.trim();
  const email = user.email.trim();
  if (!name || name === email) return email || "Adeli Chat user";
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

  const { data } = await adeliCall((client) => client.profiles.listProfiles());
  const tagged = data.profiles.find((profile) => profile.externalId === userId);
  const profile = tagged ?? await create(userId, owner ?? await loadOwner(userId));
  const result = { id: profile.id, name: profile.name };
  // At sign-up the user row may not be visible yet. The profile is in Adeli either way, and the next call finds it by `externalId`.
  await saveProfile(userId, result).catch((error: unknown) => console.warn(`Couldn't store the Adeli profile for ${userId}: ${error instanceof Error ? error.message : String(error)}`));
  return result;
}

async function create(userId: string, owner: ProfileOwner) {
  const { data } = await adeliCall((client) => client.profiles.createProfile(
    { body: { name: profileName(owner), externalId: userId, metadata: { app: "adeli-chat" } } },
    { idempotencyKey: `adeli-chat-profile-${userId}` },
  ));
  return data;
}

async function loadOwner(userId: string): Promise<ProfileOwner> {
  const [user] = await db().select({ id: schema.authUser.id, name: schema.authUser.name, email: schema.authUser.email })
    .from(schema.authUser).where(eq(schema.authUser.id, userId)).limit(1);
  return user ?? { id: userId, name: "", email: "" };
}
