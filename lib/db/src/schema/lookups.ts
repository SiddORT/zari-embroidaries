import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const itemTypesTable = pgTable("item_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdBy: text("created_by").notNull().default("system"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const unitTypesTable = pgTable("unit_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const widthUnitTypesTable = pgTable("width_unit_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const fabricTypesTable = pgTable("fabric_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const departmentsTable = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdBy: text("created_by").notNull().default("system"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const swatchCategoriesTable = pgTable("swatch_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdBy: text("created_by").notNull().default("system"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const insertItemTypeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  isActive: z.boolean().default(true),
});

export const updateItemTypeSchema = insertItemTypeSchema.partial().extend({
  updatedBy: z.string().optional(),
});

export type ItemType = typeof itemTypesTable.$inferSelect;
export type UnitType = typeof unitTypesTable.$inferSelect;
export type WidthUnitType = typeof widthUnitTypesTable.$inferSelect;
export type FabricType = typeof fabricTypesTable.$inferSelect;
export type Department = typeof departmentsTable.$inferSelect;
export type SwatchCategory = typeof swatchCategoriesTable.$inferSelect;

export const insertSwatchCategorySchema = z.object({
  name: z.string().min(1, "Category Name is required"),
  isActive: z.boolean().default(true),
});

export const updateSwatchCategorySchema = insertSwatchCategorySchema.partial().extend({
  updatedBy: z.string().optional(),
});
