import { pgTable, serial, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export interface ClientAddress {
  id: string;
  type: "Billing Address" | "Delivery Address" | "Other";
  name: string;
  contactNo: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isBillingDefault: boolean;
}

export const clientsTable = pgTable("clients", {
  id: serial("id").primaryKey(),
  clientCode: text("client_code").notNull().unique(),
  brandName: text("brand_name").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  altEmail: text("alt_email"),
  contactNo: text("contact_no").notNull(),
  altContactNo: text("alt_contact_no"),
  country: text("country"),
  countryOfOrigin: text("country_of_origin"),
  hasGst: boolean("has_gst").notNull().default(false),
  gstNo: text("gst_no"),
  address1: text("address1"),
  address2: text("address2"),
  state: text("state"),
  city: text("city"),
  pincode: text("pincode"),
  addresses: jsonb("addresses").$type<ClientAddress[]>(),
  invoiceCurrency: text("invoice_currency").default("INR"),
  isActive: boolean("is_active").notNull().default(true),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export type ClientRecord = typeof clientsTable.$inferSelect;

const clientAddressSchema = z.object({
  id: z.string(),
  type: z.enum(["Billing Address", "Delivery Address", "Other"]),
  name: z.string(),
  contactNo: z.string(),
  address1: z.string(),
  address2: z.string(),
  city: z.string(),
  state: z.string(),
  pincode: z.string(),
  country: z.string(),
  isBillingDefault: z.boolean(),
});

const NAME_PATTERN = /^[A-Za-z]+( [A-Za-z]+)*$/;

export const insertClientSchema = z.object({
  brandName: z.string().min(1, "Brand Name is required").max(100).regex(NAME_PATTERN, "Client Name must contain only letters and spaces (max 100 characters)."),
  contactName: z.string().min(1, "Contact Name is required").max(100).regex(NAME_PATTERN, "Contact Name must contain only letters and spaces (max 100 characters)."),
  email: z.email("Valid email required"),
  altEmail: z.email("Valid email").optional().or(z.literal("")),
  contactNo: z.string().min(1, "Contact No is required"),
  altContactNo: z.string().optional(),
  country: z.string().optional(),
  countryOfOrigin: z.string().optional(),
  hasGst: z.boolean().default(false),
  gstNo: z.string().optional(),
  address1: z.string().optional(),
  address2: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  pincode: z.string().optional(),
  addresses: z.array(clientAddressSchema).optional(),
  invoiceCurrency: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const updateClientSchema = insertClientSchema.partial().extend({
  updatedBy: z.string().optional(),
});

export type InsertClient = z.infer<typeof insertClientSchema>;
export type UpdateClient = z.infer<typeof updateClientSchema>;
