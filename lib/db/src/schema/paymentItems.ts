import { pgTable, serial, integer, numeric, text, boolean, timestamp, pgEnum, } from "drizzle-orm/pg-core";

/**
 * Enum for payment source type
 */
export const paymentItemsSourceTypeEnum = pgEnum("payment_items_source_type_enum", [
 "pr_payments",
 "vendor_payments"
]);

/**
 * Enum for base document type
 */
export const paymentItemsBaseDocumentTypeEnum = pgEnum("payment_items_base_document_type_enum", [
"purchase_receipts",
"vendor_challans"
]);

/**
 * Enum for base document item source
 */
export const paymentItemsBaseDocumentItemTypeEnum = pgEnum(
  "payment_items_base_document_item_type_enum",
  [
    "purchase_receipt_item",
    "vendor_challan_items"
  ],
);

export const paymentItems = pgTable("payment_items", {
  id: serial("id").primaryKey(),

  // Payment transaction
  paymentSourceType: paymentItemsSourceTypeEnum("payment_source_type").notNull(),
  paymentSourceId: integer("payment_source_id").notNull(),

  // Parent document
  baseDocumentType: paymentItemsBaseDocumentTypeEnum("base_document_type").notNull(),
  baseDocumentId: integer("base_document_id").notNull(),

  // Child item
  baseDocumentItemType: paymentItemsBaseDocumentItemTypeEnum(
    "base_document_item_type",
  ).notNull(),
  baseDocumentItemId: integer("base_document_item_id").notNull(),

  // Item allocation
  baseAmount: numeric("base_amount", { precision: 15, scale: 2, }) .notNull() .default("0"),

  gstAmount: numeric("gst_amount", { precision: 15, scale: 2, }) .notNull() .default("0"),

  grossAmount: numeric("gross_amount", { precision: 15, scale: 2, }) .notNull() .default("0"),

  // Actual cash paid
  paidAmount: numeric("paid_amount", { precision: 15, scale: 2, }) .notNull() .default("0"),
  // TDS deducted, if applicable
  tdsAmount: numeric("tds_amount", { precision: 15, scale: 2, }) .notNull() .default("0"),

  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, }) .notNull() .defaultNow(),

  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true, }),

  isDeleted: boolean("is_deleted") .notNull() .default(false),

  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true, }),
});

// Type inference
export type PaymentItem = typeof paymentItems.$inferSelect;
export type NewPaymentItem = typeof paymentItems.$inferInsert;
