ALTER TABLE "purchase_receipts" ADD COLUMN "total_amount_with_gst" text;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD COLUMN "hsn_id" integer;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD COLUMN "hsn_code" text;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD COLUMN "gst_percentage" numeric(5, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "purchase_receipt_items" ADD COLUMN "hsn_id" integer;--> statement-breakpoint
ALTER TABLE "purchase_receipt_items" ADD COLUMN "hsn_code" text;--> statement-breakpoint
ALTER TABLE "purchase_receipt_items" ADD COLUMN "gst_percentage" numeric(5, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "payment_tds" ADD COLUMN "gross_amount" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_tds" ADD COLUMN "gst_amount" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_tds" ADD COLUMN "gst_percentage" numeric(5, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_tds" ADD COLUMN "payment_currency_code" varchar(10);--> statement-breakpoint
ALTER TABLE "payment_tds" ADD COLUMN "payment_exchange_rate" numeric(15, 6);