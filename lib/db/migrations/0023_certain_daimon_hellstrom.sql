ALTER TABLE "tds_master" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tds_master" ADD COLUMN "deleted_by" text;--> statement-breakpoint
ALTER TABLE "tds_master" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vendor_tds" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vendor_tds" ADD COLUMN "deleted_by" text;--> statement-breakpoint
ALTER TABLE "vendor_tds" ADD COLUMN "deleted_at" timestamp with time zone;