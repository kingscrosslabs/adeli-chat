-- Each Google user gets their own Adeli connection and Instagram accounts.
-- Existing data moves to the install's owner: the first user to sign in.
-- A local install with data but no users gets the "local" user that
-- no-login mode uses.
INSERT INTO "auth_user" ("id", "name", "email", "email_verified")
SELECT 'local', 'Local', 'local@adeli-chat.invalid', false
WHERE NOT EXISTS (SELECT 1 FROM "auth_user")
  AND (EXISTS (SELECT 1 FROM "accounts") OR EXISTS (SELECT 1 FROM "app_settings" WHERE "adeli_api_key_encrypted" IS NOT NULL OR "adeli_webhook_id" IS NOT NULL));
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"adeli_api_key_encrypted" text,
	"adeli_base_url" text,
	"adeli_key_status" text DEFAULT 'unchecked' NOT NULL,
	"adeli_key_checked_at" timestamp with time zone,
	"adeli_profile_id" text,
	"adeli_profile_name" text,
	"adeli_webhook_id" text,
	"adeli_webhook_secret" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_adeli_account_id_unique";--> statement-breakpoint
ALTER TABLE "runs" DROP CONSTRAINT "runs_comment_id_unique";--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "user_id" text;--> statement-breakpoint
UPDATE "accounts" SET "user_id" = (SELECT "id" FROM "auth_user" ORDER BY "created_at", "id" LIMIT 1);--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
INSERT INTO "user_settings" ("user_id", "adeli_api_key_encrypted", "adeli_base_url", "adeli_key_status", "adeli_key_checked_at", "adeli_profile_id", "adeli_profile_name", "adeli_webhook_id", "adeli_webhook_secret", "updated_at")
SELECT (SELECT "id" FROM "auth_user" ORDER BY "created_at", "id" LIMIT 1), "adeli_api_key_encrypted", "adeli_base_url", "adeli_key_status", "adeli_key_checked_at", "adeli_profile_id", "adeli_profile_name", "adeli_webhook_id", "adeli_webhook_secret", "updated_at"
FROM "app_settings" WHERE "id" = 1 AND EXISTS (SELECT 1 FROM "auth_user");--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_adeli_account" UNIQUE("user_id","adeli_account_id");--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_automation_comment" UNIQUE("automation_id","comment_id");