import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const hsnTable = pgTable("hsn_master", {
  id: serial("id").primaryKey(),
  hsnCode: text("hsn_code").notNull().unique(),
  gstPercentage: text("gst_percentage").notNull(),
  govtDescription: text("govt_description").notNull(),
  remarks: text("remarks"),
  isActive: boolean("is_active").notNull().default(true),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export type HsnRecord = typeof hsnTable.$inferSelect;

const HSN_CODE_REGEX = /^[0-9]{4}$|^[0-9]{6}$|^[0-9]{8}$/;

export const insertHsnSchema = z.object({
  hsnCode: z
    .string()
    .trim()
    .regex(HSN_CODE_REGEX, "HSN Code must contain only 4, 6, or 8 numeric digits."),
  gstPercentage: z.enum(["0", "5", "12", "18", "28"], {
    error: "GST Percentage must be one of 0, 5, 12, 18, or 28.",
  }),
  govtDescription: z
    .string()
    .trim()
    .min(1, "Government Description is required.")
    .max(255, "Government Description must be 255 characters or fewer."),
  remarks: z.string().trim().max(500, "Remarks must be 500 characters or fewer.").optional(),
  isActive: z.boolean().default(true),
});

export const updateHsnSchema = insertHsnSchema.partial().extend({
  updatedBy: z.string().optional(),
});

export type InsertHsn = z.infer<typeof insertHsnSchema>;
export type UpdateHsn = z.infer<typeof updateHsnSchema>;
