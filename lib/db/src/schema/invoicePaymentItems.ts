import { pgTable, serial, integer, varchar, text, numeric, timestamp, } from "drizzle-orm/pg-core";
import {invoicePayments} from "./extended";
import { invoicesTable } from "./invoices"; 
import {invoiceLineItemsTable} from "./invoiceLineItems";

export const invoicePaymentItemsTable = pgTable(
  "invoice_payment_items",
  {
    id: serial("id").primaryKey(),

    paymentId: integer("payment_id")
      .notNull()
      .references(() => invoicePayments.paymentId, { onDelete: "cascade" }),

    invoiceId: integer("invoice_id")
      .notNull()
      .references(() => invoicesTable.id, { onDelete: "cascade" }),

    invoiceLineItemId: integer("invoice_line_item_id")
      .notNull()
      .references(() => invoiceLineItemsTable.id, { onDelete: "restrict" }),

    allocatedGrossAmount: numeric("allocated_gross_amount", { precision: 18, scale: 4 }).notNull(),
    allocatedTaxableAmount: numeric("allocated_taxable_amount", { precision: 18, scale: 4 }).notNull().default("0"),
    netReceivedAmount: numeric("net_received_amount", { precision: 18, scale: 4 }).notNull(),

    allocationSequence: integer("allocation_sequence").notNull().default(1),
    remarks: text("remarks").default(""),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: varchar("created_by", { length: 100 }),
  },
);