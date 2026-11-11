"use client";

import { AdeliError, type AdeliAccount, type AdeliMedia, type ConnectSession } from "./types";

type ErrorBody = { error?: { code?: string; message?: string } };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, cache: "no-store" });
  } catch {
    throw new AdeliError("network", "We couldn't reach this LedaChat server.");
  }
  const body = await response.json().catch(() => null) as T | ErrorBody | null;
  if (!response.ok) {
    const apiError = body && typeof body === "object" && "error" in body ? body.error : undefined;
    throw new AdeliError(apiError?.code || "network", apiError?.message || "The Adeli request failed.", response.status);
  }
  return body as T;
}

export const adeli = {
  async listInstagramAccounts() {
    const result = await request<{ accounts: AdeliAccount[] }>("/api/adeli/accounts");
    return result.accounts;
  },

  startConnect() {
    return request<ConnectSession>("/api/adeli/connect/start", { method: "POST" });
  },

  getConnectSession(sessionId: string) {
    const query = new URLSearchParams({ sessionId });
    return request<ConnectSession>(`/api/adeli/connect/status?${query}`);
  },

  async listStories(accountId: string) {
    const query = new URLSearchParams({ accountId });
    const result = await request<{ stories: AdeliMedia[] }>(`/api/adeli/stories?${query}`);
    return result.stories;
  },

  listMedia(accountId: string, page: number) {
    const query = new URLSearchParams({ accountId, page: String(page) });
    return request<{ media: AdeliMedia[]; hasMore: boolean }>(`/api/adeli/media?${query}`);
  },
};
