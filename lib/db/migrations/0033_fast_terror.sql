ALTER TABLE "payment_tds_items" ADD COLUMN "updated_by" text;--> statement-breakpoint
ALTER TABLE "payment_tds_items" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payment_tds_items" ADD COLUMN "deleted_by" text;--> statement-breakpoint
ALTER TABLE "payment_tds_items" ADD COLUMN "deleted_at" timestamp with time zone;