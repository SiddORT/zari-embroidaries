ALTER TABLE "vendor_ledger_charges" ADD COLUMN "hsn_id" integer;--> statement-breakpoint
ALTER TABLE "vendor_ledger_charges" ADD COLUMN "hsn_code" text;--> statement-breakpoint
ALTER TABLE "vendor_ledger_charges" ADD COLUMN "gst_percentage" numeric(5, 2) DEFAULT '0';