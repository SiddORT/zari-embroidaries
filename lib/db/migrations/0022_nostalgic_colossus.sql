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
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_by" integer,
	"deleted_at" timestamp with time zone,
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "tds_master" ADD CONSTRAINT "tds_master_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tds_master" ADD CONSTRAINT "tds_master_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tds_master" ADD CONSTRAINT "tds_master_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;