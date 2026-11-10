ALTER TABLE "user_settings" DROP COLUMN "adeli_api_key_encrypted";--> statement-breakpoint
ALTER TABLE "user_settings" DROP COLUMN "adeli_base_url";--> statement-breakpoint
ALTER TABLE "user_settings" DROP COLUMN "adeli_key_status";--> statement-breakpoint
ALTER TABLE "user_settings" DROP COLUMN "adeli_key_checked_at";--> statement-breakpoint
-- Each user now gets their own profile in the server key's organization. Old profiles and webhooks belonged to each user's own key, so forget them.
UPDATE "user_settings" SET "adeli_profile_id" = NULL, "adeli_profile_name" = NULL, "adeli_webhook_id" = NULL, "adeli_webhook_secret" = NULL;--> statement-breakpoint
-- Connecting the same Instagram account again reuses its row (matched by ig_user_id), so automations, runs and leads come back, paused.
UPDATE "automations" SET "status" = 'paused', "updated_at" = now() WHERE "status" = 'live';--> statement-breakpoint
UPDATE "accounts" SET "status" = 'disconnected', "updated_at" = now() WHERE "status" = 'connected';
