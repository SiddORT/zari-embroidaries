ALTER TYPE "public"."base_document_type_enum" ADD VALUE 'style_order_product';--> statement-breakpoint
ALTER TABLE "artisan_timesheets" ADD COLUMN "updated_by" text;--> statement-breakpoint
ALTER TABLE "artisan_timesheets" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "custom_charges" ADD COLUMN "updated_by" text;--> statement-breakpoint
ALTER TABLE "custom_charges" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "outsource_jobs" ADD COLUMN "updated_by" text;--> statement-breakpoint
ALTER TABLE "outsource_jobs" ADD COLUMN "updated_at" timestamp with time zone;