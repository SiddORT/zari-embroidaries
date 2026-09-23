CREATE TYPE "public"."base_document_item_type_enum" AS ENUM('purchase_receipt_item');--> statement-breakpoint
CREATE TABLE "payment_tds_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_tds_id" integer NOT NULL,
	"base_document_item_type" "base_document_item_type_enum" NOT NULL,
	"base_document_item_id" integer NOT NULL,
	"base_amount" numeric(15, 2) NOT NULL,
	"gst_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"gst_percentage" numeric(5, 2) DEFAULT '0' NOT NULL,
	"tds_rate" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tds_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"paid_amount" numeric(15, 2) NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_tds_items" ADD CONSTRAINT "payment_tds_items_payment_tds_id_payment_tds_id_fk" FOREIGN KEY ("payment_tds_id") REFERENCES "public"."payment_tds"("id") ON DELETE restrict ON UPDATE no action;