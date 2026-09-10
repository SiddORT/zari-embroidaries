CREATE TABLE "tds_master" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_name" text NOT NULL,
	"payment_nature" text NOT NULL,
	"section_code" text NOT NULL,
	"rate_percent" numeric(5, 2) NOT NULL,
	"threshold_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"remarks" text,
	"status" boolean DEFAULT true NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vendor_tds" (
	"id" serial PRIMARY KEY NOT NULL,
	"vendor_id" integer NOT NULL,
	"tds_master_id" integer NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_tds_vendor_tds_unique" UNIQUE("vendor_id","tds_master_id")
);
