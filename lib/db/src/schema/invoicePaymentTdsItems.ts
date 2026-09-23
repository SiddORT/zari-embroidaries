import { pgTable, serial, integer, text, numeric, boolean, timestamp, } from "drizzle-orm/pg-core";
import {invoicePaymentTds} from "./invoicePaymentTds";
import {invoiceLineItemsTable} from "./invoiceLineItems";
import {invoicePaymentItemsTable} from "./invoicePaymentItems";

export const invoicePaymentTdsItems = pgTable("invoice_payment_tds_items", {
  id: serial("id").primaryKey(),

  invoicePaymentTdsId: integer("invoice_payment_tds_id")
    .notNull()
    .references(() => invoicePaymentTds.id, { onDelete: "restrict" }),

  // Link to the real invoice line item
  invoiceLineItemId: integer("invoice_line_item_id")
    .notNull()
    .references(() => invoiceLineItemsTable.id, { onDelete: "restrict" }),

  // Optional: link to the waterfall allocation row
  paymentItemId: integer("payment_item_id")
    .references(() => invoicePaymentItemsTable.id, { onDelete: "cascade" }),

  // Amounts (identical naming to your existing payment_tds_items)
  baseAmount: numeric("base_amount", { precision: 15, scale: 2 }).notNull(),
  gstAmount: numeric("gst_amount", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  gstPercentage: numeric("gst_percentage", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
  tdsRate: numeric("tds_rate", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  tdsAmount: numeric("tds_amount", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  paidAmount: numeric("paid_amount", { precision: 15, scale: 2 }).notNull(),

  // Audit
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});