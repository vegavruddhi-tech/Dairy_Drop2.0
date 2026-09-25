-- Migration: 0006_push_subscriptions
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New query)
--
-- Creates the app.push_subscriptions table that stores browser Web Push
-- endpoint registrations. One row per device; endpoint is unique so
-- upserts are safe.

CREATE TABLE IF NOT EXISTS "app"."push_subscriptions" (
  "id"          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"     text        NOT NULL,
  "endpoint"    text        NOT NULL UNIQUE,
  "p256dh"      text        NOT NULL,
  "auth"        text        NOT NULL,
  "user_agent"  text,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);

-- Index for the most common query: all endpoints for a user
CREATE INDEX IF NOT EXISTS "push_subscriptions_user_id_idx"
  ON "app"."push_subscriptions" ("user_id");

-- Auto-update updated_at on row changes (reuse the trigger function if it
-- already exists from an earlier migration, otherwise create it)
CREATE OR REPLACE FUNCTION app.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER push_subscriptions_updated_at
  BEFORE UPDATE ON "app"."push_subscriptions"
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- RLS: each user may only read/write their own subscriptions.
-- Service-role key (used by Next.js server actions) bypasses RLS entirely.
ALTER TABLE "app"."push_subscriptions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can manage their own push subscriptions"
  ON "app"."push_subscriptions"
  FOR ALL
  USING  (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);
