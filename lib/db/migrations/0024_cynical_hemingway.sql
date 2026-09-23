ALTER TABLE "tds_master" ALTER COLUMN "created_by" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "tds_master" ALTER COLUMN "updated_by" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "tds_master" ALTER COLUMN "deleted_by" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "tds_master" ADD CONSTRAINT "tds_master_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tds_master" ADD CONSTRAINT "tds_master_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tds_master" ADD CONSTRAINT "tds_master_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;