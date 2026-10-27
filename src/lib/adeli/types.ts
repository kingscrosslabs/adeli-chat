import type { MediaType } from "@/lib/automations/schemas";

/**
 * View types for Adeli data, mapped from `@adeli/sdk` responses in
 * `instagram.ts`. Screens use these instead of raw SDK types.
 */

export type AdeliProfile = { id: string; name: string };

export type AdeliAccount = {
  accountId: string;
  profileId?: string;
  profileName?: string;
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
  profileId?: string;
  status: ConnectSessionStatus;
  authUrl: string;
  accountId: string | null;
  error: string | null;
};

export type AdeliErrorCode = "unauthorized" | "network" | "not_configured" | "permission_required" | "missing_permission" | "personal_account" | "cancelled" | (string & {});

export class AdeliError extends Error {
  constructor(public code: AdeliErrorCode, message: string, public status?: number) {
    super(message);
  }
}

export function adeliKeyPrefix(key: string) {
  return `${key.slice(0, 12)}…`;
}
