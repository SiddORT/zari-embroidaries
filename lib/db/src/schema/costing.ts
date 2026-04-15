import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export interface PaymentAttachmentFile {
  name: string;
  type: string;
  data: string;
  size: number;
}

export const swatchBomTable = pgTable("swatch_bom", {
  id: serial("id").primaryKey(),
  swatchOrderId: integer("swatch_order_id").notNull(),
  materialType: text("material_type").notNull(),
  materialId: integer("material_id").notNull(),
  materialCode: text("material_code").notNull(),
  materialName: text("material_name").notNull(),
  currentStock: text("current_stock").notNull().default("0"),
  avgUnitPrice: text("avg_unit_price").notNull().default("0"),
  unitType: text("unit_type").notNull().default(""),
  warehouseLocation: text("warehouse_location").notNull().default(""),
  requiredQty: text("required_qty").notNull(),
  estimatedAmount: text("estimated_amount").notNull().default("0"),
  consumedQty: text("consumed_qty").notNull().default("0"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export type SwatchBomRecord = typeof swatchBomTable.$inferSelect;

export interface PoLineItem {
  bomRowId: number;
  materialCode: string;
  materialName: string;
  unitType: string;
  targetPrice: string;
  quantity: string;
}

export const purchaseOrdersTable = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  poNumber: text("po_number").notNull().unique(),
  swatchOrderId: integer("swatch_order_id").notNull(),
  vendorId: integer("vendor_id").notNull(),
  vendorName: text("vendor_name").notNull(),
  poDate: timestamp("po_date", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("Draft"),
  notes: text("notes"),
  bomRowIds: jsonb("bom_row_ids").$type<number[]>().default([]),
  bomItems: jsonb("bom_items").$type<PoLineItem[]>().default([]),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export type PurchaseOrderRecord = typeof purchaseOrdersTable.$inferSelect;

export const purchaseReceiptsTable = pgTable("purchase_receipts", {
  id: serial("id").primaryKey(),
  prNumber: text("pr_number").notNull().unique(),
  poId: integer("po_id").notNull(),
  swatchOrderId: integer("swatch_order_id").notNull(),
  vendorName: text("vendor_name").notNull(),
  receivedDate: timestamp("received_date", { withTimezone: true }).notNull().defaultNow(),
  receivedQty: text("received_qty").notNull(),
  actualPrice: text("actual_price").notNull(),
  warehouseLocation: text("warehouse_location").notNull().default(""),
  status: text("status").notNull().default("Open"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export type PurchaseReceiptRecord = typeof purchaseReceiptsTable.$inferSelect;

export const prPaymentsTable = pgTable("pr_payments", {
  id: serial("id").primaryKey(),
  prId: integer("pr_id").notNull(),
  paymentType: text("payment_type").notNull(),
  paymentDate: timestamp("payment_date", { withTimezone: true }).notNull().defaultNow(),
  paymentMode: text("payment_mode").notNull().default(""),
  amount: text("amount").notNull(),
  transactionStatus: text("transaction_status").notNull().default(""),
  paymentStatus: text("payment_status").notNull().default("Pending"),
  attachment: jsonb("attachment").$type<PaymentAttachmentFile | null>().default(null),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export type PrPaymentRecord = typeof prPaymentsTable.$inferSelect;
