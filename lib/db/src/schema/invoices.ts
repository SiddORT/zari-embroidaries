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
  swatchOrderId: integer("swatch_order_id").notNull(),
  invoiceDate: text("invoice_date").notNull(),
  dueDate: text("due_date").default(""),
  clientName: text("client_name").default(""),
  clientAddress: text("client_address").default(""),
  clientGstin: text("client_gstin").default(""),
  clientEmail: text("client_email").default(""),
  items: jsonb("items").notNull().default([]),
  discountType: text("discount_type").default("flat"),
  discountValue: text("discount_value").default("0"),
  taxLabel: text("tax_label").default("GST"),
  taxRate: text("tax_rate").default("0"),
  notes: text("notes").default(""),
  paymentTerms: text("payment_terms").default(""),
  status: text("status").default("Draft"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
