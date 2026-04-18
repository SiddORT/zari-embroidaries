import { pgTable, serial, text, numeric, integer, timestamp, boolean } from "drizzle-orm/pg-core";

export const invReceiptsTable = pgTable("inv_receipts", {
  id: serial("id").primaryKey(),
  prNumber: text("pr_number").notNull().unique(),
  vendorId: integer("vendor_id"),
  vendorName: text("vendor_name"),
  prDate: text("pr_date").notNull(),
  status: text("status").notNull().default("draft"),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  remarks: text("remarks"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  isDeleted: boolean("is_deleted").notNull().default(false),
});

export const invReceiptItemsTable = pgTable("inv_receipt_items", {
  id: serial("id").primaryKey(),
  prId: integer("pr_id").notNull(),
  inventoryItemId: integer("inventory_item_id").notNull(),
  itemName: text("item_name").notNull(),
  itemCode: text("item_code").notNull(),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull().default("0"),
  warehouseLocation: text("warehouse_location"),
  remarks: text("remarks"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type InvReceiptRecord = typeof invReceiptsTable.$inferSelect;
export type InvReceiptItemRecord = typeof invReceiptItemsTable.$inferSelect;
