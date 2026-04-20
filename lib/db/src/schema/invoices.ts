import { pgTable, serial, integer, text, numeric, jsonb, timestamp } from "drizzle-orm/pg-core";

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

  // Direction & type
  invoiceDirection: text("invoice_direction").default("Client"),         // Client | Vendor
  invoiceType: text("invoice_type").default("Final Invoice"),            // Proforma | Advance | Partial | Material Recovery | Artwork Charges | Courier Charges | Final Invoice | Custom
  invoiceStatus: text("invoice_status").default("Draft"),               // Draft | Sent | Paid | Partial | Cancelled

  // Parties
  clientId: integer("client_id"),
  vendorId: integer("vendor_id"),

  // Reference linking
  referenceType: text("reference_type").default("Manual"),              // Swatch | Style | Quotation | Purchase Receipt | Shipping | Artwork | Manual
  referenceId: text("reference_id").default(""),

  // Multi-currency
  currencyCode: text("currency_code").default("INR"),
  exchangeRateSnapshot: numeric("exchange_rate_snapshot", { precision: 18, scale: 6 }).default("1"),

  // Amounts
  subtotalAmount: numeric("subtotal_amount", { precision: 18, scale: 2 }).default("0"),
  shippingAmount: numeric("shipping_amount", { precision: 18, scale: 2 }).default("0"),
  adjustmentAmount: numeric("adjustment_amount", { precision: 18, scale: 2 }).default("0"),
  totalAmount: numeric("total_amount", { precision: 18, scale: 2 }).default("0"),
  invoiceCurrencyAmount: numeric("invoice_currency_amount", { precision: 18, scale: 2 }).default("0"),
  baseCurrencyAmount: numeric("base_currency_amount", { precision: 18, scale: 2 }).default("0"),
  receivedAmount: numeric("received_amount", { precision: 18, scale: 2 }).default("0"),
  pendingAmount: numeric("pending_amount", { precision: 18, scale: 2 }).default("0"),

  // Dates
  invoiceDate: text("invoice_date").notNull(),
  dueDate: text("due_date").default(""),

  // Legacy client details (kept for backward compat)
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

  // Tax
  cgstRate: text("cgst_rate").default("0"),
  sgstRate: text("sgst_rate").default("0"),

  // Bank details
  bankName: text("bank_name").default(""),
  bankAccount: text("bank_account").default(""),
  bankIfsc: text("bank_ifsc").default(""),
  bankBranch: text("bank_branch").default(""),
  bankUpi: text("bank_upi").default(""),

  // Shipping & tracking
  shippingAddress: text("shipping_address").default(""),
  carrier: text("carrier").default(""),
  trackingNumber: text("tracking_number").default(""),
  dispatchDate: text("dispatch_date").default(""),
  expectedDelivery: text("expected_delivery").default(""),

  // Notes
  remarks: text("remarks").default(""),
  notes: text("notes").default(""),
  paymentTerms: text("payment_terms").default(""),

  // Legacy (kept for orders that already linked)
  swatchOrderId: integer("swatch_order_id"),
  styleOrderId: integer("style_order_id"),

  // Audit
  createdBy: text("created_by").default(""),
  status: text("status").default("Draft"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
