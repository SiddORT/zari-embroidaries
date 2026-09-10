ALTER TABLE "payment_items" ALTER COLUMN "base_document_item_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."payment_items_base_document_item_type_enum";--> statement-breakpoint
CREATE TYPE "public"."payment_items_base_document_item_type_enum" AS ENUM('purchase_receipt_item', 'vendor_challan_item');--> statement-breakpoint
ALTER TABLE "payment_items" ALTER COLUMN "base_document_item_type" SET DATA TYPE "public"."payment_items_base_document_item_type_enum" USING "base_document_item_type"::"public"."payment_items_base_document_item_type_enum";