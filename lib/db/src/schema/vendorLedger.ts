import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const vendorPaymentsTable = pgTable("vendor_payments", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").notNull(),
  vendorName: text("vendor_name").notNull(),
  paymentDate: timestamp("payment_date", { withTimezone: true }).notNull().defaultNow(),
  amount: text("amount").notNull(),
  paymentMode: text("payment_mode").notNull().default("Bank Transfer"),
  referenceNo: text("reference_no"),
  notes: text("notes"),
  orderType: text("order_type").notNull().default("general"),
  styleOrderId: integer("style_order_id"),
  styleOrderCode: text("style_order_code"),
  swatchOrderId: integer("swatch_order_id"),
  swatchOrderCode: text("swatch_order_code"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const vendorLedgerChargesTable = pgTable("vendor_ledger_charges", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").notNull(),
  vendorName: text("vendor_name").notNull(),
  chargeDate: timestamp("charge_date", { withTimezone: true }).notNull().defaultNow(),
  description: text("description").notNull(),
  amount: text("amount").notNull(),
  notes: text("notes"),
  orderType: text("order_type").notNull().default("general"),
  styleOrderId: integer("style_order_id"),
  styleOrderCode: text("style_order_code"),
  swatchOrderId: integer("swatch_order_id"),
  swatchOrderCode: text("swatch_order_code"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
