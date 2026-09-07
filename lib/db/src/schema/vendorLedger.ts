import { pgTable, serial, integer, text, timestamp, boolean, numeric } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const vendorPaymentsTable = pgTable("vendor_payments", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").notNull(),
  vendorName: text("vendor_name").notNull(),
  paymentDate: timestamp("payment_date", { withTimezone: true }).notNull().defaultNow(),
  amount: text("amount").notNull(),
  currencyCode: text("currency_code").notNull().default("INR"),
  exchangeRateSnapshot: numeric("exchange_rate_snapshot", { precision: 18, scale: 6 }).notNull().default("1"),
  baseCurrencyAmount: numeric("base_currency_amount", { precision: 18, scale: 2 }).notNull().default("0"),
  paymentMode: text("payment_mode").notNull().default("Bank Transfer"),
  referenceNo: text("reference_no"),
  notes: text("notes"),
  vendorInvoiceLedgerId: integer("vendor_invoice_ledger_id"),
  orderType: text("order_type").notNull().default("general"),
  styleOrderId: integer("style_order_id"),
  styleOrderCode: text("style_order_code"),
  swatchOrderId: integer("swatch_order_id"),
  swatchOrderCode: text("swatch_order_code"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const vendorLedgerChargesTable = pgTable("vendor_ledger_charges", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").notNull(),
  vendorName: text("vendor_name").notNull(),
  chargeDate: timestamp("charge_date", { withTimezone: true }).notNull().defaultNow(),
  description: text("description").notNull(),
  hsnId: integer("hsn_id"),
  hsnCode: text("hsn_code"),
  gstPercentage: numeric("gst_percentage", { precision: 5, scale: 2 }).default('0'),
  amount: text("amount").notNull(),
  notes: text("notes"),
  orderType: text("order_type").notNull().default("general"),
  orderId: integer("order_id"),
  styleOrderId: integer("style_order_id"),
  styleOrderCode: text("style_order_code"),
  swatchOrderId: integer("swatch_order_id"),
  swatchOrderCode: text("swatch_order_code"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const insertVendorPaymentSchema = z.object({
  vendorId: z.number().int().positive(),
  vendorName: z.string().min(1),
  paymentDate: z.string().optional(),
  amount: z.string().min(1),
  paymentMode: z.string().min(1),
  referenceNo: z.string().optional(),
  notes: z.string().optional(),
  orderType: z.enum(["general", "style", "swatch"]).default("general"),
  styleOrderId: z.number().int().optional(),
  styleOrderCode: z.string().optional(),
  swatchOrderId: z.number().int().optional(),
  swatchOrderCode: z.string().optional(),
});

export const insertVendorLedgerChargeSchema = z.object({
  vendorId: z.number().int().positive(),
  vendorName: z.string().min(1),
  chargeDate: z.string().optional(),
  description: z.string().min(1),
  amount: z.string().min(1),
  notes: z.string().optional(),
  orderType: z.enum(["general", "style", "swatch"]).default("general"),
  styleOrderId: z.number().int().optional(),
  styleOrderCode: z.string().optional(),
  swatchOrderId: z.number().int().optional(),
  swatchOrderCode: z.string().optional(),
});

export type VendorPayment = typeof vendorPaymentsTable.$inferSelect;
export type VendorLedgerCharge = typeof vendorLedgerChargesTable.$inferSelect;
export type InsertVendorPayment = z.infer<typeof insertVendorPaymentSchema>;
export type InsertVendorLedgerCharge = z.infer<typeof insertVendorLedgerChargeSchema>;
