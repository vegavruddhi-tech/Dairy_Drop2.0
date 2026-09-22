CREATE SCHEMA "app";
--> statement-breakpoint
CREATE TYPE "app"."approval_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "app"."audit_action" AS ENUM('MILKMAN_VERIFIED', 'MILKMAN_SUSPENDED', 'SAAS_PAYMENT_VERIFIED', 'SAAS_PAYMENT_REJECTED', 'SAAS_PLAN_CREATED', 'SAAS_PLAN_UPDATED', 'SAAS_PLAN_DELETED', 'PLATFORM_SETTINGS_UPDATED', 'CUSTOMER_APPROVED', 'CUSTOMER_REJECTED', 'ROLE_GRANTED');--> statement-breakpoint
CREATE TYPE "app"."bill_status" AS ENUM('OPEN', 'UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE');--> statement-breakpoint
CREATE TYPE "app"."delivery_slot" AS ENUM('MORNING', 'EVENING', 'BOTH');--> statement-breakpoint
CREATE TYPE "app"."delivery_status" AS ENUM('PENDING', 'DELIVERED', 'UNDELIVERED', 'SKIPPED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "app"."frequency" AS ENUM('DAILY', 'ALTERNATE_DAYS', 'WEEKLY', 'MONTHLY');--> statement-breakpoint
CREATE TYPE "app"."milk_subscription_status" AS ENUM('ACTIVE', 'PAUSED', 'CANCELLED', 'SUPERSEDED');--> statement-breakpoint
CREATE TYPE "app"."notification_type" AS ENUM('DELIVERY', 'ORDER', 'PAYMENT', 'APPROVAL', 'PLAN_CHANGE', 'QUANTITY_CHANGE', 'SUBSCRIPTION', 'BROADCAST', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "app"."payment_method" AS ENUM('UPI', 'CASH', 'BANK_TRANSFER');--> statement-breakpoint
CREATE TYPE "app"."payment_status" AS ENUM('SUBMITTED', 'VERIFIED', 'REJECTED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "app"."purchase_status" AS ENUM('PENDING', 'ACCEPTED', 'DELIVERED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "app"."request_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');--> statement-breakpoint
CREATE TYPE "app"."role" AS ENUM('CUSTOMER', 'MILKMAN', 'ADMIN');--> statement-breakpoint
CREATE TYPE "app"."saas_status" AS ENUM('TRIAL', 'PENDING_VERIFICATION', 'ACTIVE', 'EXPIRED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "app"."skip_reason" AS ENUM('CUSTOMER_REQUEST', 'MILKMAN_DAY_OFF', 'CUSTOMER_ABSENT', 'OUT_OF_STOCK', 'OTHER');--> statement-breakpoint
CREATE TABLE "app"."admin_allowlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"note" text,
	"granted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"actor_email" varchar(255),
	"action" "app"."audit_action" NOT NULL,
	"subject_type" varchar(60),
	"subject_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"ip_address" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."milkman_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"milkman_id" uuid NOT NULL,
	"business_name" varchar(200) NOT NULL,
	"business_address" text,
	"logo_url" text,
	"upi_id" varchar(120),
	"qr_code_url" text,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"suspended_at" timestamp with time zone,
	"suspension_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(160) NOT NULL,
	"phone" varchar(20),
	"avatar_url" text,
	"clerk_id" varchar(64),
	"role" "app"."role" DEFAULT 'CUSTOMER' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"milkman_id" uuid,
	"approval_status" "app"."approval_status",
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"rejection_reason" text,
	"delivery_area" varchar(120),
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"recipient_name" varchar(160),
	"recipient_phone" varchar(20),
	"line1" text NOT NULL,
	"line2" text,
	"area" varchar(120) NOT NULL,
	"city" varchar(120) NOT NULL,
	"state" varchar(120) NOT NULL,
	"pincode" varchar(10) NOT NULL,
	"landmark" varchar(200),
	"delivery_instructions" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."service_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"milkman_id" uuid NOT NULL,
	"area_name" varchar(120) NOT NULL,
	"pincode" varchar(10) NOT NULL,
	"city" varchar(120) NOT NULL,
	"state" varchar(120) NOT NULL,
	"route_sequence" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."platform_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"upi_id" varchar(120),
	"qr_code_url" text,
	"bank_details" text,
	"support_phone" varchar(20),
	"support_email" varchar(255),
	"trial_duration_days" integer DEFAULT 7 NOT NULL,
	"trial_customer_limit" integer DEFAULT 5 NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."saas_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"milkman_id" uuid NOT NULL,
	"subscription_id" uuid,
	"amount" numeric(12, 2) NOT NULL,
	"reference" varchar(120),
	"status" "app"."payment_status" DEFAULT 'SUBMITTED' NOT NULL,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."saas_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"monthly_price" numeric(12, 2) NOT NULL,
	"max_customers" integer NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"duration_days" integer DEFAULT 30 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."saas_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"milkman_id" uuid NOT NULL,
	"plan_id" uuid,
	"status" "app"."saas_status" NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"customer_limit" integer NOT NULL,
	"price_paid" numeric(12, 2) DEFAULT '0' NOT NULL,
	"payment_reference" varchar(120),
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."milk_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"milkman_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"product_name" varchar(120) NOT NULL,
	"quantity" numeric(10, 3) NOT NULL,
	"unit" varchar(16) DEFAULT 'L' NOT NULL,
	"frequency" "app"."frequency" DEFAULT 'DAILY' NOT NULL,
	"slot" "app"."delivery_slot" DEFAULT 'MORNING' NOT NULL,
	"price_per_delivery" numeric(12, 2),
	"monthly_price" numeric(12, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "milk_plans_one_price" CHECK (("app"."milk_plans"."price_per_delivery" is not null and "app"."milk_plans"."monthly_price" is null)
       or ("app"."milk_plans"."price_per_delivery" is null and "app"."milk_plans"."monthly_price" is not null)),
	CONSTRAINT "milk_plans_qty_positive" CHECK ("app"."milk_plans"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."milk_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"root_id" uuid NOT NULL,
	"supersedes_id" uuid,
	"customer_id" uuid NOT NULL,
	"milkman_id" uuid NOT NULL,
	"plan_id" uuid,
	"product_name" varchar(120) NOT NULL,
	"quantity" numeric(10, 3) NOT NULL,
	"unit" varchar(16) DEFAULT 'L' NOT NULL,
	"frequency" "app"."frequency" DEFAULT 'DAILY' NOT NULL,
	"slot" "app"."delivery_slot" DEFAULT 'MORNING' NOT NULL,
	"unit_price" numeric(12, 4) NOT NULL,
	"quoted_monthly_price" numeric(12, 2),
	"status" "app"."milk_subscription_status" DEFAULT 'ACTIVE' NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"paused_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "milk_subs_qty_positive" CHECK ("app"."milk_subscriptions"."quantity" > 0),
	CONSTRAINT "milk_subs_price_non_negative" CHECK ("app"."milk_subscriptions"."unit_price" >= 0),
	CONSTRAINT "milk_subs_range" CHECK ("app"."milk_subscriptions"."effective_to" is null or "app"."milk_subscriptions"."effective_to" >= "app"."milk_subscriptions"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "app"."deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_root_id" uuid NOT NULL,
	"subscription_version_id" uuid,
	"customer_id" uuid NOT NULL,
	"milkman_id" uuid NOT NULL,
	"delivery_date" date NOT NULL,
	"slot" "app"."delivery_slot" DEFAULT 'MORNING' NOT NULL,
	"product_name" varchar(120) NOT NULL,
	"unit" varchar(16) DEFAULT 'L' NOT NULL,
	"planned_quantity" numeric(10, 3) NOT NULL,
	"adjusted_quantity" numeric(10, 3),
	"delivered_quantity" numeric(10, 3),
	"unit_price" numeric(12, 4) NOT NULL,
	"amount" numeric(12, 2) GENERATED ALWAYS AS (case when status = 'DELIVERED'
               then round(coalesce(delivered_quantity, 0) * unit_price, 2)
               else 0 end) STORED,
	"status" "app"."delivery_status" DEFAULT 'PENDING' NOT NULL,
	"skip_reason" "app"."skip_reason",
	"note" text,
	"delivered_at" timestamp with time zone,
	"marked_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deliveries_quantities_non_negative" CHECK ("app"."deliveries"."planned_quantity" >= 0
      and ("app"."deliveries"."adjusted_quantity" is null or "app"."deliveries"."adjusted_quantity" >= 0)
      and ("app"."deliveries"."delivered_quantity" is null or "app"."deliveries"."delivered_quantity" >= 0)),
	CONSTRAINT "deliveries_quantity_ceiling" CHECK ("app"."deliveries"."planned_quantity" <= 100
      and ("app"."deliveries"."adjusted_quantity" is null or "app"."deliveries"."adjusted_quantity" <= 100)
      and ("app"."deliveries"."delivered_quantity" is null or "app"."deliveries"."delivered_quantity" <= 100)),
	CONSTRAINT "deliveries_delivered_consistency" CHECK (("app"."deliveries"."status" = 'DELIVERED'
           and "app"."deliveries"."delivered_quantity" is not null
           and "app"."deliveries"."delivered_at" is not null)
       or ("app"."deliveries"."status" <> 'DELIVERED' and "app"."deliveries"."delivered_quantity" is null))
);
--> statement-breakpoint
CREATE TABLE "app"."products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"milkman_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"image_url" text,
	"unit" varchar(16) DEFAULT 'kg' NOT NULL,
	"price_per_unit" numeric(12, 2) NOT NULL,
	"available_quantity" numeric(10, 3) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"available_from" date DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_stock_non_negative" CHECK ("app"."products"."available_quantity" >= 0),
	CONSTRAINT "products_price_positive" CHECK ("app"."products"."price_per_unit" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid,
	"customer_id" uuid NOT NULL,
	"milkman_id" uuid NOT NULL,
	"product_name" varchar(120) NOT NULL,
	"unit" varchar(16) NOT NULL,
	"quantity" numeric(10, 3) NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"amount" numeric(12, 2) GENERATED ALWAYS AS (round(quantity * unit_price, 2)) STORED,
	"delivery_address" text,
	"order_date" date NOT NULL,
	"status" "app"."purchase_status" DEFAULT 'PENDING' NOT NULL,
	"delivered_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchases_qty_positive" CHECK ("app"."purchases"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."plan_change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"milkman_id" uuid NOT NULL,
	"subscription_root_id" uuid NOT NULL,
	"requested_plan_id" uuid NOT NULL,
	"current_plan_name" varchar(120) NOT NULL,
	"current_quantity" numeric(10, 3) NOT NULL,
	"current_unit" varchar(16) NOT NULL,
	"current_monthly_price" numeric(12, 2),
	"requested_plan_name" varchar(120) NOT NULL,
	"requested_quantity" numeric(10, 3) NOT NULL,
	"requested_unit" varchar(16) NOT NULL,
	"requested_monthly_price" numeric(12, 2),
	"requested_slot" "app"."delivery_slot",
	"status" "app"."request_status" DEFAULT 'PENDING' NOT NULL,
	"customer_note" text NOT NULL,
	"milkman_note" text,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pcr_requested_positive" CHECK ("app"."plan_change_requests"."requested_quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."quantity_change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"milkman_id" uuid NOT NULL,
	"delivery_id" uuid NOT NULL,
	"delivery_date" date NOT NULL,
	"current_quantity" numeric(10, 3) NOT NULL,
	"requested_quantity" numeric(10, 3) NOT NULL,
	"status" "app"."request_status" DEFAULT 'PENDING' NOT NULL,
	"customer_note" text,
	"milkman_note" text,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "qcr_requested_positive" CHECK ("app"."quantity_change_requests"."requested_quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."monthly_bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"milkman_id" uuid NOT NULL,
	"month" varchar(7) NOT NULL,
	"milk_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"products_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"adjustment_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"adjustment_reason" text,
	"total_amount" numeric(12, 2) GENERATED ALWAYS AS (round(milk_amount + products_amount - adjustment_amount, 2)) STORED,
	"paid_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" "app"."bill_status" DEFAULT 'OPEN' NOT NULL,
	"due_date" date NOT NULL,
	"closed_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"delivered_days" numeric(6, 0) DEFAULT '0' NOT NULL,
	"skipped_days" numeric(6, 0) DEFAULT '0' NOT NULL,
	"total_quantity" numeric(12, 3) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bills_amounts_non_negative" CHECK ("app"."monthly_bills"."milk_amount" >= 0 and "app"."monthly_bills"."products_amount" >= 0 and "app"."monthly_bills"."paid_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "app"."payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"milkman_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"method" "app"."payment_method" DEFAULT 'UPI' NOT NULL,
	"reference" varchar(120),
	"customer_note" text,
	"status" "app"."payment_status" DEFAULT 'SUBMITTED' NOT NULL,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_positive" CHECK ("app"."payments"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "app"."notification_type" NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"href" varchar(300),
	"subject_type" varchar(60),
	"subject_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"read_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."admin_allowlist" ADD CONSTRAINT "admin_allowlist_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."milkman_profiles" ADD CONSTRAINT "milkman_profiles_milkman_id_users_id_fk" FOREIGN KEY ("milkman_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."milkman_profiles" ADD CONSTRAINT "milkman_profiles_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."addresses" ADD CONSTRAINT "addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."service_areas" ADD CONSTRAINT "service_areas_milkman_id_users_id_fk" FOREIGN KEY ("milkman_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."platform_settings" ADD CONSTRAINT "platform_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."saas_payments" ADD CONSTRAINT "saas_payments_milkman_id_users_id_fk" FOREIGN KEY ("milkman_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."saas_payments" ADD CONSTRAINT "saas_payments_subscription_id_saas_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "app"."saas_subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."saas_payments" ADD CONSTRAINT "saas_payments_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."saas_subscriptions" ADD CONSTRAINT "saas_subscriptions_milkman_id_users_id_fk" FOREIGN KEY ("milkman_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."saas_subscriptions" ADD CONSTRAINT "saas_subscriptions_plan_id_saas_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "app"."saas_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."milk_plans" ADD CONSTRAINT "milk_plans_milkman_id_users_id_fk" FOREIGN KEY ("milkman_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."milk_subscriptions" ADD CONSTRAINT "milk_subscriptions_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."milk_subscriptions" ADD CONSTRAINT "milk_subscriptions_milkman_id_users_id_fk" FOREIGN KEY ("milkman_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."milk_subscriptions" ADD CONSTRAINT "milk_subscriptions_plan_id_milk_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "app"."milk_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."deliveries" ADD CONSTRAINT "deliveries_subscription_version_id_milk_subscriptions_id_fk" FOREIGN KEY ("subscription_version_id") REFERENCES "app"."milk_subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."deliveries" ADD CONSTRAINT "deliveries_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."deliveries" ADD CONSTRAINT "deliveries_milkman_id_users_id_fk" FOREIGN KEY ("milkman_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."deliveries" ADD CONSTRAINT "deliveries_marked_by_users_id_fk" FOREIGN KEY ("marked_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."products" ADD CONSTRAINT "products_milkman_id_users_id_fk" FOREIGN KEY ("milkman_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."purchases" ADD CONSTRAINT "purchases_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "app"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."purchases" ADD CONSTRAINT "purchases_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."purchases" ADD CONSTRAINT "purchases_milkman_id_users_id_fk" FOREIGN KEY ("milkman_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."plan_change_requests" ADD CONSTRAINT "plan_change_requests_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."plan_change_requests" ADD CONSTRAINT "plan_change_requests_milkman_id_users_id_fk" FOREIGN KEY ("milkman_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."plan_change_requests" ADD CONSTRAINT "plan_change_requests_requested_plan_id_milk_plans_id_fk" FOREIGN KEY ("requested_plan_id") REFERENCES "app"."milk_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."plan_change_requests" ADD CONSTRAINT "plan_change_requests_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."quantity_change_requests" ADD CONSTRAINT "quantity_change_requests_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."quantity_change_requests" ADD CONSTRAINT "quantity_change_requests_milkman_id_users_id_fk" FOREIGN KEY ("milkman_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."quantity_change_requests" ADD CONSTRAINT "quantity_change_requests_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "app"."deliveries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."quantity_change_requests" ADD CONSTRAINT "quantity_change_requests_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."monthly_bills" ADD CONSTRAINT "monthly_bills_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."monthly_bills" ADD CONSTRAINT "monthly_bills_milkman_id_users_id_fk" FOREIGN KEY ("milkman_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."payments" ADD CONSTRAINT "payments_bill_id_monthly_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "app"."monthly_bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."payments" ADD CONSTRAINT "payments_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."payments" ADD CONSTRAINT "payments_milkman_id_users_id_fk" FOREIGN KEY ("milkman_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."payments" ADD CONSTRAINT "payments_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_allowlist_email_key" ON "app"."admin_allowlist" USING btree ("email");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "app"."audit_log" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_subject_idx" ON "app"."audit_log" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "app"."audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "milkman_profiles_milkman_key" ON "app"."milkman_profiles" USING btree ("milkman_id");--> statement-breakpoint
CREATE INDEX "milkman_profiles_verified_idx" ON "app"."milkman_profiles" USING btree ("is_verified");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "app"."users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_clerk_id_key" ON "app"."users" USING btree ("clerk_id");--> statement-breakpoint
CREATE INDEX "users_tenant_idx" ON "app"."users" USING btree ("milkman_id","role","approval_status");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "app"."users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "addresses_user_idx" ON "app"."addresses" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "addresses_one_default_per_user" ON "app"."addresses" USING btree ("user_id") WHERE is_default;--> statement-breakpoint
CREATE UNIQUE INDEX "service_areas_milkman_area_key" ON "app"."service_areas" USING btree ("milkman_id","area_name","pincode");--> statement-breakpoint
CREATE INDEX "service_areas_pincode_idx" ON "app"."service_areas" USING btree ("pincode","is_active");--> statement-breakpoint
CREATE INDEX "service_areas_milkman_idx" ON "app"."service_areas" USING btree ("milkman_id","is_active");--> statement-breakpoint
CREATE INDEX "saas_payments_milkman_idx" ON "app"."saas_payments" USING btree ("milkman_id","created_at");--> statement-breakpoint
CREATE INDEX "saas_payments_status_idx" ON "app"."saas_payments" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "saas_plans_active_idx" ON "app"."saas_plans" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE INDEX "saas_subs_milkman_idx" ON "app"."saas_subscriptions" USING btree ("milkman_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "saas_subs_one_live_per_milkman" ON "app"."saas_subscriptions" USING btree ("milkman_id") WHERE status in ('TRIAL','ACTIVE','PENDING_VERIFICATION');--> statement-breakpoint
CREATE UNIQUE INDEX "saas_subs_one_trial_per_milkman" ON "app"."saas_subscriptions" USING btree ("milkman_id") WHERE status = 'TRIAL' or (plan_id is null and status <> 'CANCELLED');--> statement-breakpoint
CREATE INDEX "saas_subs_expiry_idx" ON "app"."saas_subscriptions" USING btree ("status","ends_at");--> statement-breakpoint
CREATE INDEX "milk_plans_milkman_idx" ON "app"."milk_plans" USING btree ("milkman_id","is_active");--> statement-breakpoint
CREATE INDEX "milk_subs_customer_idx" ON "app"."milk_subscriptions" USING btree ("customer_id","status");--> statement-breakpoint
CREATE INDEX "milk_subs_milkman_idx" ON "app"."milk_subscriptions" USING btree ("milkman_id","status");--> statement-breakpoint
CREATE INDEX "milk_subs_root_idx" ON "app"."milk_subscriptions" USING btree ("root_id","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "milk_subs_one_current_per_root" ON "app"."milk_subscriptions" USING btree ("root_id") WHERE effective_to is null;--> statement-breakpoint
CREATE INDEX "milk_subs_active_idx" ON "app"."milk_subscriptions" USING btree ("status","effective_from") WHERE status = 'ACTIVE';--> statement-breakpoint
CREATE UNIQUE INDEX "deliveries_subscription_date_key" ON "app"."deliveries" USING btree ("subscription_root_id","delivery_date");--> statement-breakpoint
CREATE INDEX "deliveries_round_idx" ON "app"."deliveries" USING btree ("milkman_id","delivery_date","status");--> statement-breakpoint
CREATE INDEX "deliveries_customer_date_idx" ON "app"."deliveries" USING btree ("customer_id","delivery_date");--> statement-breakpoint
CREATE INDEX "deliveries_billing_idx" ON "app"."deliveries" USING btree ("customer_id","delivery_date","status") WHERE status = 'DELIVERED';--> statement-breakpoint
CREATE INDEX "products_milkman_idx" ON "app"."products" USING btree ("milkman_id","is_active");--> statement-breakpoint
CREATE INDEX "purchases_customer_idx" ON "app"."purchases" USING btree ("customer_id","order_date");--> statement-breakpoint
CREATE INDEX "purchases_milkman_idx" ON "app"."purchases" USING btree ("milkman_id","status","order_date");--> statement-breakpoint
CREATE INDEX "purchases_billable_idx" ON "app"."purchases" USING btree ("customer_id","order_date") WHERE status <> 'CANCELLED';--> statement-breakpoint
CREATE INDEX "pcr_milkman_idx" ON "app"."plan_change_requests" USING btree ("milkman_id","status","created_at");--> statement-breakpoint
CREATE INDEX "pcr_customer_idx" ON "app"."plan_change_requests" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pcr_one_pending_per_subscription" ON "app"."plan_change_requests" USING btree ("subscription_root_id") WHERE status = 'PENDING';--> statement-breakpoint
CREATE INDEX "qcr_milkman_idx" ON "app"."quantity_change_requests" USING btree ("milkman_id","status","delivery_date");--> statement-breakpoint
CREATE INDEX "qcr_customer_idx" ON "app"."quantity_change_requests" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "qcr_one_pending_per_delivery" ON "app"."quantity_change_requests" USING btree ("delivery_id") WHERE status = 'PENDING';--> statement-breakpoint
CREATE UNIQUE INDEX "bills_customer_month_key" ON "app"."monthly_bills" USING btree ("customer_id","month");--> statement-breakpoint
CREATE INDEX "bills_milkman_idx" ON "app"."monthly_bills" USING btree ("milkman_id","month");--> statement-breakpoint
CREATE INDEX "bills_status_idx" ON "app"."monthly_bills" USING btree ("status","due_date");--> statement-breakpoint
CREATE INDEX "payments_bill_idx" ON "app"."payments" USING btree ("bill_id","status");--> statement-breakpoint
CREATE INDEX "payments_customer_idx" ON "app"."payments" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "payments_milkman_idx" ON "app"."payments" USING btree ("milkman_id","status","created_at");--> statement-breakpoint
CREATE INDEX "notifications_inbox_idx" ON "app"."notifications" USING btree ("user_id","created_at") WHERE archived_at is null;--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "app"."notifications" USING btree ("user_id") WHERE read_at is null and archived_at is null;--> statement-breakpoint
CREATE INDEX "notifications_subject_idx" ON "app"."notifications" USING btree ("subject_type","subject_id");