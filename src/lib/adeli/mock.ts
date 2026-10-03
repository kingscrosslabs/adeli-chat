import type { MediaType } from "@/lib/automations/schemas";

import { AdeliError, ADELI_KEY_PATTERN, type AdeliAccount, type AdeliClient, type AdeliMedia, type ConnectSession } from "./types";

/**
 * Fake Adeli client for `ADELI_MOCK=1` and for the frontend-only build.
 * Latency is simulated so loading states are visible while reviewing.
 */

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Self-contained SVG thumbnails, so the demo needs no network images. */
function thumbnail(from: string, to: string, emoji: string, label: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="600" viewBox="0 0 480 600">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
<rect width="480" height="600" fill="url(#g)"/>
<circle cx="240" cy="270" r="120" fill="#ffffff" fill-opacity="0.12"/>
<text x="240" y="275" font-size="140" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
<text x="40" y="70" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="700" fill="#ffffff" fill-opacity="0.9">${label}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function avatar(initials: string, color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="${color}"/><text x="48" y="50" font-family="Inter, Arial, sans-serif" font-size="36" font-weight="600" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const MOCK_PROFILE = { id: "00000000-0000-4000-8000-000000000001", name: "King's Cross Labs" };
export const MOCK_OTHER_PROFILE = { id: "00000000-0000-4000-8000-000000000002", name: "Client workspace" };

export const MOCK_ACCOUNTS: AdeliAccount[] = [
  { accountId: "acc_its_mikareyes", providerId: "17841400000000001", displayName: "Mika Reyes", displayIdentifier: "its.mikareyes", avatarUrl: avatar("MR", "#0A807A"), connectionStatus: "connected" },
  { accountId: "acc_kingscrosslabs", providerId: "17841400000000002", displayName: "King's Cross Labs", displayIdentifier: "kingscrosslabs", avatarUrl: avatar("KC", "#17312F"), connectionStatus: "connected" },
];

/** The account a brand new "Connect a new account" flow produces. */
export const MOCK_NEW_ACCOUNT: AdeliAccount = { accountId: "acc_tryadeli", providerId: "17841400000000003", displayName: "Adeli", displayIdentifier: "tryadeli", avatarUrl: avatar("A", "#075E5A"), connectionStatus: "connected" };

const POSTS: Array<[MediaType, string, string, string, string, string]> = [
  ["REEL", "#0A807A", "#14C8B8", "🤖", "5 AI tools", "Comment GUIDE and I'll send you the 5 AI tools that gave me back 10 hours a week."],
  ["CAROUSEL_ALBUM", "#17312F", "#0A807A", "📚", "Prompt pack", "Swipe for my 7 favourite Claude prompts for founders. Comment PROMPTS for the full pack."],
  ["IMAGE", "#F59E0B", "#EF4444", "⏰", "Time-rich", "Being time-rich beats being rich. Here's how we built a $1M business with 2 people."],
  ["REEL", "#6366F1", "#0EA5E9", "🎬", "Content system", "My whole content system in 60 seconds. Comment SYSTEM and I'll DM you the template."],
  ["VIDEO", "#0F766E", "#22C55E", "📈", "Growth recap", "What 20,000 followers taught me about teaching AI to non-technical people."],
  ["CAROUSEL_ALBUM", "#DB2777", "#F97316", "✨", "Workflow", "The exact workflow I use to batch a month of content in one afternoon."],
  ["REEL", "#1E293B", "#475569", "🧠", "Second brain", "How I built a second brain with Claude Code. Comment BRAIN for the setup guide."],
  ["IMAGE", "#0EA5E9", "#22D3EE", "🌏", "Origin story", "From the Philippines to Silicon Valley with no network. A thread on building one."],
  ["REEL", "#7C3AED", "#EC4899", "💌", "DM automation", "This is how I reply to 500 comments without lifting a finger. Comment AUTO."],
  ["CAROUSEL_ALBUM", "#065F46", "#0A807A", "🗂️", "Notion OS", "My Notion operating system for running a two-person company."],
  ["VIDEO", "#B45309", "#F59E0B", "🎙️", "Podcast clip", "Why we said no to VC the second time around."],
  ["IMAGE", "#334155", "#0F172A", "💡", "Hot take", "Most AI advice is for people who already know how to code. That's the problem."],
  ["REEL", "#0A807A", "#075E5A", "🛠️", "Build in public", "Week 12 of building in public. Here's what broke and what worked."],
  ["CAROUSEL_ALBUM", "#E11D48", "#FB7185", "📝", "Checklist", "The launch checklist we use for every product. Comment LAUNCH for the doc."],
  ["IMAGE", "#2563EB", "#60A5FA", "🎯", "Focus", "One question that saves me 5 hours a week: does this compound?"],
  ["REEL", "#15803D", "#4ADE80", "🚀", "Launch day", "We launched Adeli Chat. It's free and open source. Comment CHAT for the link."],
  ["VIDEO", "#9333EA", "#C084FC", "💃", "Dance break", "Founder life is 80% admin, 20% dancing in the kitchen."],
  ["CAROUSEL_ALBUM", "#0369A1", "#38BDF8", "📊", "Metrics", "The only 4 metrics we look at every Monday."],
];

const DAY = 24 * 60 * 60 * 1000;
const BASE = Date.parse("2026-10-02T15:00:00.000Z");

export const MOCK_MEDIA: AdeliMedia[] = POSTS.map(([mediaType, from, to, emoji, label, caption], index) => ({
  id: `1790000000000${String(index + 1).padStart(4, "0")}`,
  mediaType,
  caption,
  thumbnailUrl: thumbnail(from, to, emoji, label),
  permalink: `https://www.instagram.com/p/mock${index + 1}/`,
  publishedAt: new Date(BASE - index * 2.5 * DAY).toISOString(),
  likes: 4200 - index * 180,
  comments: 640 - index * 31,
}));

const PAGE_SIZE = 9;

/**
 * Demo behaviour, so every state can be reviewed:
 * - a key containing "bad" is rejected (401)
 * - a key containing "offline" simulates Adeli being unreachable
 * - a key containing "other" belongs to a different Adeli profile (FR-S.8)
 */
export function createMockAdeliClient(): AdeliClient {
  const sessions = new Map<string, { startedAt: number; authMethod: string }>();
  return {
    async validateKey(key) {
      await delay(900);
      if (key.includes("offline")) throw new AdeliError("network", "We couldn't reach Adeli. Try again in a minute.");
      if (!ADELI_KEY_PATTERN.test(key) || key.includes("bad")) throw new AdeliError("unauthorized", "Adeli didn't accept that key. Check you copied all of it, or create a new one.");
      if (key.toLowerCase().includes("other")) return MOCK_OTHER_PROFILE;
      return MOCK_PROFILE;
    },
    async listInstagramAccounts() {
      await delay(600);
      return MOCK_ACCOUNTS;
    },
    async startConnect(authMethod) {
      await delay(500);
      const id = `cs_${Math.random().toString(36).slice(2, 10)}`;
      sessions.set(id, { startedAt: Date.now(), authMethod });
      return { id, status: "pending_authorization", authUrl: "https://www.instagram.com/oauth/authorize?mock=1", accountId: null, error: null };
    },
    async getConnectSession(sessionId): Promise<ConnectSession> {
      await delay(250);
      const session = sessions.get(sessionId);
      if (!session) return { id: sessionId, status: "expired", authUrl: "", accountId: null, error: "This connection link expired. Start again." };
      const elapsed = Date.now() - session.startedAt;
      if (elapsed < 2500) return { id: sessionId, status: "pending_authorization", authUrl: "", accountId: null, error: null };
      if (elapsed < 4000) return { id: sessionId, status: "processing", authUrl: "", accountId: null, error: null };
      return { id: sessionId, status: "connected", authUrl: "", accountId: MOCK_NEW_ACCOUNT.accountId, error: null };
    },
    async listMedia(_accountId, page) {
      await delay(700);
      const start = page * PAGE_SIZE;
      return { media: MOCK_MEDIA.slice(start, start + PAGE_SIZE), hasMore: start + PAGE_SIZE < MOCK_MEDIA.length };
    },
  };
}

export const adeli = createMockAdeliClient();

/**
 * A well-formed demo key for the "Fill a demo key" helper on /setup.
 * Generated at runtime: Adeli keys share Stripe's `rk_live_` prefix, so a
 * hardcoded key-shaped string trips GitHub secret scanning.
 */
export function demoKey() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let body = "";
  for (let index = 0; index < 43; index += 1) body += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `rk_live_${body}`;
}
