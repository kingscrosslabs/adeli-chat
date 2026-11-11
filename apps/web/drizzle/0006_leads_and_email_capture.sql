CREATE TABLE "leads" (
	"id" text PRIMARY KEY NOT NULL,
	"automation_id" text NOT NULL,
	"ig_user_id" text NOT NULL,
	"ig_username" text,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leads_automation_user" UNIQUE("automation_id","ig_user_id")
);
--> statement-breakpoint
ALTER TABLE "automations" ADD COLUMN "email_capture" jsonb;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "ig_sender_id" text;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "email_retried_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "email_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."automations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "runs_ig_sender_state" ON "runs" USING btree ("ig_sender_id","state");