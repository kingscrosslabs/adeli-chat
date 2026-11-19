import "server-only";

import { InstagramCapabilities, type Account, type ConnectionSession } from "@adeli/sdk";
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
      missingGrants: missingGrants(account.capabilities),
    }));
}

/**
 * The Instagram capabilities LedaChat asks for when connecting: read posts and
 * stories, read and reply to comments, read and send DMs. No publishing and no
 * Insights, so the consent screen doesn't ask for them.
 */
export const LEDACHAT_CAPABILITIES = InstagramCapabilities.engagement;

/** What every automation needs, in the words `/connect`, `get_workspace` and Go Live use. */
const NEEDED_CAPABILITIES = [
  ["comments.read", "read comments"],
  ["comments.manage", "reply to comments"],
  ["inbox.send", "send DMs"],
] as const;

export function missingGrants(capabilities: Record<string, boolean> | undefined): string[] {
  if (!capabilities) return [];
  return NEEDED_CAPABILITIES.filter(([capability]) => capabilities[capability] === false).map(([, words]) => words);
}

/** What the user's connected account is missing, or [] when Adeli can't say (never blocks on Adeli being down). */
export async function missingGrantsFor(userId: string, accountId: string): Promise<string[]> {
  try {
    const accounts = await listInstagramAccounts(userId);
    return accounts.find((account) => account.accountId === accountId)?.missingGrants ?? [];
  } catch {
    return [];
  }
}

export function missingGrantsMessage(missing: readonly string[]): string {
  return `Instagram didn't let LedaChat ${missing.join(", ").replace(/, ([^,]*)$/, " or $1")}. Connect Instagram again and allow it.`;
}

/** How the user logs in to connect Instagram: Instagram Login (the default) or Facebook Login. */
export type ConnectAuthMethod = "instagram_login" | "facebook_login";

export function isConnectAuthMethod(value: unknown): value is ConnectAuthMethod {
  return value === "instagram_login" || value === "facebook_login";
}

/**
 * Starts connecting Instagram on the user's own profile, with Instagram Login
 * or Facebook Login. Adeli keeps a profile's Instagram on one login and refuses
 * the other (`auth_method_conflict`), so picking the other login overrides it:
 * the profile's Instagram accounts on the old login are disconnected in Adeli
 * and the connect starts again. Reconnecting the same Instagram account keeps
 * its LedaChat automations (`connectAccount` matches it by Instagram user id).
 */
export async function startConnect(userId: string, redirectUrl: string, authMethod: ConnectAuthMethod = "instagram_login"): Promise<ConnectSession> {
  const profile = await ensureUserProfile(userId);
  const start = () => adeliCall((client) => client.profiles.startConnection({
    path: { profileId: profile.id },
    // Only what LedaChat uses, and no password prompt when the browser is already logged in to Instagram.
    body: { platform: "instagram", authMethod, redirectUrl, capabilities: [...LEDACHAT_CAPABILITIES], forceReauth: false },
  }));
  try {
    return toConnectSession((await start()).data);
  } catch (error) {
    if (!(error instanceof AdeliError) || error.code !== "auth_method_conflict") throw error;
  }
  await disconnectOtherLogins(profile.id, authMethod);
  return toConnectSession((await start()).data);
}

/** Disconnects, in Adeli, the Instagram accounts on this profile connected with a login other than `authMethod`. */
async function disconnectOtherLogins(profileId: string, authMethod: ConnectAuthMethod) {
  const result = await adeliCall((client) => client.accounts.listAccounts({ query: { platform: "instagram", profileId } }));
  const others = result.data.accounts.filter((account) =>
    account.profileId === profileId
    && (account.authMethod === "instagram_login" || account.authMethod === "facebook_login")
    && account.authMethod !== authMethod);
  for (const account of others) {
    await adeliCall((client) => client.accounts.disconnectAccount({ path: { profileId, accountId: account.accountId } }));
  }
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

export type PostComment = { id: string; parentId: string | null; authorId: string | null; authorHandle: string; body: string; isCreator: boolean; createdAt: string };

/**
 * The comments on one of the account's posts, replies included. Adeli reads
 * the first page while we wait and the rest in the background, so a busy post
 * can come back incomplete: this asks again, `attempts` times in all, until
 * Adeli says it has them all. `complete` says whether it did.
 */
export async function listPostComments(userId: string, accountId: string, postId: string, { attempts = 4, waitMs = 3000 }: { attempts?: number; waitMs?: number } = {}): Promise<{ comments: PostComment[]; complete: boolean }> {
  await requireOwnAccount(userId, accountId);
  for (let attempt = 1; ; attempt += 1) {
    const { data } = await adeliCall((client) => client.comments.listComments({ query: { platform: "instagram", accountId, postId } }));
    const comments = data.comments.map((comment) => ({
      id: comment.id,
      parentId: comment.parentId,
      authorId: comment.authorId ?? null,
      authorHandle: comment.authorHandle,
      body: comment.body,
      isCreator: comment.isCreator,
      createdAt: comment.createdAt,
    }));
    if (data.complete || attempt >= attempts) return { comments, complete: data.complete };
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

/** One of the account's posts by its media id (what automations store as `trigger.mediaId`), or null. */
export async function findMedia(userId: string, accountId: string, mediaId: string): Promise<AdeliMedia | null> {
  const posts = await listPosts(userId, accountId);
  return posts.map(toMedia).find((media) => media.id === mediaId) ?? null;
}
