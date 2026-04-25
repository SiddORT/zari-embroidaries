import { pgTable, serial, text, boolean, timestamp, jsonb, numeric } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const fabricsTable = pgTable("fabrics", {
  id: serial("id").primaryKey(),
  fabricCode: text("fabric_code").notNull().unique(),
  fabricType: text("fabric_type").notNull(),
  quality: text("quality").notNull(),
  color: text("color"),
  hexCode: text("hex_code"),
  colorName: text("color_name").notNull(),
  width: text("width").notNull(),
  height: text("height"),
  widthUnitType: text("width_unit_type").notNull(),
  pricePerMeter: text("price_per_meter").notNull(),
  unitType: text("unit_type").notNull(),
  currentStock: text("current_stock").notNull(),
  hsnCode: text("hsn_code").notNull(),
  gstPercent: text("gst_percent").notNull(),
  vendor: text("vendor"),
  location: text("location"),
  locationStocks: jsonb("location_stocks").$type<{ location: string; stock: string }[]>().notNull().default([]),
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

export type FabricRecord = typeof fabricsTable.$inferSelect;

export const fabricImageSchema = z.object({
  id: z.string(),
  name: z.string(),
  data: z.string(),
  size: z.number(),
});

export const insertFabricSchema = z.object({
  fabricType: z.string().min(1, "Fabric Type is required"),
  quality: z.string().min(1, "Quality is required"),
  color: z.string().optional(),
  hexCode: z.string().optional(),
  colorName: z.string().min(1, "Color Name is required"),
  width: z.string().min(1, "Width is required"),
  height: z.string().optional(),
  widthUnitType: z.string().min(1, "Width Unit Type is required"),
  pricePerMeter: z.string().min(1, "Price Per Meter is required"),
  unitType: z.string().min(1, "Unit Type is required"),
  currentStock: z.string().min(1, "Current Stock is required"),
  hsnCode: z.string().min(1, "HSN Code is required"),
  gstPercent: z.string().min(1, "GST % is required"),
  vendor: z.string().optional(),
  location: z.string().optional(),
  locationStocks: z.array(z.object({ location: z.string(), stock: z.string() })).optional().default([]),
  isActive: z.boolean().default(true),
  images: z.array(fabricImageSchema).optional().default([]),
  reorderLevel: z.string().optional(),
  minimumLevel: z.string().optional(),
  maximumLevel: z.string().optional(),
});

export const updateFabricSchema = insertFabricSchema.partial().extend({
  updatedBy: z.string().optional(),
});

export type InsertFabric = z.infer<typeof insertFabricSchema>;
export type UpdateFabric = z.infer<typeof updateFabricSchema>;
