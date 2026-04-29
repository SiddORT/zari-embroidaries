import { pgTable, serial, text, boolean, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const swatchOrdersTable = pgTable("swatch_orders", {
  id: serial("id").primaryKey(),
  orderCode: text("order_code").notNull().unique(),

  swatchName: text("swatch_name").notNull(),
  clientId: text("client_id"),
  clientName: text("client_name"),
  isChargeable: boolean("is_chargeable").notNull().default(false),
  isInhouse: boolean("is_inhouse").notNull().default(false),
  quantity: text("quantity"),
  priority: text("priority").notNull().default("Medium"),
  orderStatus: text("order_status").notNull().default("Draft"),

  styleReferences: jsonb("style_references").default([]),
  swatchReferences: jsonb("swatch_references").default([]),

  fabricId: text("fabric_id"),
  fabricName: text("fabric_name"),
  hasLining: boolean("has_lining").notNull().default(false),
  liningFabricId: text("lining_fabric_id"),
  liningFabricName: text("lining_fabric_name"),
  unitLength: text("unit_length"),
  unitWidth: text("unit_width"),
  unitType: text("unit_type"),

  orderIssueDate: text("order_issue_date"),
  deliveryDate: text("delivery_date"),
  targetHours: text("target_hours"),
  issuedTo: text("issued_to"),
  department: text("department"),

  description: text("description"),
  internalNotes: text("internal_notes"),
  clientInstructions: text("client_instructions"),

  refDocs: jsonb("ref_docs").default([]),
  refImages: jsonb("ref_images").default([]),
  wipImages: jsonb("wip_images").default([]),
  finalImages: jsonb("final_images").default([]),
  wipVideos: jsonb("wip_videos").default([]),
  finalVideos: jsonb("final_videos").default([]),

  actualStartDate: text("actual_start_date"),
  actualStartTime: text("actual_start_time"),
  tentativeDeliveryDate: text("tentative_delivery_date"),
  actualCompletionDate: text("actual_completion_date"),
  actualCompletionTime: text("actual_completion_time"),
  delayReason: text("delay_reason"),
  approvalDate: text("approval_date"),
  revisionCount: integer("revision_count").notNull().default(0),
  estimate: jsonb("estimate").default([]),

  isDeleted: boolean("is_deleted").notNull().default(false),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export type SwatchOrderRecord = typeof swatchOrdersTable.$inferSelect;

const referenceItem = z.object({
  id: z.string(),
  label: z.string(),
  remark: z.string().optional().default(""),
});

export const insertSwatchOrderSchema = z.object({
  swatchName: z.string().min(1, "Swatch Name is required"),
  clientId: z.string().optional(),
  clientName: z.string().optional(),
  isChargeable: z.boolean().default(false),
  isInhouse: z.boolean().default(false),
  quantity: z.string().optional(),
  priority: z.string().default("Medium"),
  orderStatus: z.string().default("Draft"),
  styleReferences: z.array(referenceItem).optional().default([]),
  swatchReferences: z.array(referenceItem).optional().default([]),
  fabricId: z.string().optional(),
  fabricName: z.string().optional(),
  hasLining: z.boolean().default(false),
  liningFabricId: z.string().optional(),
  liningFabricName: z.string().optional(),
  unitLength: z.string().optional(),
  unitWidth: z.string().optional(),
  unitType: z.string().optional(),
  orderIssueDate: z.string().optional(),
  deliveryDate: z.string().optional(),
  targetHours: z.string().optional(),
  issuedTo: z.string().optional(),
  department: z.string().optional(),
  description: z.string().optional(),
  internalNotes: z.string().optional(),
  clientInstructions: z.string().optional(),
  refDocs: z.array(z.record(z.string(), z.unknown())).optional().default([]),
  refImages: z.array(z.record(z.string(), z.unknown())).optional().default([]),
  wipImages: z.array(z.record(z.string(), z.unknown())).optional().default([]),
  finalImages: z.array(z.record(z.string(), z.unknown())).optional().default([]),
  wipVideos: z.array(z.record(z.string(), z.unknown())).optional().default([]),
  finalVideos: z.array(z.record(z.string(), z.unknown())).optional().default([]),
  actualStartDate: z.string().optional(),
  actualStartTime: z.string().optional(),
  tentativeDeliveryDate: z.string().optional(),
  actualCompletionDate: z.string().optional(),
  actualCompletionTime: z.string().optional(),
  delayReason: z.string().optional(),
  approvalDate: z.string().optional(),
  revisionCount: z.number().default(0),
  estimate: z.array(z.record(z.string(), z.unknown())).optional().default([]),
});

export const updateSwatchOrderSchema = insertSwatchOrderSchema.partial().extend({
  updatedBy: z.string().optional(),
});

export type InsertSwatchOrder = z.infer<typeof insertSwatchOrderSchema>;
export type UpdateSwatchOrder = z.infer<typeof updateSwatchOrderSchema>;
