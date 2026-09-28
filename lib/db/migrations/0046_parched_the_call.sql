ALTER TYPE "public"."base_document_type_enum" ADD VALUE 'other_expense';--> statement-breakpoint
ALTER TYPE "public"."base_document_type_enum" ADD VALUE 'ledger_charge';--> statement-breakpoint
ALTER TYPE "public"."base_document_type_enum" ADD VALUE 'artwork_swatch';--> statement-breakpoint
ALTER TYPE "public"."base_document_type_enum" ADD VALUE 'artwork_style';--> statement-breakpoint
ALTER TYPE "public"."base_document_type_enum" ADD VALUE 'toile';--> statement-breakpoint
ALTER TYPE "public"."base_document_type_enum" ADD VALUE 'shipping';--> statement-breakpoint
ALTER TABLE "payment_tds" ALTER COLUMN "vendor_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "artworks" ADD COLUMN "gst_percentage" numeric(5, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "style_order_artworks" ADD COLUMN "gst_percentage" numeric(5, 2) DEFAULT '0' NOT NULL;