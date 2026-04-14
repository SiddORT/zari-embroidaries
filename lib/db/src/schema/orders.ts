import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderId: text("order_id").notNull().unique(),
  orderType: text("order_type").notNull(),

  client: text("client").notNull(),
  status: text("status").notNull().default("Pending"),
  priority: text("priority").notNull().default("Medium"),
  assignedTo: text("assigned_to"),
  deliveryDate: text("delivery_date"),
  remarks: text("remarks"),
  productionMode: text("production_mode").notNull().default("in-house"),

  costStatus: text("cost_status").notNull().default("Pending"),
  approvalStatus: text("approval_status").notNull().default("Pending"),
  invoiceStatus: text("invoice_status").notNull().default("Not Issued"),
  invoiceNumber: text("invoice_number"),
  paymentStatus: text("payment_status").notNull().default("Unpaid"),

  fabric: text("fabric"),
  swatchLength: text("swatch_length"),
  swatchWidth: text("swatch_width"),
  quantity: text("quantity"),
  referenceSwatchId: text("reference_swatch_id"),
  referenceStyleId: text("reference_style_id"),

  product: text("product"),
  pattern: text("pattern"),
  sizeBreakdown: text("size_breakdown"),
  colorVariants: text("color_variants"),

  materials: text("materials"),
  consumption: text("consumption"),
  artisanAssignment: text("artisan_assignment"),
  outsourceAssignment: text("outsource_assignment"),

  artworkHours: text("artwork_hours"),
  artworkRate: text("artwork_rate"),
  artworkFeedback: text("artwork_feedback"),

  materialCost: text("material_cost"),
  artisanCost: text("artisan_cost"),
  outsourceCost: text("outsource_cost"),
  customCharges: text("custom_charges"),
  totalCost: text("total_cost"),

  clientComments: text("client_comments"),
  shareLink: text("share_link"),

  isDeleted: boolean("is_deleted").notNull().default(false),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export type OrderRecord = typeof ordersTable.$inferSelect;

export const insertOrderSchema = z.object({
  orderType: z.enum(["swatch", "style"]),
  client: z.string().min(1, "Client is required"),
  status: z.string().default("Pending"),
  priority: z.string().default("Medium"),
  assignedTo: z.string().optional(),
  deliveryDate: z.string().optional(),
  remarks: z.string().optional(),
  productionMode: z.string().default("in-house"),
  costStatus: z.string().default("Pending"),
  approvalStatus: z.string().default("Pending"),
  invoiceStatus: z.string().default("Not Issued"),
  invoiceNumber: z.string().optional(),
  paymentStatus: z.string().default("Unpaid"),
  fabric: z.string().optional(),
  swatchLength: z.string().optional(),
  swatchWidth: z.string().optional(),
  quantity: z.string().optional(),
  referenceSwatchId: z.string().optional(),
  referenceStyleId: z.string().optional(),
  product: z.string().optional(),
  pattern: z.string().optional(),
  sizeBreakdown: z.string().optional(),
  colorVariants: z.string().optional(),
  materials: z.string().optional(),
  consumption: z.string().optional(),
  artisanAssignment: z.string().optional(),
  outsourceAssignment: z.string().optional(),
  artworkHours: z.string().optional(),
  artworkRate: z.string().optional(),
  artworkFeedback: z.string().optional(),
  materialCost: z.string().optional(),
  artisanCost: z.string().optional(),
  outsourceCost: z.string().optional(),
  customCharges: z.string().optional(),
  totalCost: z.string().optional(),
  clientComments: z.string().optional(),
  shareLink: z.string().optional(),
});

export const updateOrderSchema = insertOrderSchema.partial().extend({
  updatedBy: z.string().optional(),
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type UpdateOrder = z.infer<typeof updateOrderSchema>;
