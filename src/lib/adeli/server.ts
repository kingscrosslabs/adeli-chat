import "server-only";

import { createMockAdeliClient, MOCK_PROFILE } from "./mock";
import { getAdeliApiKey } from "./key";
import { realAdeli } from "./real";
import type { AdeliAccount, AdeliMedia, AdeliProfile, ConnectSession } from "./types";

const mock = createMockAdeliClient();

export function usesAdeliMock() {
  return process.env.ADELI_MOCK === "1" || !getAdeliApiKey();
}

export async function listProfiles(): Promise<AdeliProfile[]> {
  return usesAdeliMock() ? [MOCK_PROFILE] : realAdeli.listProfiles();
}

export async function listInstagramAccounts(): Promise<AdeliAccount[]> {
  if (!usesAdeliMock()) return realAdeli.listInstagramAccounts();
  return (await mock.listInstagramAccounts()).map((account) => ({ ...account, profileId: MOCK_PROFILE.id, profileName: MOCK_PROFILE.name }));
}

export async function startConnect(profileId: string, authMethod: "instagram_login" | "facebook_login", redirectUrl: string): Promise<ConnectSession> {
  if (!usesAdeliMock()) return realAdeli.startConnect(profileId, authMethod, redirectUrl);
  return { ...await mock.startConnect(authMethod), profileId, isMock: true };
}

export async function getConnectSession(profileId: string, sessionId: string): Promise<ConnectSession> {
  if (!usesAdeliMock()) return realAdeli.getConnectSession(profileId, sessionId);
  return { ...await mock.getConnectSession(sessionId), profileId, isMock: true };
}

export async function listMedia(accountId: string, page: number): Promise<{ media: AdeliMedia[]; hasMore: boolean }> {
  return usesAdeliMock() ? mock.listMedia(accountId, page) : realAdeli.listMedia(accountId, page);
}
