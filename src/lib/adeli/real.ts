import "server-only";

import type { MediaType } from "@/lib/automations/schemas";

import { getAdeliApiKey } from "./key";
import { AdeliError, type AdeliAccount, type AdeliMedia, type AdeliProfile, type ConnectSession } from "./types";

const DEFAULT_BASE_URL = "https://app.tryadeli.com/api/v1";
const PAGE_SIZE = 9;

type ApiErrorBody = { error?: { code?: string; message?: string } };
type Collection<T> = { status: "complete" | "partial"; errors?: Array<{ message?: string }>; } & T;

type ApiAccount = Omit<AdeliAccount, "avatarUrl" | "profileName"> & {
  profileId: string | null;
  platform: string;
};

type ApiPost = {
  id: string;
  providerId: string;
  caption: string | null;
  media: Array<{ type: string; url: string | null; thumbnailUrl: string | null }>;
  permalink: string | null;
  engagement: { likes: number | null; comments: number | null };
  publishedAt: string | null;
};

type ApiConnectSession = Omit<ConnectSession, "authUrl" | "error"> & {
  authUrl?: string;
  error: { code: string } | null;
};

function toConnectSession(session: ApiConnectSession, profileId: string): ConnectSession {
  return {
    ...session,
    profileId,
    authUrl: session.authUrl ?? "",
    error: session.error?.code ?? null,
    isMock: false,
  };
}

function baseUrl() {
  return (process.env.ADELI_API_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/$/, "");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const key = getAdeliApiKey();
  if (!key) throw new AdeliError("unauthorized", "ADELI_API_KEY is not configured on this server.", 401);

  let response: Response;
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${key}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new AdeliError("network", "We couldn't reach Adeli. Try again in a minute.", 502);
  }

  const body = await response.json().catch(() => null) as T | ApiErrorBody | null;
  if (!response.ok) {
    const apiError = body && typeof body === "object" && "error" in body ? body.error : undefined;
    throw new AdeliError(apiError?.code || "network", apiError?.message || `Adeli returned HTTP ${response.status}.`, response.status);
  }
  return body as T;
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

export const realAdeli = {
  async listProfiles(): Promise<AdeliProfile[]> {
    const result = await request<{ profiles: AdeliProfile[] }>("/profiles");
    return result.profiles;
  },

  async listInstagramAccounts(): Promise<AdeliAccount[]> {
    const profiles = await this.listProfiles();
    const results = await Promise.all(profiles.map(async (profile) => {
      const query = new URLSearchParams({ platform: "instagram", profileId: profile.id });
      const result = await request<Collection<{ accounts: ApiAccount[] }>>(`/accounts?${query}`);
      return result.accounts.map((account) => ({
        ...account,
        profileId: account.profileId ?? profile.id,
        profileName: profile.name,
        avatarUrl: null,
      } satisfies AdeliAccount));
    }));
    return results.flat();
  },

  async startConnect(profileId: string, authMethod: "instagram_login" | "facebook_login", redirectUrl: string): Promise<ConnectSession> {
    const session = await request<ApiConnectSession>(`/profiles/${encodeURIComponent(profileId)}/connect`, {
      method: "POST",
      body: JSON.stringify({ platform: "instagram", authMethod, redirectUrl }),
    });
    return toConnectSession(session, profileId);
  },

  async getConnectSession(profileId: string, sessionId: string): Promise<ConnectSession> {
    const session = await request<ApiConnectSession>(`/profiles/${encodeURIComponent(profileId)}/connect/${encodeURIComponent(sessionId)}`);
    return toConnectSession(session, profileId);
  },

  async listMedia(accountId: string, page: number): Promise<{ media: AdeliMedia[]; hasMore: boolean }> {
    const query = new URLSearchParams({ platform: "instagram", accountId });
    const result = await request<Collection<{ posts: ApiPost[] }>>(`/posts?${query}`);
    const start = page * PAGE_SIZE;
    return {
      media: result.posts.slice(start, start + PAGE_SIZE).map(toMedia),
      hasMore: start + PAGE_SIZE < result.posts.length,
    };
  },
};
