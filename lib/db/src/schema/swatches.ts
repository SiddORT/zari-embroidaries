import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const swatchesTable = pgTable("swatches", {
  id: serial("id").primaryKey(),
  swatchCode: text("swatch_code").notNull().unique(),
  swatchName: text("swatch_name").notNull(),
  fabric: text("fabric"),
  colorName: text("color_name"),
  hexCode: text("hex_code"),
  width: text("width"),
  unitType: text("unit_type"),
  finishType: text("finish_type"),
  gsm: text("gsm"),
  client: text("client"),
  approvalStatus: text("approval_status").notNull().default("Pending"),
  remarks: text("remarks"),
  isActive: boolean("is_active").notNull().default(true),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export type SwatchRecord = typeof swatchesTable.$inferSelect;

export const insertSwatchSchema = z.object({
  swatchName: z.string().min(1, "Swatch Name is required"),
  fabric: z.string().optional(),
  colorName: z.string().optional(),
  hexCode: z.string().optional(),
  width: z.string().optional(),
  unitType: z.string().optional(),
  finishType: z.string().optional(),
  gsm: z.string().optional(),
  client: z.string().optional(),
  approvalStatus: z.string().default("Pending"),
  remarks: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const updateSwatchSchema = insertSwatchSchema.partial().extend({
  updatedBy: z.string().optional(),
});

export type InsertSwatch = z.infer<typeof insertSwatchSchema>;
export type UpdateSwatch = z.infer<typeof updateSwatchSchema>;
