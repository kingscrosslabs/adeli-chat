import { boolean, integer, jsonb, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

import type { CommentReply, FinalDm, OpeningDm, Trigger } from "@/lib/automations/schemas";

/**
 * Postgres tables (PRD §6, simplified). The JSON columns use the Zod shapes in
 * `src/lib/automations/schemas.ts`, so the editor and the runtime agree.
 */

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/**
 * Single row, `id = 1`. The Adeli key entered in Settings is stored encrypted
 * (`src/lib/secret-box.ts`); `ADELI_API_KEY` is the fallback when it's empty.
 */
export const appSettings = pgTable("app_settings", {
  id: integer("id").primaryKey().default(1),
  adeliApiKeyEncrypted: text("adeli_api_key_encrypted"),
  adeliBaseUrl: text("adeli_base_url"),
  adeliKeyStatus: text("adeli_key_status", { enum: ["valid", "invalid", "unchecked"] }).notNull().default("unchecked"),
  adeliKeyCheckedAt: timestamp("adeli_key_checked_at", { withTimezone: true }),
  adeliProfileId: text("adeli_profile_id"),
  adeliProfileName: text("adeli_profile_name"),
  adeliWebhookId: text("adeli_webhook_id"),
  adeliWebhookSecret: text("adeli_webhook_secret"),
  updatedAt: timestamps.updatedAt,
});

/** Instagram accounts chosen on `/connect`. At most one is `connected`. */
export const accounts = pgTable("accounts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  adeliAccountId: text("adeli_account_id").notNull().unique(),
  adeliProfileId: text("adeli_profile_id").notNull(),
  igUserId: text("ig_user_id"),
  handle: text("handle").notNull(),
  displayName: text("display_name").notNull(),
  status: text("status", { enum: ["connected", "disconnected"] }).notNull().default("connected"),
  ...timestamps,
});

export const automations = pgTable("automations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  accountId: text("account_id").notNull().references(() => accounts.id),
  name: text("name").notNull(),
  type: text("type", { enum: ["comment_to_dm"] }).notNull().default("comment_to_dm"),
  status: text("status", { enum: ["draft", "live", "paused"] }).notNull().default("draft"),
  trigger: jsonb("trigger").$type<Trigger>().notNull(),
  commentReply: jsonb("comment_reply").$type<CommentReply>().notNull(),
  openingDm: jsonb("opening_dm").$type<OpeningDm>().notNull(),
  finalDm: jsonb("final_dm").$type<FinalDm>().notNull(),
  ...timestamps,
  liveAt: timestamp("live_at", { withTimezone: true }),
});

/**
 * One Comment to DM conversation. `ig_user_id` is Adeli's `Comment.authorId`.
 * The unique keys make webhook delivery idempotent: a repeat commenter (D3)
 * or a redelivered comment fails the insert.
 */
export const runs = pgTable("runs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  automationId: text("automation_id").notNull().references(() => automations.id, { onDelete: "cascade" }),
  igUserId: text("ig_user_id").notNull(),
  igUsername: text("ig_username"),
  commentId: text("comment_id").notNull().unique(),
  commentText: text("comment_text"),
  /** `final_sending` is the postback claim: only one delivery moves a run out of `opening_sent`. */
  state: text("state", { enum: ["matched", "opening_sent", "tapped", "final_sending", "final_sent", "failed"] }).notNull().default("matched"),
  commentReplyState: text("comment_reply_state", { enum: ["skipped", "sent", "failed"] }),
  error: text("error"),
  openingSentAt: timestamp("opening_sent_at", { withTimezone: true }),
  tappedAt: timestamp("tapped_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [unique("runs_automation_user").on(table.automationId, table.igUserId)]);

/**
 * Better Auth tables (Google sign-in). Prefixed so `auth_account` doesn't
 * clash with the Instagram `accounts` table. See `src/lib/auth/server.ts`.
 */
export const authUser = pgTable("auth_user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  ...timestamps,
});

export const authSession = pgTable("auth_session", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  ...timestamps,
});

export const authAccount = pgTable("auth_account", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  ...timestamps,
});

export const authVerification = pgTable("auth_verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ...timestamps,
});
