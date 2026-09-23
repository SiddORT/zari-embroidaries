CREATE TABLE "vendor_challan_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"vendor_challan_id" integer NOT NULL,
	"description" varchar(500),
	"quantity" numeric(14, 3) NOT NULL,
	"unit" varchar(50),
	"rate" numeric(14, 2) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"hsn_id" integer,
	"hsn_code" varchar(20),
	"gst_percentage" numeric(5, 2) NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_by" text,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "vendor_challan_items" ADD CONSTRAINT "vendor_challan_items_vendor_challan_id_vendor_challans_id_fk" FOREIGN KEY ("vendor_challan_id") REFERENCES "public"."vendor_challans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_challan_items" ADD CONSTRAINT "vendor_challan_items_hsn_id_hsn_master_id_fk" FOREIGN KEY ("hsn_id") REFERENCES "public"."hsn_master"("id") ON DELETE set null ON UPDATE no action;