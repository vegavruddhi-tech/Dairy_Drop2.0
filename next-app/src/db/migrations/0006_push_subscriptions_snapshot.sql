-- The table was first created by hand (0006_push_subscriptions.sql, run in the
-- Supabase SQL editor) and never entered drizzle's snapshot. This brings the
-- snapshot in line; on databases that already have the table it does nothing.
CREATE TABLE IF NOT EXISTS "app"."push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "push_subscriptions_user_id_idx" ON "app"."push_subscriptions" USING btree ("user_id");