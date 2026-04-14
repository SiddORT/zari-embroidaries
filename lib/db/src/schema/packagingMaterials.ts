import { pgTable, serial, text, boolean, timestamp, numeric } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const packagingMaterialsTable = pgTable("packaging_materials", {
  id: serial("id").primaryKey(),
  itemCode: text("item_code").notNull().unique(),
  itemName: text("item_name").notNull(),
  department: text("department"),
  size: text("size"),
  unitType: text("unit_type"),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }),
  vendor: text("vendor"),
  location: text("location"),
  isActive: boolean("is_active").notNull().default(true),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export type PackagingMaterial = typeof packagingMaterialsTable.$inferSelect;

export const insertPackagingMaterialSchema = z.object({
  itemName: z.string().min(1, "Item Name is required"),
  department: z.string().optional(),
  size: z.string().optional(),
  unitType: z.string().optional(),
  unitPrice: z.string().optional(),
  vendor: z.string().optional(),
  location: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const updatePackagingMaterialSchema = insertPackagingMaterialSchema.partial().extend({
  updatedBy: z.string().optional(),
});
