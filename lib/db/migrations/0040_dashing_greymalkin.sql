CREATE TYPE "public"."payment_items_base_document_item_type_enum" AS ENUM('purchase_receipt_item', 'vendor_challan_items');--> statement-breakpoint
CREATE TYPE "public"."payment_items_base_document_type_enum" AS ENUM('purchase_receipts', 'vendor_challans');--> statement-breakpoint
CREATE TYPE "public"."payment_items_source_type_enum" AS ENUM('pr_payments', 'vendor_payments');--> statement-breakpoint
CREATE TABLE "payment_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_source_type" "payment_items_source_type_enum" NOT NULL,
	"payment_source_id" integer NOT NULL,
	"base_document_type" "payment_items_base_document_type_enum" NOT NULL,
	"base_document_id" integer NOT NULL,
	"base_document_item_type" "payment_items_base_document_item_type_enum" NOT NULL,
	"base_document_item_id" integer NOT NULL,
	"base_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"gst_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"gross_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"paid_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tds_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_by" text,
	"deleted_at" timestamp with time zone
);
