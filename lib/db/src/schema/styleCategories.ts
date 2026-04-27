import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const styleCategoriesTable = pgTable("style_categories", {
  id: serial("id").primaryKey(),
  categoryName: text("category_name").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export type StyleCategoryRecord = typeof styleCategoriesTable.$inferSelect;

const CATEGORY_NAME_REGEX = /^[A-Za-z]+( [A-Za-z]+)*$/;

export const insertStyleCategorySchema = z.object({
  categoryName: z
    .string()
    .trim()
    .min(1, "Category Name is required.")
    .max(100, "Category Name must be 100 characters or fewer.")
    .regex(CATEGORY_NAME_REGEX, "Category Name must contain only letters and spaces (max 100 characters)."),
  isActive: z.boolean().default(true),
});

export const updateStyleCategorySchema = insertStyleCategorySchema.partial().extend({
  updatedBy: z.string().optional(),
});

export type InsertStyleCategory = z.infer<typeof insertStyleCategorySchema>;
export type UpdateStyleCategory = z.infer<typeof updateStyleCategorySchema>;
