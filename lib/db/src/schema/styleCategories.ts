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

export const insertStyleCategorySchema = z.object({
  categoryName: z.string().min(1, "Category Name is required"),
  isActive: z.boolean().default(true),
});

export const updateStyleCategorySchema = insertStyleCategorySchema.partial().extend({
  updatedBy: z.string().optional(),
});

export type InsertStyleCategory = z.infer<typeof insertStyleCategorySchema>;
export type UpdateStyleCategory = z.infer<typeof updateStyleCategorySchema>;
