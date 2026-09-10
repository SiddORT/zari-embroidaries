CREATE TABLE "payment_tds" (
	"id" serial PRIMARY KEY NOT NULL,
	"tds_master_id" integer NOT NULL,
	"payment_source_type" varchar(50) NOT NULL,
	"payment_source_id" integer NOT NULL,
	"payment_date" timestamp with time zone NOT NULL,
	"vendor_id" integer NOT NULL,
	"base_document_type" varchar(50),
	"base_document_id" integer,
	"paid_amount" numeric(15, 2) NOT NULL,
	"tds_rate" numeric(5, 2) NOT NULL,
	"tds_amount" numeric(15, 2) NOT NULL,
	"status" varchar(20) DEFAULT 'DEDUCTED' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_by" text,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "payment_tds" ADD CONSTRAINT "payment_tds_tds_master_id_tds_master_id_fk" FOREIGN KEY ("tds_master_id") REFERENCES "public"."tds_master"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_tds" ADD CONSTRAINT "payment_tds_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;