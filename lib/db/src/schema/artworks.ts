import { pgTable, serial, integer, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const artworksTable = pgTable("artworks", {
  id: serial("id").primaryKey(),
  artworkCode: text("artwork_code").notNull().unique(),
  swatchOrderId: integer("swatch_order_id").notNull(),

  artworkName: text("artwork_name").notNull(),

  unitLength: text("unit_length"),
  unitWidth: text("unit_width"),
  unitType: text("unit_type"),

  artworkCreated: text("artwork_created").notNull().default("Inhouse"),

  workHours: text("work_hours"),
  hourlyRate: text("hourly_rate"),
  totalCost: text("total_cost"),

  outsourceVendorId: text("outsource_vendor_id"),
  outsourceVendorName: text("outsource_vendor_name"),
  outsourcePaymentDate: text("outsource_payment_date"),
  outsourcePaymentAmount: text("outsource_payment_amount"),
  outsourcePaymentMode: text("outsource_payment_mode"),
  outsourceTransactionId: text("outsource_transaction_id"),
  outsourcePaymentStatus: text("outsource_payment_status"),

  feedbackStatus: text("feedback_status").notNull().default("Pending"),

  files: jsonb("files").default([]),
  refImages: jsonb("ref_images").default([]),
  wipImages: jsonb("wip_images").default([]),
  finalImages: jsonb("final_images").default([]),

  isDeleted: boolean("is_deleted").notNull().default(false),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export type ArtworkRecord = typeof artworksTable.$inferSelect;

export const insertArtworkSchema = z.object({
  swatchOrderId: z.number().int().positive(),
  artworkName: z.string().min(1, "Artwork Name is required"),
  unitLength: z.string().optional(),
  unitWidth: z.string().optional(),
  unitType: z.string().optional(),
  artworkCreated: z.enum(["Inhouse", "Outsource"]).default("Inhouse"),
  workHours: z.string().optional(),
  hourlyRate: z.string().optional(),
  totalCost: z.string().optional(),
  outsourceVendorId: z.string().optional().nullable(),
  outsourceVendorName: z.string().optional().nullable(),
  outsourcePaymentDate: z.string().optional().nullable(),
  outsourcePaymentAmount: z.string().optional().nullable(),
  outsourcePaymentMode: z.string().optional().nullable(),
  outsourceTransactionId: z.string().optional().nullable(),
  outsourcePaymentStatus: z.string().optional().nullable(),
  feedbackStatus: z.string().default("Pending"),
  files: z.array(z.record(z.unknown())).optional().default([]),
  refImages: z.array(z.record(z.unknown())).optional().default([]),
  wipImages: z.array(z.record(z.unknown())).optional().default([]),
  finalImages: z.array(z.record(z.unknown())).optional().default([]),
});

export const updateArtworkSchema = insertArtworkSchema.partial().extend({
  updatedBy: z.string().optional(),
});

export type InsertArtwork = z.infer<typeof insertArtworkSchema>;
export type UpdateArtwork = z.infer<typeof updateArtworkSchema>;
