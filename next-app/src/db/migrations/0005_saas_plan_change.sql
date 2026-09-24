DROP INDEX "app"."saas_subs_one_live_per_milkman";--> statement-breakpoint
CREATE UNIQUE INDEX "saas_subs_one_pending_per_milkman" ON "app"."saas_subscriptions" USING btree ("milkman_id") WHERE status = 'PENDING_VERIFICATION';--> statement-breakpoint
CREATE UNIQUE INDEX "saas_subs_one_live_per_milkman" ON "app"."saas_subscriptions" USING btree ("milkman_id") WHERE status in ('TRIAL','ACTIVE');