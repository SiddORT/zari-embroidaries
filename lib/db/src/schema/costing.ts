import { pgTable, serial, integer, text, timestamp, jsonb, numeric } from "drizzle-orm/pg-core";

export interface PaymentAttachmentFile {
  name: string;
  type: string;
  data: string;
  size: number;
}

export const swatchBomTable = pgTable("swatch_bom", {
  id: serial("id").primaryKey(),
  swatchOrderId: integer("swatch_order_id"),
  styleOrderId: integer("style_order_id"),
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
  targetVendorId: integer("target_vendor_id"),
  targetVendorName: text("target_vendor_name"),
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
  swatchOrderId: integer("swatch_order_id"),
  styleOrderId: integer("style_order_id"),
  referenceType: text("reference_type").notNull().default("Manual"),
  referenceId: integer("reference_id"),
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
  bomRowId: integer("bom_row_id"),
  swatchOrderId: integer("swatch_order_id"),
  styleOrderId: integer("style_order_id"),
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

export const consumptionLogTable = pgTable("consumption_log", {
  id: serial("id").primaryKey(),
  swatchOrderId: integer("swatch_order_id"),
  styleOrderId: integer("style_order_id"),
  styleOrderProductId: integer("style_order_product_id"),
  styleOrderProductName: text("style_order_product_name"),
  bomRowId: integer("bom_row_id").notNull(),
  materialCode: text("material_code").notNull(),
  materialName: text("material_name").notNull(),
  materialType: text("material_type").notNull(),
  unitType: text("unit_type").notNull().default(""),
  consumedQty: text("consumed_qty").notNull(),
  consumedBy: text("consumed_by").notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }).notNull().defaultNow(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ConsumptionLogRecord = typeof consumptionLogTable.$inferSelect;

// ─── Artisan Timesheet ───────────────────────────────────────────────────────
export const artisanTimesheetsTable = pgTable("artisan_timesheets", {
  id: serial("id").primaryKey(),
  swatchOrderId: integer("swatch_order_id"),
  styleOrderId: integer("style_order_id"),
  styleOrderProductId: integer("style_order_product_id"),
  styleOrderProductName: text("style_order_product_name"),
  noOfArtisans: integer("no_of_artisans").notNull().default(1),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  shiftType: text("shift_type").notNull().default("regular"),
  totalHours: text("total_hours").notNull().default("0"),
  hourlyRate: text("hourly_rate").notNull().default("0"),
  totalRate: text("total_rate").notNull().default("0"),
  notes: text("notes"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ArtisanTimesheetRecord = typeof artisanTimesheetsTable.$inferSelect;

// ─── Outsource Jobs ──────────────────────────────────────────────────────────
export const outsourceJobsTable = pgTable("outsource_jobs", {
  id: serial("id").primaryKey(),
  swatchOrderId: integer("swatch_order_id"),
  styleOrderId: integer("style_order_id"),
  styleOrderProductId: integer("style_order_product_id"),
  styleOrderProductName: text("style_order_product_name"),
  vendorId: integer("vendor_id").notNull(),
  vendorName: text("vendor_name").notNull(),
  hsnId: integer("hsn_id").notNull(),
  hsnCode: text("hsn_code").notNull(),
  gstPercentage: text("gst_percentage").notNull().default("5"),
  issueDate: text("issue_date").notNull(),
  targetDate: text("target_date"),
  deliveryDate: text("delivery_date"),
  totalCost: text("total_cost").notNull().default("0"),
  notes: text("notes"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OutsourceJobRecord = typeof outsourceJobsTable.$inferSelect;

// ─── Custom Charges ───────────────────────────────────────────────────────────
export const customChargesTable = pgTable("custom_charges", {
  id: serial("id").primaryKey(),
  swatchOrderId: integer("swatch_order_id"),
  styleOrderId: integer("style_order_id"),
  styleOrderProductId: integer("style_order_product_id"),
  styleOrderProductName: text("style_order_product_name"),
  vendorId: integer("vendor_id").notNull(),
  vendorName: text("vendor_name").notNull(),
  hsnId: integer("hsn_id").notNull(),
  hsnCode: text("hsn_code").notNull(),
  gstPercentage: text("gst_percentage").notNull().default("5"),
  description: text("description").notNull(),
  unitPrice: text("unit_price").notNull().default("0"),
  quantity: text("quantity").notNull().default("1"),
  totalAmount: text("total_amount").notNull().default("0"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CustomChargeRecord = typeof customChargesTable.$inferSelect;

// ─── Costing Payments ─────────────────────────────────────────────────────────
// Records actual payments made to vendors for outsource jobs, custom charges,
// and artwork outsource work. These appear as CREDITS in the vendor ledger.
export const costingPaymentsTable = pgTable("costing_payments", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").notNull(),
  vendorName: text("vendor_name"),
  referenceType: text("reference_type").notNull(), // 'outsource_job' | 'custom_charge' | 'artwork_swatch' | 'artwork_style'
  referenceId: integer("reference_id").notNull(),   // id in the source table
  swatchOrderId: integer("swatch_order_id"),
  styleOrderId: integer("style_order_id"),
  paymentType: text("payment_type"),   // Advance | Partial | Full
  paymentMode: text("payment_mode"),   // Cash | Bank Transfer | UPI | Cheque | Other
  paymentAmount: numeric("payment_amount", { precision: 12, scale: 2 }).notNull(),
  paymentStatus: text("payment_status").default("Pending"), // Pending | Processing | Completed | Failed
  transactionId: text("transaction_id"),
  paymentDate: timestamp("payment_date", { withTimezone: true }),
  remarks: text("remarks"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CostingPaymentRecord = typeof costingPaymentsTable.$inferSelect;

// ─── BOM Change Log ───────────────────────────────────────────────────────────
export const bomChangeLogTable = pgTable("bom_change_log", {
  id: serial("id").primaryKey(),
  bomRowId: integer("bom_row_id").notNull(),
  bomType: text("bom_type").notNull(), // 'Swatch' | 'Style'
  orderId: integer("order_id").notNull(),
  inventoryId: integer("inventory_id"),
  materialCode: text("material_code").notNull(),
  materialName: text("material_name").notNull(),
  oldQty: text("old_qty").notNull(),
  newQty: text("new_qty").notNull(),
  delta: text("delta").notNull(),
  reservationDelta: text("reservation_delta"),
  notes: text("notes"),
  changedBy: text("changed_by").notNull(),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BomChangeLogRecord = typeof bomChangeLogTable.$inferSelect;
