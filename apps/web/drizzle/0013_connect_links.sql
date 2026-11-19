CREATE TABLE "connect_links" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"code_hash" text NOT NULL,
	"method" text,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connect_links_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
ALTER TABLE "connect_links" ADD CONSTRAINT "connect_links_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "connect_links_user_idx" ON "connect_links" USING btree ("user_id");