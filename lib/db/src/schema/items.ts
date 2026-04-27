import { pgTable, serial, text, boolean, timestamp, jsonb, numeric } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const itemsTable = pgTable("items", {
  id: serial("id").primaryKey(),
  itemCode: text("item_code").notNull().unique(),
  itemName: text("item_name").notNull(),
  itemType: text("item_type").notNull().default(""),
  description: text("description"),
  unitType: text("unit_type").notNull().default(""),
  unitPrice: text("unit_price").notNull().default("0"),
  hsnCode: text("hsn_code"),
  gstPercent: text("gst_percent"),
  currentStock: text("current_stock").notNull().default("0"),
  locationStocks: jsonb("location_stocks").$type<{ location: string; stock: string }[]>().notNull().default([]),
  images: jsonb("images").$type<{ id: string; name: string; data: string; size: number }[]>().notNull().default([]),
  reorderLevel: numeric("reorder_level", { precision: 14, scale: 3 }),
  minimumLevel: numeric("minimum_level", { precision: 14, scale: 3 }),
  maximumLevel: numeric("maximum_level", { precision: 14, scale: 3 }),
  isActive: boolean("is_active").notNull().default(true),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdBy: text("created_by").notNull().default("system"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export type Item = typeof itemsTable.$inferSelect;

const NAME_REGEX = /^[A-Za-z]+( [A-Za-z]+)*$/;
const NUMERIC_REGEX = /^[0-9]+(\.[0-9]{1,2})?$/;

export const itemImageSchema = z.object({
  id: z.string(),
  name: z.string(),
  data: z.string(),
  size: z.number(),
});

export const itemLocationStockSchema = z.object({
  location: z.string(),
  stock: z.string(),
});

export const insertItemSchema = z.object({
  itemName: z.string().trim().min(1, "Item Name is required")
    .max(100, "Item Name must be at most 100 characters")
    .refine((v) => NAME_REGEX.test(v), { message: "Item Name must contain only letters and spaces." }),
  itemType: z.string().trim()
    .refine((v) => !v || NAME_REGEX.test(v), { message: "Item Type must contain only letters and spaces." })
    .optional().default(""),
  description: z.string().optional(),
  unitType: z.string().trim().min(1, "Unit Type is required")
    .refine((v) => NAME_REGEX.test(v), { message: "Unit Type must contain only letters." }),
  unitPrice: z.string().trim().min(1, "Unit Price is required")
    .refine((v) => NUMERIC_REGEX.test(v), { message: "Unit Price must be a positive numeric value." }),
  hsnCode: z.string().optional(),
  gstPercent: z.string().optional(),
  currentStock: z.string().trim().default("0"),
  locationStocks: z.array(itemLocationStockSchema).optional().default([]),
  images: z.array(itemImageSchema).optional().default([]),
  reorderLevel: z.string().optional(),
  minimumLevel: z.string().optional(),
  maximumLevel: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const updateItemSchema = insertItemSchema.partial().extend({
  updatedBy: z.string().optional(),
});

export type InsertItem = z.infer<typeof insertItemSchema>;
export type UpdateItem = z.infer<typeof updateItemSchema>;
