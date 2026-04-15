import { pgTable, serial, integer, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const styleOrderArtworksTable = pgTable("style_order_artworks", {
  id: serial("id").primaryKey(),
  artworkCode: text("artwork_code").notNull().unique(),

  styleOrderId: integer("style_order_id").notNull(),
  styleOrderProductId: integer("style_order_product_id"),
  styleOrderProductName: text("style_order_product_name"),

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

  toileMakingCost: text("toile_making_cost"),
  toileVendorId: text("toile_vendor_id"),
  toileVendorName: text("toile_vendor_name"),
  toileCost: text("toile_cost"),
  toilePaymentDate: text("toile_payment_date"),
  toilePaymentMode: text("toile_payment_mode"),
  toilePaymentStatus: text("toile_payment_status"),
  toileTransactionId: text("toile_transaction_id"),
  toileImages: jsonb("toile_images").default([]),

  patternType: text("pattern_type"),
  patternMakingCost: text("pattern_making_cost"),
  patternDoc: jsonb("pattern_doc").default([]),
  patternOuthouseDoc: jsonb("pattern_outhouse_doc").default([]),

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

export type StyleOrderArtworkRecord = typeof styleOrderArtworksTable.$inferSelect;

export const insertStyleOrderArtworkSchema = z.object({
  styleOrderId: z.number().int().positive(),
  styleOrderProductId: z.number().int().optional().nullable(),
  styleOrderProductName: z.string().optional().nullable(),
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
  toileMakingCost: z.string().optional().nullable(),
  toileVendorId: z.string().optional().nullable(),
  toileVendorName: z.string().optional().nullable(),
  toileCost: z.string().optional().nullable(),
  toilePaymentDate: z.string().optional().nullable(),
  toilePaymentMode: z.string().optional().nullable(),
  toilePaymentStatus: z.string().optional().nullable(),
  toileTransactionId: z.string().optional().nullable(),
  toileImages: z.array(z.record(z.unknown())).optional().default([]),
  patternType: z.string().optional().nullable(),
  patternMakingCost: z.string().optional().nullable(),
  patternDoc: z.array(z.record(z.unknown())).optional().default([]),
  patternOuthouseDoc: z.array(z.record(z.unknown())).optional().default([]),
  feedbackStatus: z.string().default("Pending"),
  files: z.array(z.record(z.unknown())).optional().default([]),
  refImages: z.array(z.record(z.unknown())).optional().default([]),
  wipImages: z.array(z.record(z.unknown())).optional().default([]),
  finalImages: z.array(z.record(z.unknown())).optional().default([]),
});

export const updateStyleOrderArtworkSchema = insertStyleOrderArtworkSchema.partial().extend({
  updatedBy: z.string().optional(),
});

export type InsertStyleOrderArtwork = z.infer<typeof insertStyleOrderArtworkSchema>;
export type UpdateStyleOrderArtwork = z.infer<typeof updateStyleOrderArtworkSchema>;
