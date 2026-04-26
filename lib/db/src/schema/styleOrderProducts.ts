import { pgTable, serial, integer, text, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const styleOrderProductsTable = pgTable("style_order_products", {
  id: serial("id").primaryKey(),
  styleOrderId: integer("style_order_id").notNull(),

  productName: text("product_name").notNull(),
  styleCategoryId: text("style_category_id"),
  styleCategoryName: text("style_category_name"),
  productStatus: text("product_status").notNull().default("Draft"),

  fabricId: text("fabric_id"),
  fabricName: text("fabric_name"),
  hasLining: boolean("has_lining").notNull().default(false),
  liningFabricId: text("lining_fabric_id"),
  liningFabricName: text("lining_fabric_name"),
  unitLength: text("unit_length"),
  unitWidth: text("unit_width"),
  unitType: text("unit_type"),

  orderIssueDate: text("order_issue_date"),
  deliveryDate: text("delivery_date"),
  targetHours: text("target_hours"),
  issuedTo: text("issued_to"),
  department: text("department"),

  refDocs: jsonb("ref_docs").default([]),
  refImages: jsonb("ref_images").default([]),

  patternType: text("pattern_type"),
  patternMakingCost: text("pattern_making_cost"),
  patternDoc: jsonb("pattern_doc").default([]),
  patternOuthouseDoc: jsonb("pattern_outhouse_doc").default([]),
  patternVendorId: text("pattern_vendor_id"),
  patternVendorName: text("pattern_vendor_name"),
  patternPaymentType: text("pattern_payment_type"),
  patternPaymentMode: text("pattern_payment_mode"),
  patternPaymentStatus: text("pattern_payment_status").default("Pending"),
  patternPaymentAmount: text("pattern_payment_amount"),
  patternTransactionId: text("pattern_transaction_id"),
  patternPaymentDate: text("pattern_payment_date"),
  patternRemarks: text("pattern_remarks"),

  isDeleted: boolean("is_deleted").notNull().default(false),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export type StyleOrderProductRecord = typeof styleOrderProductsTable.$inferSelect;

const fileAttachmentSchema = z.object({
  name: z.string(),
  type: z.string(),
  data: z.string(),
  size: z.number(),
});

export const insertStyleOrderProductSchema = z.object({
  styleOrderId: z.number(),
  productName: z.string().min(1, "Product Name is required"),
  styleCategoryId: z.string().optional(),
  styleCategoryName: z.string().optional(),
  productStatus: z.string().default("Draft"),
  fabricId: z.string().optional(),
  fabricName: z.string().optional(),
  hasLining: z.boolean().default(false),
  liningFabricId: z.string().optional(),
  liningFabricName: z.string().optional(),
  unitLength: z.string().optional(),
  unitWidth: z.string().optional(),
  unitType: z.string().optional(),
  orderIssueDate: z.string().optional(),
  deliveryDate: z.string().optional(),
  targetHours: z.string().optional(),
  issuedTo: z.string().optional(),
  department: z.string().optional(),
  refDocs: z.array(fileAttachmentSchema).default([]),
  refImages: z.array(fileAttachmentSchema).default([]),
  patternType: z.string().optional(),
  patternMakingCost: z.string().optional(),
  patternDoc: z.array(fileAttachmentSchema).default([]),
  patternOuthouseDoc: z.array(fileAttachmentSchema).default([]),
  patternVendorId: z.string().optional(),
  patternVendorName: z.string().optional(),
  patternPaymentType: z.string().optional(),
  patternPaymentMode: z.string().optional(),
  patternPaymentStatus: z.string().optional(),
  patternPaymentAmount: z.string().optional(),
  patternTransactionId: z.string().optional(),
  patternPaymentDate: z.string().optional(),
  patternRemarks: z.string().optional(),
});

export const updateStyleOrderProductSchema = insertStyleOrderProductSchema.partial().extend({
  updatedBy: z.string().optional(),
});

export type InsertStyleOrderProduct = z.infer<typeof insertStyleOrderProductSchema>;
export type UpdateStyleOrderProduct = z.infer<typeof updateStyleOrderProductSchema>;
