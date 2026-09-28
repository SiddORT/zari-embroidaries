import { pgTable, serial, integer, varchar, text, numeric, boolean, timestamp, index, } from "drizzle-orm/pg-core";
import { invoicesTable } from "./invoices"; 
import {tdsMasterTable} from "./tdsMaster";
import {invoicePayments} from "./extended";
import {clientsTable} from "./clients";

export const invoicePaymentTds = pgTable("invoice_payment_tds", {
  id: serial("id").primaryKey(),

  // Selected TDS rule (same master you already use)
  tdsMasterId: integer("tds_master_id")
    .notNull()
    .references(() => tdsMasterTable.id, { onDelete: "restrict" }),

  // Link to the actual payment
  paymentId: integer("payment_id")
    .notNull()
    .references(() => invoicePayments.paymentId, { onDelete: "cascade" }),

  paymentDate: timestamp("payment_date", { withTimezone: true }).notNull(),

  // Client who deducted the TDS
  clientId: integer("client_id")
    .notNull()
    .references(() => clientsTable.id, { onDelete: "restrict" }),

  // Source invoice
  invoiceId: integer("invoice_id")
    .notNull()
    .references(() => invoicesTable.id, { onDelete: "cascade" }),

  // Amounts (same naming style as your vendor tables)
  grossAmount: numeric("gross_amount", { precision: 15, scale: 2 })
    .notNull()
    .default("0"), // Total before TDS = baseAmount + gstAmount

  gstAmount: numeric("gst_amount", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),

  gstPercentage: numeric("gst_percentage", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),

  paymentCurrencyCode: varchar("payment_currency_code", { length: 10 }),
  paymentExchangeRate: numeric("payment_exchange_rate", { precision: 15, scale: 6 }),

  // TDS calculation snapshot
  baseAmount: numeric("base_amount", { precision: 15, scale: 2 }).notNull(), // taxable amount
  paidAmount: numeric("paid_amount", { precision: 15, scale: 2 }).notNull(), // net received
  tdsRate: numeric("tds_rate", { precision: 5, scale: 2 }).notNull(),
  tdsAmount: numeric("tds_amount", { precision: 15, scale: 2 }).notNull(),

  // Status
  status: text("status").notNull().default("DEDUCTED"), 

  // Audit
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});