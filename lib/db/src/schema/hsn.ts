import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const hsnTable = pgTable("hsn_master", {
  id: serial("id").primaryKey(),
  hsnCode: text("hsn_code").notNull().unique(),
  gstPercentage: text("gst_percentage").notNull(),
  govtDescription: text("govt_description").notNull(),
  remarks: text("remarks"),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export type HsnRecord = typeof hsnTable.$inferSelect;

export const insertHsnSchema = z.object({
  hsnCode: z.string().min(1, "HSN Code is required"),
  gstPercentage: z.enum(["0", "5", "12", "18", "28"], {
    error: "GST Percentage is required",
  }),
  govtDescription: z.string().min(1, "Government Description is required"),
  remarks: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const updateHsnSchema = insertHsnSchema.partial().extend({
  updatedBy: z.string().optional(),
});

export type InsertHsn = z.infer<typeof insertHsnSchema>;
export type UpdateHsn = z.infer<typeof updateHsnSchema>;
