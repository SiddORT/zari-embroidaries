import { pgTable, serial, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export interface BankAccount {
  bankName: string;
  accountNo: string;
  ifscCode: string;
}

export interface PaymentAttachment {
  name: string;
  type: string;
  data: string;
  size: number;
}

export interface VendorAddress {
  id: string;
  type: "Home" | "Warehouse" | "Office" | "Factory" | "Other";
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

export const vendorsTable = pgTable("vendors", {
  id: serial("id").primaryKey(),
  vendorCode: text("vendor_code").notNull().unique(),
  brandName: text("brand_name").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email"),
  altEmail: text("alt_email"),
  contactNo: text("contact_no"),
  altContactNo: text("alt_contact_no"),
  country: text("country"),
  hasGst: boolean("has_gst").notNull().default(false),
  gstNo: text("gst_no"),
  bankName: text("bank_name"),
  accountNo: text("account_no"),
  ifscCode: text("ifsc_code"),
  bankAccounts: jsonb("bank_accounts").$type<BankAccount[]>(),
  address1: text("address1"),
  address2: text("address2"),
  pincode: text("pincode"),
  state: text("state"),
  city: text("city"),
  addresses: jsonb("addresses").$type<VendorAddress[]>(),
  paymentAttachments: jsonb("payment_attachments").$type<PaymentAttachment[]>(),
  isActive: boolean("is_active").notNull().default(true),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export type VendorRecord = typeof vendorsTable.$inferSelect;

const bankAccountSchema = z.object({
  bankName: z.string(),
  accountNo: z.string(),
  ifscCode: z.string(),
});

const paymentAttachmentSchema = z.object({
  name: z.string(),
  type: z.string(),
  data: z.string(),
  size: z.number(),
});

const vendorAddressSchema = z.object({
  id: z.string(),
  type: z.enum(["Home", "Warehouse", "Office", "Factory", "Other"]),
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

const NAME_REGEX = /^[A-Za-z]+( [A-Za-z]+)*$/;
const CONTACT_NO_REGEX = /^[0-9]{10}$/;
const ALLOWED_ATTACHMENT_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;

export const insertVendorSchema = z.object({
  brandName: z
    .string()
    .trim()
    .min(1, "Brand / Vendor Name is required.")
    .max(100, "Vendor Name must be 100 characters or fewer.")
    .regex(NAME_REGEX, "Vendor Name must contain only letters and spaces (max 100 characters)."),
  contactName: z
    .string()
    .trim()
    .min(1, "Contact Name is required.")
    .max(100, "Contact Name must be 100 characters or fewer.")
    .regex(NAME_REGEX, "Contact Name must contain only letters and spaces (max 100 characters)."),
  email: z.string().email("Valid email required.").optional().or(z.literal("")),
  altEmail: z.string().email("Valid email required.").optional().or(z.literal("")),
  contactNo: z.string().optional().refine(
    val => !val || val === "" || CONTACT_NO_REGEX.test(val.replace(/^\+\d+\s*/, "").replace(/\D/g, "")),
    { message: "Contact Number must be exactly 10 digits." }
  ),
  altContactNo: z.string().optional(),
  country: z.string().optional(),
  hasGst: z.boolean().default(false),
  gstNo: z.string().optional(),
  bankName: z.string().optional(),
  accountNo: z.string().optional(),
  ifscCode: z.string().optional(),
  bankAccounts: z.array(bankAccountSchema).optional(),
  address1: z.string().optional(),
  address2: z.string().optional(),
  pincode: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  addresses: z.array(vendorAddressSchema).optional(),
  paymentAttachments: z.array(
    paymentAttachmentSchema.refine(
      att => ALLOWED_ATTACHMENT_TYPES.includes(att.type),
      { message: "Only PDF, JPG, PNG, XLS, XLSX files are allowed." }
    ).refine(
      att => att.size <= MAX_ATTACHMENT_SIZE,
      { message: "File must be 5 MB or smaller." }
    )
  ).optional(),
  isActive: z.boolean().default(true),
});

export const updateVendorSchema = insertVendorSchema.partial().extend({
  updatedBy: z.string().optional(),
});

export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type UpdateVendor = z.infer<typeof updateVendorSchema>;
