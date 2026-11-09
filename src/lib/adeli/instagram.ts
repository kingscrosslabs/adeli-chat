import "server-only";

import type { Account, ConnectionSession } from "@adeli/sdk";

import type { MediaType } from "@/lib/automations/schemas";

import { adeliCall } from "./client";
import type { AdeliConfig } from "./key";
import type { AdeliAccount, AdeliMedia, AdeliProfile, ConnectSession, ConnectSessionStatus } from "./types";

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

async function listPosts(userId: string, accountId: string) {
  const result = await adeliCall(userId, (client) => client.posts.listPosts({ query: { platform: "instagram", accountId } }));
  return result.data.posts;
}

export async function listProfiles(userId: string, candidate?: AdeliConfig): Promise<AdeliProfile[]> {
  const result = await adeliCall(userId, (client) => client.profiles.listProfiles(), candidate);
  return result.data.profiles.map((profile) => ({ id: profile.id, name: profile.name }));
}

export async function listInstagramAccounts(userId: string): Promise<AdeliAccount[]> {
  const profiles = await listProfiles(userId);
  const results = await Promise.all(profiles.map(async (profile) => {
    const result = await adeliCall(userId, (client) => client.accounts.listAccounts({ query: { platform: "instagram", profileId: profile.id } }));
    return result.data.accounts.map((account): AdeliAccount => ({
      accountId: account.accountId,
      profileId: account.profileId ?? profile.id,
      profileName: profile.name,
      providerId: account.providerId ?? "",
      displayName: account.displayName ?? account.displayIdentifier ?? "Instagram account",
      displayIdentifier: account.displayIdentifier ?? "",
      avatarUrl: null,
      connectionStatus: connectionStatus(account.connectionStatus),
    }));
  }));
  return results.flat();
}

/** Instagram Login only: Facebook Login connections can't read comments for Comment to DM. */
export async function startConnect(userId: string, profileId: string, redirectUrl: string): Promise<ConnectSession> {
  const result = await adeliCall(userId, (client) => client.profiles.startConnection({
    path: { profileId },
    body: { platform: "instagram", authMethod: "instagram_login", redirectUrl },
  }));
  return toConnectSession(result.data);
}

export async function getConnectSession(userId: string, profileId: string, sessionId: string): Promise<ConnectSession> {
  const result = await adeliCall(userId, (client) => client.profiles.getConnection({ path: { profileId, connectionSessionId: sessionId } }));
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
