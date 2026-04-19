import { pgTable, serial, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const materialsTable = pgTable("materials", {
  id: serial("id").primaryKey(),
  materialCode: text("material_code").notNull().unique(),
  itemType: text("item_type").notNull(),
  quality: text("quality").notNull(),
  type: text("type"),
  color: text("color"),
  hexCode: text("hex_code"),
  colorName: text("color_name").notNull(),
  size: text("size").notNull(),
  unitPrice: text("unit_price").notNull(),
  unitType: text("unit_type").notNull(),
  currentStock: text("current_stock").notNull(),
  hsnCode: text("hsn_code").notNull(),
  gstPercent: text("gst_percent").notNull(),
  vendor: text("vendor"),
  location: text("location"),
  images: jsonb("images").$type<{ id: string; name: string; data: string; size: number }[]>().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export type MaterialRecord = typeof materialsTable.$inferSelect;

export const masterImageSchema = z.object({
  id: z.string(),
  name: z.string(),
  data: z.string(),
  size: z.number(),
});

export const insertMaterialSchema = z.object({
  itemType: z.string().min(1, "Item Type is required"),
  quality: z.string().min(1, "Quality is required"),
  type: z.string().optional(),
  color: z.string().optional(),
  hexCode: z.string().optional(),
  colorName: z.string().min(1, "Color Name is required"),
  size: z.string().min(1, "Size is required"),
  unitPrice: z.string().min(1, "Unit Price is required"),
  unitType: z.string().min(1, "Unit Type is required"),
  currentStock: z.string().min(1, "Current Stock is required"),
  hsnCode: z.string().min(1, "HSN Code is required"),
  gstPercent: z.string().min(1, "GST % is required"),
  vendor: z.string().optional(),
  location: z.string().optional(),
  isActive: z.boolean().default(true),
  images: z.array(masterImageSchema).optional().default([]),
});

export const updateMaterialSchema = insertMaterialSchema.partial().extend({
  updatedBy: z.string().optional(),
});

export type InsertMaterial = z.infer<typeof insertMaterialSchema>;
export type UpdateMaterial = z.infer<typeof updateMaterialSchema>;
