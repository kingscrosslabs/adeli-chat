import type { MediaType } from "@/lib/automations/schemas";

/**
 * Types mirroring the Adeli public API v1 (PRD §5.11). The real client and the
 * mock both implement `AdeliClient`, so screens never know which one they use.
 */

export type AdeliProfile = { id: string; name: string };

export type AdeliAccount = {
  accountId: string;
  providerId: string;
  displayName: string;
  /** Instagram handle without the @. */
  displayIdentifier: string;
  avatarUrl: string | null;
  connectionStatus: "connected" | "expired" | "reconnect_required";
};

export type AdeliMedia = {
  id: string;
  mediaType: MediaType;
  caption: string;
  thumbnailUrl: string;
  permalink: string;
  publishedAt: string;
  likes: number;
  comments: number;
};

export type ConnectSessionStatus = "pending_authorization" | "processing" | "connected" | "failed" | "expired";

export type ConnectSession = {
  id: string;
  status: ConnectSessionStatus;
  authUrl: string;
  accountId: string | null;
  error: string | null;
};

export type AdeliErrorCode = "unauthorized" | "network" | "missing_permission" | "personal_account" | "cancelled";

export class AdeliError extends Error {
  constructor(public code: AdeliErrorCode, message: string) {
    super(message);
  }
}

export interface AdeliClient {
  /** `GET /profiles`. Validates the key and returns the profile it is bound to. */
  validateKey(key: string): Promise<AdeliProfile>;
  /** `GET /accounts?platform=instagram` */
  listInstagramAccounts(): Promise<AdeliAccount[]>;
  /** `POST /profiles/{id}/connect` in poll mode (no redirectUrl). */
  startConnect(authMethod: "instagram_login" | "facebook_login"): Promise<ConnectSession>;
  /** `GET /profiles/{id}/connect/{sessionId}` */
  getConnectSession(sessionId: string): Promise<ConnectSession>;
  /** `GET /posts?platform=instagram&accountId=` */
  listMedia(accountId: string, page: number): Promise<{ media: AdeliMedia[]; hasMore: boolean }>;
}

/** `rk_live_` followed by 43 URL-safe characters (Adeli authentication docs). */
export const ADELI_KEY_PATTERN = /^rk_live_[A-Za-z0-9_-]{43}$/;

export function adeliKeyPrefix(key: string) {
  return `${key.slice(0, 12)}…`;
}
