ALTER TABLE "other_expenses" ADD COLUMN "hsn_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "other_expenses" ADD COLUMN "hsn_code" text NOT NULL;--> statement-breakpoint
ALTER TABLE "other_expenses" ADD COLUMN "gst_percentage" text DEFAULT '5' NOT NULL;

