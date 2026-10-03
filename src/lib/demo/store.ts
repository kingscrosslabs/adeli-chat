"use client";

import { useSyncExternalStore } from "react";

import type { AdeliAccount } from "@/lib/adeli/types";
import { newDraftAutomation } from "@/lib/automations/defaults";
import type { Automation, AutomationContent, AutomationStatus } from "@/lib/automations/schemas";

import { sampleAutomations } from "./samples";

/**
 * Frontend-only stand-in for Postgres (PRD §6). Everything the backend will
 * own lives here for now, persisted to localStorage so a review session
 * survives reloads. When the backend lands, these actions become Server
 * Actions with the same names and the store goes away.
 */

export type AdeliKeyState = {
  prefix: string;
  profileId: string;
  profileName: string;
  status: "valid" | "invalid";
  /** `env` mirrors `ADELI_API_KEY` being set on the server (FR-S.5). */
  source: "ui" | "env";
  checkedAt: string;
};

export type DemoState = {
  version: 1;
  session: boolean;
  adeliKey: AdeliKeyState | null;
  account: AdeliAccount | null;
  automations: Automation[];
  /** Total automations ever created, for the `Comment to DM #n` default. */
  createdCount: number;
};

const STORAGE_KEY = "adeli-chat-demo-v1";

export const FRESH_STATE: DemoState = { version: 1, session: false, adeliKey: null, account: null, automations: [], createdCount: 0 };

let state: DemoState | null = null;
const listeners = new Set<() => void>();

function load(): DemoState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState;
      if (parsed?.version === 1) return parsed;
    }
  } catch {
    // Private mode or corrupted storage: fall back to a fresh install.
  }
  return FRESH_STATE;
}

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage is a convenience for reviewing, never required.
  }
}

function getState(): DemoState {
  if (!state) state = load();
  return state;
}

function setState(update: (current: DemoState) => DemoState) {
  state = update(getState());
  persist();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** `null` during server render and the first client render (not hydrated yet). */
export function useDemoState(): DemoState | null {
  return useSyncExternalStore(subscribe, getState, () => null);
}

export function readDemoState() {
  return getState();
}

/** Most recently updated first. Used by the sidebar and the list page. */
export function byRecency(automations: Automation[]) {
  return [...automations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function now() {
  return new Date().toISOString();
}

function pauseAllLive(automations: Automation[]) {
  return automations.map((automation) => automation.status === "live" ? { ...automation, status: "paused" as const, updatedAt: now() } : automation);
}

export const actions = {
  login() {
    setState((current) => ({ ...current, session: true }));
  },
  logout() {
    setState((current) => ({ ...current, session: false }));
  },
  saveKey(key: Omit<AdeliKeyState, "checkedAt" | "status">) {
    setState((current) => {
      const profileChanged = current.adeliKey && current.adeliKey.profileId !== key.profileId;
      return {
        ...current,
        adeliKey: { ...key, status: "valid", checkedAt: now() },
        // FR-S.8: a key for a different profile can't reach the old account.
        account: profileChanged ? null : current.account,
        automations: profileChanged ? pauseAllLive(current.automations) : current.automations,
      };
    });
  },
  markKeyChecked(status: "valid" | "invalid") {
    setState((current) => current.adeliKey ? { ...current, adeliKey: { ...current.adeliKey, status, checkedAt: now() } } : current);
  },
  removeKey() {
    setState((current) => ({ ...current, adeliKey: null, automations: pauseAllLive(current.automations) }));
  },
  connectAccount(account: AdeliAccount) {
    setState((current) => ({ ...current, account }));
  },
  disconnectAccount() {
    setState((current) => ({ ...current, account: null, automations: pauseAllLive(current.automations) }));
  },
  createAutomation(): string {
    const id = `auto_${Math.random().toString(36).slice(2, 10)}`;
    setState((current) => ({
      ...current,
      createdCount: current.createdCount + 1,
      automations: [newDraftAutomation(id, current.createdCount), ...current.automations],
    }));
    return id;
  },
  saveAutomation(id: string, content: AutomationContent) {
    setState((current) => ({
      ...current,
      automations: current.automations.map((automation) => automation.id === id ? { ...automation, ...content, updatedAt: now() } : automation),
    }));
  },
  setStatus(id: string, status: AutomationStatus) {
    setState((current) => ({
      ...current,
      automations: current.automations.map((automation) => automation.id === id
        ? { ...automation, status, updatedAt: now(), liveAt: status === "live" ? now() : automation.liveAt }
        : automation),
    }));
  },
  duplicateAutomation(id: string): string | null {
    const source = getState().automations.find((automation) => automation.id === id);
    if (!source) return null;
    const copyId = `auto_${Math.random().toString(36).slice(2, 10)}`;
    setState((current) => ({
      ...current,
      createdCount: current.createdCount + 1,
      automations: [{
        ...structuredClone(source),
        id: copyId,
        name: `${source.name} (copy)`.slice(0, 80),
        status: "draft",
        stats: { triggered: 0, commentReplies: 0, openingDms: 0, buttonTaps: 0, finalDms: 0 },
        createdAt: now(),
        updatedAt: now(),
        liveAt: null,
      }, ...current.automations],
    }));
    return copyId;
  },
  deleteAutomation(id: string) {
    setState((current) => ({ ...current, automations: current.automations.filter((automation) => automation.id !== id) }));
  },
  /** Demo controls only. */
  resetFresh() {
    setState(() => FRESH_STATE);
  },
  loadSamples(account: AdeliAccount, profile: { id: string; name: string }) {
    const automations = sampleAutomations();
    setState(() => ({
      version: 1,
      session: true,
      adeliKey: { prefix: "rk_live_DemoK…", profileId: profile.id, profileName: profile.name, status: "valid", source: "ui", checkedAt: now() },
      account,
      automations,
      createdCount: automations.length,
    }));
  },
  setKeySource(source: "ui" | "env") {
    setState((current) => current.adeliKey ? { ...current, adeliKey: { ...current.adeliKey, source } } : current);
  },
};
