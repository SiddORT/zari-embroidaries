import { pgTable, serial, text, boolean, timestamp, jsonb, numeric } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const materialsTable = pgTable("materials", {
  id: serial("id").primaryKey(),
  materialCode: text("material_code").notNull().unique(),
  materialName: text("material_name"),
  itemType: text("item_type").notNull().default(""),
  quality: text("quality").notNull(),
  type: text("type"),
  color: text("color"),
  hexCode: text("hex_code"),
  colorName: text("color_name").notNull(),
  size: text("size").notNull(),
  unitPrice: text("unit_price").notNull(),
  unitType: text("unit_type").notNull(),
  currentStock: text("current_stock").notNull(),
  locationStocks: jsonb("location_stocks").$type<{ location: string; stock: string }[]>().notNull().default([]),
  hsnCode: text("hsn_code").notNull(),
  gstPercent: text("gst_percent").notNull(),
  vendor: text("vendor"),
  location: text("location"),
  images: jsonb("images").$type<{ id: string; name: string; data: string; size: number }[]>().notNull().default([]),
  reorderLevel: numeric("reorder_level", { precision: 14, scale: 3 }),
  minimumLevel: numeric("minimum_level", { precision: 14, scale: 3 }),
  maximumLevel: numeric("maximum_level", { precision: 14, scale: 3 }),
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

export const locationStockSchema = z.object({
  location: z.string(),
  stock: z.string(),
});

const NAME_REGEX = /^[A-Za-z]+( [A-Za-z]+)*$/;
const NUMERIC_REGEX = /^[0-9]+(\.[0-9]{1,2})?$/;

export const insertMaterialSchema = z.object({
  materialName: z.string().optional(),
  itemType: z.string().trim().refine((v) => !v || NAME_REGEX.test(v), { message: "Item Type must contain only letters and spaces (max 100 characters)." }).optional().default(""),
  quality: z.string().trim().min(1, "Quality is required").refine((v) => NAME_REGEX.test(v), { message: "Quality must contain only letters and spaces." }),
  type: z.string().trim().refine((v) => !v || NAME_REGEX.test(v), { message: "Type must contain only letters and spaces." }).optional(),
  color: z.string().optional(),
  hexCode: z.string().optional(),
  colorName: z.string().trim().min(1, "Color Name is required").refine((v) => NAME_REGEX.test(v), { message: "Color Name must contain only letters and spaces." }),
  size: z.string().trim().min(1, "Size is required").refine((v) => NUMERIC_REGEX.test(v), { message: "Size must be a positive numeric value." }),
  unitPrice: z.string().trim().min(1, "Unit Price is required").refine((v) => NUMERIC_REGEX.test(v), { message: "Unit Price must be a positive numeric value." }),
  unitType: z.string().trim().min(1, "Unit Type is required").refine((v) => NAME_REGEX.test(v), { message: "Unit Type must contain only letters." }),
  currentStock: z.string().trim().min(1, "Current Stock is required").refine((v) => NUMERIC_REGEX.test(v), { message: "Current Stock must be a positive numeric value." }),
  locationStocks: z.array(locationStockSchema).optional().default([]),
  hsnCode: z.string().trim().min(1, "HSN Code is required"),
  gstPercent: z.string().min(1, "GST % is required"),
  vendor: z.string().optional(),
  location: z.string().optional(),
  isActive: z.boolean().default(true),
  images: z.array(masterImageSchema).optional().default([]),
  reorderLevel: z.string().optional(),
  minimumLevel: z.string().optional(),
  maximumLevel: z.string().optional(),
});

export const updateMaterialSchema = insertMaterialSchema.partial().extend({
  updatedBy: z.string().optional(),
});

export type InsertMaterial = z.infer<typeof insertMaterialSchema>;
export type UpdateMaterial = z.infer<typeof updateMaterialSchema>;
