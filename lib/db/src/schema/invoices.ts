import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export interface InvoiceLineItem {
  id: string;
  description: string;
  category: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNo: text("invoice_no").notNull().unique(),
  swatchOrderId: integer("swatch_order_id"),
  styleOrderId: integer("style_order_id"),
  invoiceDate: text("invoice_date").notNull(),
  dueDate: text("due_date").default(""),

  // Client details
  clientName: text("client_name").default(""),
  clientAddress: text("client_address").default(""),
  clientGstin: text("client_gstin").default(""),
  clientEmail: text("client_email").default(""),
  clientPhone: text("client_phone").default(""),
  clientState: text("client_state").default(""),

  // Line items
  items: jsonb("items").notNull().default([]),

  // Discount
  discountType: text("discount_type").default("flat"),
  discountValue: text("discount_value").default("0"),

  // Tax — CGST + SGST
  cgstRate: text("cgst_rate").default("0"),
  sgstRate: text("sgst_rate").default("0"),

  // Bank details
  bankName: text("bank_name").default(""),
  bankAccount: text("bank_account").default(""),
  bankIfsc: text("bank_ifsc").default(""),
  bankBranch: text("bank_branch").default(""),
  bankUpi: text("bank_upi").default(""),

  // Notes
  notes: text("notes").default(""),
  paymentTerms: text("payment_terms").default(""),
  status: text("status").default("Draft"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
