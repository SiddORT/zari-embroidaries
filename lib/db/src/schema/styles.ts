import { pgTable, serial, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const stylesTable = pgTable("styles", {
  id: serial("id").primaryKey(),
  client: text("client").notNull(),
  styleNo: text("style_no").notNull(),
  invoiceNo: text("invoice_no"),
  description: text("description"),
  attachLink: text("attach_link"),
  placeOfIssue: text("place_of_issue"),
  vendorPoNo: text("vendor_po_no"),
  shippingDate: text("shipping_date"),
  styleCategory: text("style_category").notNull(),
  referenceSwatchId: text("reference_swatch_id"),
  wipMedia: jsonb("wip_media").default([]),
  finalMedia: jsonb("final_media").default([]),
  isActive: boolean("is_active").notNull().default(true),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export type StyleRecord = typeof stylesTable.$inferSelect;

export const insertStyleSchema = z.object({
  client: z.string().min(1, "Client is required"),
  styleNo: z.string().optional(),
  invoiceNo: z.string().optional(),
  description: z.string().optional(),
  attachLink: z.string().optional(),
  placeOfIssue: z.string().optional(),
  vendorPoNo: z.string().optional(),
  shippingDate: z.string().optional(),
  styleCategory: z.string().min(1, "Style Category is required"),
  referenceSwatchId: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const updateStyleSchema = insertStyleSchema.partial().extend({
  updatedBy: z.string().optional(),
});

export type InsertStyle = z.infer<typeof insertStyleSchema>;
export type UpdateStyle = z.infer<typeof updateStyleSchema>;
