CREATE TABLE "invoice_line_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"line_no" integer DEFAULT 1 NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" varchar(50) DEFAULT 'Item' NOT NULL,
	"quantity" numeric(18, 4) DEFAULT '1' NOT NULL,
	"unit_price" numeric(18, 4) DEFAULT '0' NOT NULL,
	"total" numeric(18, 4) DEFAULT '0' NOT NULL,
	"hsn_code" varchar(20) DEFAULT '',
	"hsn_gst_pct" varchar(10) DEFAULT '',
	"show_hsn" boolean DEFAULT true NOT NULL,
	"unit" varchar(30) DEFAULT '',
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(100),
	"is_locked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_payment_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_id" integer NOT NULL,
	"invoice_id" integer NOT NULL,
	"invoice_line_item_id" integer NOT NULL,
	"allocated_gross_amount" numeric(18, 4) NOT NULL,
	"allocated_taxable_amount" numeric(18, 4) DEFAULT '0' NOT NULL,
	"net_received_amount" numeric(18, 4) NOT NULL,
	"allocation_sequence" integer DEFAULT 1 NOT NULL,
	"remarks" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "invoice_payment_tds" (
	"id" serial PRIMARY KEY NOT NULL,
	"tds_master_id" integer NOT NULL,
	"payment_id" integer NOT NULL,
	"payment_date" timestamp with time zone NOT NULL,
	"client_id" integer NOT NULL,
	"invoice_id" integer NOT NULL,
	"gross_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"gst_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"gst_percentage" numeric(5, 2) DEFAULT '0' NOT NULL,
	"payment_currency_code" varchar(10),
	"payment_exchange_rate" numeric(15, 6),
	"base_amount" numeric(15, 2) NOT NULL,
	"paid_amount" numeric(15, 2) NOT NULL,
	"tds_rate" numeric(5, 2) NOT NULL,
	"tds_amount" numeric(15, 2) NOT NULL,
	"status" text DEFAULT 'DEDUCTED' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_by" text,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "invoice_payment_tds_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_payment_tds_id" integer NOT NULL,
	"invoice_line_item_id" integer NOT NULL,
	"payment_item_id" integer,
	"base_amount" numeric(15, 2) NOT NULL,
	"gst_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"gst_percentage" numeric(5, 2) DEFAULT '0' NOT NULL,
	"tds_rate" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tds_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"paid_amount" numeric(15, 2) NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_by" text,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payment_items" ADD CONSTRAINT "invoice_payment_items_payment_id_invoice_payments_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."invoice_payments"("payment_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payment_items" ADD CONSTRAINT "invoice_payment_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payment_items" ADD CONSTRAINT "invoice_payment_items_invoice_line_item_id_invoice_line_items_id_fk" FOREIGN KEY ("invoice_line_item_id") REFERENCES "public"."invoice_line_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payment_tds" ADD CONSTRAINT "invoice_payment_tds_tds_master_id_tds_master_id_fk" FOREIGN KEY ("tds_master_id") REFERENCES "public"."tds_master"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payment_tds" ADD CONSTRAINT "invoice_payment_tds_payment_id_invoice_payments_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."invoice_payments"("payment_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payment_tds" ADD CONSTRAINT "invoice_payment_tds_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payment_tds" ADD CONSTRAINT "invoice_payment_tds_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payment_tds_items" ADD CONSTRAINT "invoice_payment_tds_items_invoice_payment_tds_id_invoice_payment_tds_id_fk" FOREIGN KEY ("invoice_payment_tds_id") REFERENCES "public"."invoice_payment_tds"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payment_tds_items" ADD CONSTRAINT "invoice_payment_tds_items_invoice_line_item_id_invoice_line_items_id_fk" FOREIGN KEY ("invoice_line_item_id") REFERENCES "public"."invoice_line_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payment_tds_items" ADD CONSTRAINT "invoice_payment_tds_items_payment_item_id_invoice_payment_items_id_fk" FOREIGN KEY ("payment_item_id") REFERENCES "public"."invoice_payment_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_invoice_line_items_invoice_id" ON "invoice_line_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_line_items_invoice_line_no" ON "invoice_line_items" USING btree ("invoice_id","line_no");