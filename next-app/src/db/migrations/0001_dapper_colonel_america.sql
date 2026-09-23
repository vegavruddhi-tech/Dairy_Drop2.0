ALTER TABLE "app"."milk_plans" ADD COLUMN "morning_start" time;--> statement-breakpoint
ALTER TABLE "app"."milk_plans" ADD COLUMN "morning_end" time;--> statement-breakpoint
ALTER TABLE "app"."milk_plans" ADD COLUMN "evening_start" time;--> statement-breakpoint
ALTER TABLE "app"."milk_plans" ADD COLUMN "evening_end" time;--> statement-breakpoint
ALTER TABLE "app"."milk_subscriptions" ADD COLUMN "morning_start" time;--> statement-breakpoint
ALTER TABLE "app"."milk_subscriptions" ADD COLUMN "morning_end" time;--> statement-breakpoint
ALTER TABLE "app"."milk_subscriptions" ADD COLUMN "evening_start" time;--> statement-breakpoint
ALTER TABLE "app"."milk_subscriptions" ADD COLUMN "evening_end" time;--> statement-breakpoint
ALTER TABLE "app"."milk_plans" ADD CONSTRAINT "milk_plans_windows_coherent" CHECK (("app"."milk_plans"."morning_start" is null) = ("app"."milk_plans"."morning_end" is null)
      and ("app"."milk_plans"."evening_start" is null) = ("app"."milk_plans"."evening_end" is null)
      and ("app"."milk_plans"."morning_start" is null or "app"."milk_plans"."morning_end" > "app"."milk_plans"."morning_start")
      and ("app"."milk_plans"."evening_start" is null or "app"."milk_plans"."evening_end" > "app"."milk_plans"."evening_start"));