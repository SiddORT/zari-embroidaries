import { pgTable, serial, integer, varchar, timestamp, numeric, text, boolean, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tdsMasterTable } from "./tdsMaster"; 
import { vendorsTable } from "./vendors"; 

export const paymentSourceTypeEnum = pgEnum("payment_source_type_enum", [
  "pr_payments",
  "costing_payments",
]);

export const baseDocumentTypeEnum = pgEnum("base_document_type_enum", [
  "pr",
  "outsource_job",
  "custom_charge"
]);

export const paymentTdsStatusEnum = pgEnum("payment_tds_status_enum", [
  "DEDUCTED",
  "DEPOSITED",
  "FILED",
  "REVERSED",
  "NOT_APPLICABLE",
]);

export const paymentTds = pgTable(
  "payment_tds",
  {
    id: serial("id").primaryKey(),

    // Selected TDS rule
    tdsMasterId: integer("tds_master_id")
      .notNull()
      .references(() => tdsMasterTable.id, { onDelete: "restrict" }),

    // Payment that triggered the TDS
    paymentSourceType: paymentSourceTypeEnum("payment_source_type").notNull(),

    paymentSourceId: integer("payment_source_id").notNull(),
    paymentDate: timestamp("payment_date", { withTimezone: true }).notNull(),

    // Vendor
    vendorId: integer("vendor_id")
      .notNull()
      .references(() => vendorsTable.id, { onDelete: "restrict" }), 

    // Source document that the payment relates to
    baseDocumentType: baseDocumentTypeEnum("base_document_type"),
    baseDocumentId: integer("base_document_id"),

    grossAmount: numeric("gross_amount", { precision: 15, scale: 2 })
      .notNull()
      .default("0"), // Total before TDS = baseAmount + gstAmount
    gstAmount: numeric("gst_amount", { precision: 15, scale: 2 })
      .notNull()
      .default("0"), // GST stripped out of the gross amount
    gstPercentage: numeric("gst_percentage", { precision: 5, scale: 2 })
      .notNull()
      .default("0"), // Snapshot of the GST% applied at payment time
 
    paymentCurrencyCode: varchar("payment_currency_code", { length: 10 }),
    paymentExchangeRate: numeric("payment_exchange_rate", { precision: 15, scale: 6 }),

    // TDS calculation snapshot
    baseAmount: numeric("base_amount", { precision: 15, scale: 2 }).notNull(),
    paidAmount: numeric("paid_amount", { precision: 15, scale: 2 }).notNull(),
    tdsRate: numeric("tds_rate", { precision: 5, scale: 2 }).notNull(),
    tdsAmount: numeric("tds_amount", { precision: 15, scale: 2 }).notNull(),

    // TDS status
    status: paymentTdsStatusEnum("status").notNull().default("DEDUCTED"),

    // Audit
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: text("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    isDeleted: boolean("is_deleted").notNull().default(false),
    deletedBy: text("deleted_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
);


export const paymentTdsRelations = relations(paymentTds, ({ one }) => ({
  tdsMasterTable: one(tdsMasterTable, {
    fields: [paymentTds.tdsMasterId],
    references: [tdsMasterTable.id],
  }),
  vendor: one(vendorsTable, {
    fields: [paymentTds.vendorId],
    references: [vendorsTable.id],
  }),
}));

// Type inference
export type PaymentTds = typeof paymentTds.$inferSelect;
export type NewPaymentTds = typeof paymentTds.$inferInsert;