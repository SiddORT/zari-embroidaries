import { pgTable, serial, integer, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const styleOrdersTable = pgTable("style_orders", {
  id: serial("id").primaryKey(),
  orderCode: text("order_code").notNull().unique(),

  styleName: text("style_name").notNull(),
  styleNo: text("style_no"),
  clientId: text("client_id"),
  clientName: text("client_name"),

  quantity: text("quantity"),
  priority: text("priority").notNull().default("Medium"),
  orderStatus: text("order_status").notNull().default("Draft"),

  season: text("season"),
  colorway: text("colorway"),
  sampleSize: text("sample_size"),
  fabricType: text("fabric_type"),

  orderIssueDate: text("order_issue_date"),
  deliveryDate: text("delivery_date"),
  targetHours: text("target_hours"),
  issuedTo: text("issued_to"),
  department: text("department"),

  description: text("description"),
  internalNotes: text("internal_notes"),
  clientInstructions: text("client_instructions"),

  isChargeable: boolean("is_chargeable").notNull().default(false),

  styleReferences: jsonb("style_references").default([]),
  swatchReferences: jsonb("swatch_references").default([]),
  refDocs: jsonb("ref_docs").default([]),
  refImages: jsonb("ref_images").default([]),
  estimate: jsonb("estimate").default([]),

  actualStartDate: text("actual_start_date"),
  actualStartTime: text("actual_start_time"),
  tentativeDeliveryDate: text("tentative_delivery_date"),
  actualCompletionDate: text("actual_completion_date"),
  actualCompletionTime: text("actual_completion_time"),
  delayReason: text("delay_reason"),
  approvalDate: text("approval_date"),
  revisionCount: integer("revision_count").notNull().default(0),

  isDeleted: boolean("is_deleted").notNull().default(false),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export type StyleOrderRecord = typeof styleOrdersTable.$inferSelect;

export const insertStyleOrderSchema = z.object({
  styleName: z.string().min(1, "Style Name is required"),
  styleNo: z.string().optional(),
  clientId: z.string().optional(),
  clientName: z.string().optional(),
  quantity: z.string().optional(),
  priority: z.string().default("Medium"),
  orderStatus: z.string().default("Draft"),
  season: z.string().optional(),
  colorway: z.string().optional(),
  sampleSize: z.string().optional(),
  fabricType: z.string().optional(),
  orderIssueDate: z.string().optional(),
  deliveryDate: z.string().optional(),
  targetHours: z.string().optional(),
  issuedTo: z.string().optional(),
  department: z.string().optional(),
  description: z.string().optional(),
  internalNotes: z.string().optional(),
  clientInstructions: z.string().optional(),
  isChargeable: z.boolean().default(false),
  styleReferences: z.array(z.any()).optional(),
  swatchReferences: z.array(z.any()).optional(),
  refDocs: z.array(z.any()).optional(),
  refImages: z.array(z.any()).optional(),
  estimate: z.array(z.any()).optional(),
  actualStartDate: z.string().optional(),
  actualStartTime: z.string().optional(),
  tentativeDeliveryDate: z.string().optional(),
  actualCompletionDate: z.string().optional(),
  actualCompletionTime: z.string().optional(),
  delayReason: z.string().optional(),
  approvalDate: z.string().optional(),
});

export const updateStyleOrderSchema = insertStyleOrderSchema.partial().extend({
  updatedBy: z.string().optional(),
});

export type InsertStyleOrder = z.infer<typeof insertStyleOrderSchema>;
export type UpdateStyleOrder = z.infer<typeof updateStyleOrderSchema>;
