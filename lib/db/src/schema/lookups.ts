import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const itemTypesTable = pgTable("item_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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

export const swatchCategoriesTable = pgTable("swatch_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ItemType = typeof itemTypesTable.$inferSelect;
export type UnitType = typeof unitTypesTable.$inferSelect;
export type WidthUnitType = typeof widthUnitTypesTable.$inferSelect;
export type FabricType = typeof fabricTypesTable.$inferSelect;
export type SwatchCategory = typeof swatchCategoriesTable.$inferSelect;
