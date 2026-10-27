CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"adeli_account_id" text NOT NULL,
	"adeli_profile_id" text NOT NULL,
	"ig_user_id" text,
	"handle" text NOT NULL,
	"display_name" text NOT NULL,
	"status" text DEFAULT 'connected' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_adeli_account_id_unique" UNIQUE("adeli_account_id")
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"adeli_key_status" text DEFAULT 'unchecked' NOT NULL,
	"adeli_key_checked_at" timestamp with time zone,
	"adeli_profile_id" text,
	"adeli_profile_name" text,
	"adeli_webhook_id" text,
	"adeli_webhook_secret" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automations" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'comment_to_dm' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"trigger" jsonb NOT NULL,
	"comment_reply" jsonb NOT NULL,
	"opening_dm" jsonb NOT NULL,
	"final_dm" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"live_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" text PRIMARY KEY NOT NULL,
	"automation_id" text NOT NULL,
	"ig_user_id" text NOT NULL,
	"ig_username" text,
	"comment_id" text NOT NULL,
	"comment_text" text,
	"state" text DEFAULT 'matched' NOT NULL,
	"comment_reply_state" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "runs_comment_id_unique" UNIQUE("comment_id"),
	CONSTRAINT "runs_automation_user" UNIQUE("automation_id","ig_user_id")
);
--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."automations"("id") ON DELETE cascade ON UPDATE no action;