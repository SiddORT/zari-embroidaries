import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const clientsTable = pgTable("clients", {
  id: serial("id").primaryKey(),
  clientCode: text("client_code").notNull().unique(),
  brandName: text("brand_name").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  altEmail: text("alt_email"),
  contactNo: text("contact_no").notNull(),
  altContactNo: text("alt_contact_no"),
  countryOfOrigin: text("country_of_origin").notNull(),
  hasGst: boolean("has_gst").notNull().default(false),
  gstNo: text("gst_no"),
  address1: text("address1").notNull(),
  address2: text("address2"),
  country: text("country"),
  state: text("state"),
  city: text("city"),
  pincode: text("pincode"),
  isActive: boolean("is_active").notNull().default(true),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export type ClientRecord = typeof clientsTable.$inferSelect;

export const insertClientSchema = z.object({
  brandName: z.string().min(1, "Brand Name is required"),
  contactName: z.string().min(1, "Contact Name is required"),
  email: z.email("Valid email required"),
  altEmail: z.email("Valid email").optional().or(z.literal("")),
  contactNo: z.string().min(1, "Contact No is required"),
  altContactNo: z.string().optional(),
  countryOfOrigin: z.string().min(1, "Country of Origin is required"),
  hasGst: z.boolean().default(false),
  gstNo: z.string().optional(),
  address1: z.string().min(1, "Address Line 1 is required"),
  address2: z.string().optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  pincode: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const updateClientSchema = insertClientSchema.partial().extend({
  updatedBy: z.string().optional(),
});

export type InsertClient = z.infer<typeof insertClientSchema>;
export type UpdateClient = z.infer<typeof updateClientSchema>;
