ALTER TABLE "payment_tds_items"
ALTER COLUMN "base_document_item_type" SET DATA TYPE text;
--> statement-breakpoint

UPDATE "payment_tds_items"
SET "base_document_item_type" = 'vendor_challan_items'
WHERE "base_document_item_type" = 'vendor_challan_item';
--> statement-breakpoint

DROP TYPE "public"."base_document_item_type_enum";
--> statement-breakpoint

CREATE TYPE "public"."base_document_item_type_enum"
AS ENUM('purchase_receipt_item', 'vendor_challan_items');
--> statement-breakpoint

ALTER TABLE "payment_tds_items"
ALTER COLUMN "base_document_item_type"
SET DATA TYPE "public"."base_document_item_type_enum"
USING "base_document_item_type"::"public"."base_document_item_type_enum";
