DROP INDEX "app"."milk_subs_one_morning_per_customer";--> statement-breakpoint
DROP INDEX "app"."milk_subs_one_evening_per_customer";--> statement-breakpoint
ALTER TABLE "app"."milk_subscriptions" ADD COLUMN "product_key" varchar(120) GENERATED ALWAYS AS (lower(btrim(product_name))) STORED;--> statement-breakpoint
CREATE UNIQUE INDEX "milk_subs_one_morning_per_product" ON "app"."milk_subscriptions" USING btree ("customer_id","product_key") WHERE occupies_morning and effective_to is null and status in ('ACTIVE', 'PAUSED');--> statement-breakpoint
CREATE UNIQUE INDEX "milk_subs_one_evening_per_product" ON "app"."milk_subscriptions" USING btree ("customer_id","product_key") WHERE occupies_evening and effective_to is null and status in ('ACTIVE', 'PAUSED');