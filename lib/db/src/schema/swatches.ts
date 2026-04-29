import { pgTable, serial, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const swatchesTable = pgTable("swatches", {
  id: serial("id").primaryKey(),
  swatchCode: text("swatch_code").notNull().unique(),
  swatchName: text("swatch_name").notNull(),
  client: text("client"),
  swatchCategory: text("swatch_category"),
  fabric: text("fabric"),
  location: text("location"),
  swatchDate: text("swatch_date"),
  length: text("length"),
  width: text("width"),
  unitType: text("unit_type"),
  hours: text("hours"),
  attachments: jsonb("attachments").default([]),
  colorName: text("color_name"),
  hexCode: text("hex_code"),
  finishType: text("finish_type"),
  gsm: text("gsm"),
  wipMedia: jsonb("wip_media").default([]),
  finalMedia: jsonb("final_media").default([]),
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
  client: z.string().optional(),
  swatchCategory: z.string().optional(),
  fabric: z.string().optional(),
  location: z.string().optional(),
  swatchDate: z.string().optional(),
  length: z.string().optional(),
  width: z.string().optional(),
  unitType: z.string().optional(),
  hours: z.string().optional(),
  attachments: z.array(z.record(z.string(), z.unknown())).optional().default([]),
  colorName: z.string().optional(),
  hexCode: z.string().optional(),
  finishType: z.string().optional(),
  gsm: z.string().optional(),
  approvalStatus: z.string().default("Pending"),
  remarks: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const updateSwatchSchema = insertSwatchSchema.partial().extend({
  updatedBy: z.string().optional(),
});

export type InsertSwatch = z.infer<typeof insertSwatchSchema>;
export type UpdateSwatch = z.infer<typeof updateSwatchSchema>;
