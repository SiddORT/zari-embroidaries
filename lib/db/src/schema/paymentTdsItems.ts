import { pgTable, serial, integer, numeric, text, boolean, timestamp, pgEnum, } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { paymentTds } from "./paymentTds";

/**
 * Enum for base document item source
 */
export const baseDocumentItemTypeEnum = pgEnum("base_document_item_type_enum", [
  "purchase_receipt_item",
]);

export const paymentTdsItems = pgTable("payment_tds_items", {
  id: serial("id").primaryKey(),

  paymentTdsId: integer("payment_tds_id")
    .notNull()
    .references(() => paymentTds.id, { onDelete: "restrict" }),

  baseDocumentItemType: baseDocumentItemTypeEnum("base_document_item_type").notNull(),
  baseDocumentItemId: integer("base_document_item_id").notNull(),

  baseAmount: numeric("base_amount", { precision: 15, scale: 2 }).notNull(),
  gstAmount: numeric("gst_amount", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  gstPercentage: numeric("gst_percentage", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
  tdsRate: numeric("tds_rate", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  tdsAmount: numeric("tds_amount", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  paidAmount: numeric("paid_amount", { precision: 15, scale: 2 }).notNull(),

  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),

  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const paymentTdsItemsRelations = relations(paymentTdsItems, ({ one }) => ({
  paymentTds: one(paymentTds, {
    fields: [paymentTdsItems.paymentTdsId],
    references: [paymentTds.id],
  }),
}));

// Type inference
export type PaymentTdsItem = typeof paymentTdsItems.$inferSelect;
export type NewPaymentTdsItem = typeof paymentTdsItems.$inferInsert;
