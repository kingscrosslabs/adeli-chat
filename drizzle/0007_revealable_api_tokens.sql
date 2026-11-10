ALTER TABLE "api_tokens" ADD COLUMN "token_encrypted" text;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;