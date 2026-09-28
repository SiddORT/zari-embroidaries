import { pgTable, serial, integer, varchar, text, numeric, boolean, timestamp, index, } from "drizzle-orm/pg-core";
import { invoicesTable } from "./invoices"; 

export const invoiceLineItemsTable = pgTable(
  "invoice_line_items",
  {
    id: serial("id").primaryKey(),
    invoiceId: integer("invoice_id") .notNull() .references(() => invoicesTable.id, { onDelete: "cascade" }),
    lineNo: integer("line_no").notNull().default(1),

    description: text("description").notNull().default(""),
    category: varchar("category", { length: 50 }).notNull().default("Item"),
    quantity: numeric("quantity", { precision: 18, scale: 4 }).notNull().default("1"),
    unitPrice: numeric("unit_price", { precision: 18, scale: 4 }).notNull().default("0"),
    total: numeric("total", { precision: 18, scale: 4 }).notNull().default("0"), 
    hsnCode: varchar("hsn_code", { length: 20 }).default(""),
    hsnGstPct: varchar("hsn_gst_pct", { length: 10 }).default(""), 
    showHsn: boolean("show_hsn").notNull().default(true),
    unit: varchar("unit", { length: 30 }).default(""), 

    isDeleted: boolean("is_deleted").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: varchar("deleted_by", { length: 100 }),

    isLocked: boolean("is_locked").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    invoiceIdIdx: index("idx_invoice_line_items_invoice_id").on(table.invoiceId),
    invoiceLineNoIdx: index("idx_invoice_line_items_invoice_line_no").on(
      table.invoiceId,
      table.lineNo
    ),
  })
);
