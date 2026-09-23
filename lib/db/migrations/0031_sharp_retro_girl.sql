CREATE TYPE "public"."base_document_type_enum" AS ENUM('pr', 'outsource_job', 'custom_charge');--> statement-breakpoint
CREATE TYPE "public"."payment_source_type_enum" AS ENUM('pr_payments', 'costing_payments');--> statement-breakpoint
CREATE TYPE "public"."payment_tds_status_enum" AS ENUM('DEDUCTED', 'DEPOSITED', 'FILED', 'REVERSED');--> statement-breakpoint
ALTER TABLE "payment_tds" ALTER COLUMN "payment_source_type" SET DATA TYPE "public"."payment_source_type_enum" USING "payment_source_type"::"public"."payment_source_type_enum";--> statement-breakpoint
ALTER TABLE "payment_tds" ALTER COLUMN "base_document_type" SET DATA TYPE "public"."base_document_type_enum" USING "base_document_type"::"public"."base_document_type_enum";--> statement-breakpoint
ALTER TABLE "payment_tds" ALTER COLUMN "status" SET DEFAULT 'DEDUCTED'::"public"."payment_tds_status_enum";--> statement-breakpoint
ALTER TABLE "payment_tds" ALTER COLUMN "status" SET DATA TYPE "public"."payment_tds_status_enum" USING "status"::"public"."payment_tds_status_enum";