import { pgTable, serial, integer, varchar, timestamp, numeric, text, boolean, } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tdsMasterTable } from "./tdsMaster"; 
import { vendorsTable } from "./vendors"; 

export const paymentTds = pgTable(
  "payment_tds",
  {
    id: serial("id").primaryKey(),

    // Selected TDS rule
    tdsMasterId: integer("tds_master_id")
      .notNull()
      .references(() => tdsMasterTable.id, { onDelete: "restrict" }),

    // Payment that triggered the TDS
    paymentSourceType: varchar("payment_source_type", { length: 50 })
      .notNull(),
    paymentSourceId: integer("payment_source_id").notNull(),
    paymentDate: timestamp("payment_date", { withTimezone: true }).notNull(),

    // Vendor
    vendorId: integer("vendor_id")
      .notNull()
      .references(() => vendorsTable.id, { onDelete: "restrict" }), // optional vendor FK

    // Source document that the payment relates to
    baseDocumentType: varchar("base_document_type", { length: 50 }),
    baseDocumentId: integer("base_document_id"),

    // TDS calculation snapshot
    paidAmount: numeric("paid_amount", { precision: 15, scale: 2 }).notNull(),
    tdsRate: numeric("tds_rate", { precision: 5, scale: 2 }).notNull(),
    tdsAmount: numeric("tds_amount", { precision: 15, scale: 2 }).notNull(),

    // TDS status
    status: varchar("status", { length: 20 })
      .notNull()
      .default("DEDUCTED"),

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