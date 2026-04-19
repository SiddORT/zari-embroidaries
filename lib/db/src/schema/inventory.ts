import { pgTable, serial, text, numeric, timestamp, boolean, integer, unique, jsonb } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const inventoryItemsTable = pgTable(
  "inventory_items",
  {
    id: serial("id").primaryKey(),
    sourceType: text("source_type").notNull(),
    sourceId: integer("source_id").notNull(),
    itemName: text("item_name").notNull(),
    itemCode: text("item_code").notNull(),
    category: text("category"),
    department: text("department"),
    warehouseLocation: text("warehouse_location"),
    unitType: text("unit_type"),
    currentStock: numeric("current_stock", { precision: 14, scale: 3 }).notNull().default("0"),
    styleReservedQty: numeric("style_reserved_qty", { precision: 14, scale: 3 }).notNull().default("0"),
    swatchReservedQty: numeric("swatch_reserved_qty", { precision: 14, scale: 3 }).notNull().default("0"),
    availableStock: numeric("available_stock", { precision: 14, scale: 3 }).notNull().default("0"),
    averagePrice: numeric("average_price", { precision: 14, scale: 2 }).notNull().default("0"),
    lastPurchasePrice: numeric("last_purchase_price", { precision: 14, scale: 2 }).notNull().default("0"),
    minimumLevel: numeric("minimum_level", { precision: 14, scale: 3 }).notNull().default("0"),
    reorderLevel: numeric("reorder_level", { precision: 14, scale: 3 }).notNull().default("0"),
    maximumLevel: numeric("maximum_level", { precision: 14, scale: 3 }).notNull().default("0"),
    preferredVendor: text("preferred_vendor"),
    lastVendor: text("last_vendor"),
    images: jsonb("images").$type<{ id: string; name: string; data: string; size: number }[]>().notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("inventory_items_source_unique").on(t.sourceType, t.sourceId)]
);

export type InventoryItemRecord = typeof inventoryItemsTable.$inferSelect;

export const inventoryStockLogsTable = pgTable("inventory_stock_logs", {
  id: serial("id").primaryKey(),
  inventoryItemId: integer("inventory_item_id").notNull(),
  actionType: text("action_type").notNull(),
  quantityBefore: numeric("quantity_before", { precision: 14, scale: 3 }).notNull().default("0"),
  quantityAfter: numeric("quantity_after", { precision: 14, scale: 3 }).notNull().default("0"),
  quantityDelta: numeric("quantity_delta", { precision: 14, scale: 3 }).notNull().default("0"),
  referenceType: text("reference_type"),
  referenceId: integer("reference_id"),
  notes: text("notes"),
  createdByName: text("created_by_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type InventoryStockLog = typeof inventoryStockLogsTable.$inferSelect;

export const stockLedgerTable = pgTable("stock_ledger", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull(),
  transactionType: text("transaction_type").notNull(),
  referenceNumber: text("reference_number"),
  referenceType: text("reference_type"),
  inQuantity: numeric("in_quantity", { precision: 14, scale: 3 }).notNull().default("0"),
  outQuantity: numeric("out_quantity", { precision: 14, scale: 3 }).notNull().default("0"),
  balanceQuantity: numeric("balance_quantity", { precision: 14, scale: 3 }).notNull().default("0"),
  remarks: text("remarks"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type StockLedgerRecord = typeof stockLedgerTable.$inferSelect;

export const materialReservationsTable = pgTable("material_reservations", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull(),
  inventoryId: integer("inventory_id").notNull(),
  reservationType: text("reservation_type").notNull(),
  referenceId: integer("reference_id").notNull(),
  reservedQuantity: numeric("reserved_quantity", { precision: 14, scale: 3 }).notNull(),
  status: text("status").notNull().default("Active"),
  remarks: text("remarks"),
  reservedBy: text("reserved_by"),
  reservationDate: text("reservation_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MaterialReservation = typeof materialReservationsTable.$inferSelect;

export const stockAdjustmentsTable = pgTable("stock_adjustments", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull(),
  inventoryId: integer("inventory_id").notNull(),
  adjustmentType: text("adjustment_type").notNull(),
  adjustmentDirection: text("adjustment_direction").notNull(),
  adjustmentQuantity: numeric("adjustment_quantity", { precision: 14, scale: 3 }).notNull(),
  unit: text("unit"),
  averagePriceAtAdjustment: numeric("average_price_at_adjustment", { precision: 14, scale: 2 }).notNull().default("0"),
  revenueLossAmount: numeric("revenue_loss_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  referenceType: text("reference_type").notNull().default("Manual"),
  referenceId: text("reference_id"),
  reason: text("reason"),
  remarks: text("remarks"),
  adjustedBy: text("adjusted_by"),
  adjustmentDate: text("adjustment_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type StockAdjustment = typeof stockAdjustmentsTable.$inferSelect;

export const updateInventoryStockSchema = z.object({
  warehouseLocation: z.string().optional(),
  currentStock: z.string().min(1, "Opening quantity is required"),
  averagePrice: z.string().optional(),
  lastPurchasePrice: z.string().optional(),
  minimumLevel: z.string().optional(),
  reorderLevel: z.string().optional(),
  maximumLevel: z.string().optional(),
  department: z.string().optional(),
});

export type UpdateInventoryStock = z.infer<typeof updateInventoryStockSchema>;
