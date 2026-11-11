import "server-only";

import type { Account, ConnectionSession } from "@adeli/sdk";
import { and, eq } from "drizzle-orm";

import type { MediaType } from "@adeli-chat/ui/automation/schemas";
import { db, schema } from "@/lib/db";

import { adeliCall } from "./client";
import { ensureUserProfile } from "./profile";
import { AdeliError, type AdeliAccount, type AdeliMedia, type ConnectSession, type ConnectSessionStatus } from "./types";

/*
 * Every user shares the server's key, which reaches every user's profile.
 * So each function here works only inside the signed-in user's own profile
 * (`ensureUserProfile`) and the Instagram accounts they connected, never a
 * profile or account id taken from the browser on trust.
 */

const PAGE_SIZE = 9;

type ApiPost = Awaited<ReturnType<typeof listPosts>>[number];

function connectionStatus(status: Account["connectionStatus"]): AdeliAccount["connectionStatus"] {
  return status === "connected" || status === "expired" ? status : "reconnect_required";
}

function sessionStatus(status: ConnectionSession["status"]): ConnectSessionStatus {
  return status === "pending_page_selection" ? "processing" : status;
}

function toConnectSession(session: ConnectionSession): ConnectSession {
  return {
    id: session.id,
    profileId: session.profileId,
    status: sessionStatus(session.status),
    authUrl: session.authUrl ?? "",
    accountId: session.accountId,
    error: session.error?.code ?? null,
  };
}

function mediaType(post: ApiPost): MediaType {
  if (post.media.length > 1) return "CAROUSEL_ALBUM";
  const value = post.media[0]?.type.toLowerCase() ?? "";
  if (value.includes("reel")) return "REEL";
  if (value.includes("video")) return "VIDEO";
  return "IMAGE";
}

function toMedia(post: ApiPost): AdeliMedia {
  const first = post.media[0];
  return {
    id: post.providerId || post.id,
    mediaType: mediaType(post),
    caption: post.caption ?? "",
    thumbnailUrl: first?.thumbnailUrl ?? first?.url ?? "",
    permalink: post.permalink ?? "",
    publishedAt: post.publishedAt ?? "",
    likes: post.engagement.likes ?? 0,
    comments: post.engagement.comments ?? 0,
  };
}

/** Refuses any Instagram account the user didn't connect themselves. */
async function requireOwnAccount(userId: string, accountId: string) {
  const [owned] = await db().select({ id: schema.accounts.id }).from(schema.accounts)
    .where(and(eq(schema.accounts.userId, userId), eq(schema.accounts.adeliAccountId, accountId))).limit(1);
  if (!owned) throw new AdeliError("not_found", "That Instagram account isn't connected to your LedaChat.", 404);
}

/** Posts of one of the user's own Instagram accounts. Any other account id is refused. */
async function listPosts(userId: string, accountId: string) {
  await requireOwnAccount(userId, accountId);
  const result = await adeliCall((client) => client.posts.listPosts({ query: { platform: "instagram", accountId } }));
  return result.data.posts;
}

/** The Instagram accounts connected to the user's own profile. */
export async function listInstagramAccounts(userId: string): Promise<AdeliAccount[]> {
  const profile = await ensureUserProfile(userId);
  const result = await adeliCall((client) => client.accounts.listAccounts({ query: { platform: "instagram", profileId: profile.id } }));
  return result.data.accounts
    // The query is scoped already. This keeps another profile's account out even if Adeli ignored the filter.
    .filter((account) => !account.profileId || account.profileId === profile.id)
    .map((account): AdeliAccount => ({
      accountId: account.accountId,
      profileId: profile.id,
      profileName: profile.name,
      providerId: account.providerId ?? "",
      displayName: account.displayName ?? account.displayIdentifier ?? "Instagram account",
      displayIdentifier: account.displayIdentifier ?? "",
      avatarUrl: null,
      connectionStatus: connectionStatus(account.connectionStatus),
    }));
}

/** Starts Instagram Login on the user's own profile. Instagram Login only: Facebook Login connections can't read comments for Comment to DM. */
export async function startConnect(userId: string, redirectUrl: string): Promise<ConnectSession> {
  const profile = await ensureUserProfile(userId);
  const result = await adeliCall((client) => client.profiles.startConnection({
    path: { profileId: profile.id },
    body: { platform: "instagram", authMethod: "instagram_login", redirectUrl },
  }));
  return toConnectSession(result.data);
}

/** A connection session on the user's own profile. */
export async function getConnectSession(userId: string, sessionId: string): Promise<ConnectSession> {
  const profile = await ensureUserProfile(userId);
  const result = await adeliCall((client) => client.profiles.getConnection({ path: { profileId: profile.id, connectionSessionId: sessionId } }));
  return toConnectSession(result.data);
}

export async function listMedia(userId: string, accountId: string, page: number): Promise<{ media: AdeliMedia[]; hasMore: boolean }> {
  const posts = await listPosts(userId, accountId);
  const start = page * PAGE_SIZE;
  return {
    media: posts.slice(start, start + PAGE_SIZE).map(toMedia),
    hasMore: start + PAGE_SIZE < posts.length,
  };
}

/** The account's live stories, newest first, as media the story picker can show. Stories have no caption or counts. */
export async function listStories(userId: string, accountId: string): Promise<AdeliMedia[]> {
  await requireOwnAccount(userId, accountId);
  const result = await adeliCall((client) => client.posts.listInstagramStories({ query: { accountId } }));
  return result.data.stories.map((story) => {
    const video = story.mediaType?.toUpperCase() === "VIDEO";
    return {
      id: story.id,
      mediaType: video ? "VIDEO" : "IMAGE",
      caption: "",
      // A video story's media url is the video (or null with licensed music), so its cover comes first.
      thumbnailUrl: story.thumbnailUrl ?? (video ? null : story.mediaUrl) ?? "",
      permalink: story.permalink ?? "",
      publishedAt: story.timestamp,
      likes: 0,
      comments: 0,
    } satisfies AdeliMedia;
  });
}

/** One of the account's posts by its media id (what automations store as `trigger.mediaId`), or null. */
export async function findMedia(userId: string, accountId: string, mediaId: string): Promise<AdeliMedia | null> {
  const posts = await listPosts(userId, accountId);
  return posts.map(toMedia).find((media) => media.id === mediaId) ?? null;
}
