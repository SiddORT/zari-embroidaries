import { pgTable, serial, integer, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const clientLinksTable = pgTable("client_links", {
  id: serial("id").primaryKey(),
  swatchOrderId: integer("swatch_order_id"),
  styleOrderId: integer("style_order_id"),
  token: text("token").notNull().unique(),
  isPublished: boolean("is_published").notNull().default(false),
  hiddenImages: jsonb("hidden_images").default([]),
  portalTitle: text("portal_title"),
  closedThreads: jsonb("closed_threads").default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const clientFeedbackTable = pgTable("client_feedback", {
  id: serial("id").primaryKey(),
  clientLinkId: integer("client_link_id").notNull(),
  artworkId: integer("artwork_id").notNull(),
  artworkName: text("artwork_name").notNull(),
  decision: text("decision").notNull(),
  comment: text("comment"),
  isResolved: boolean("is_resolved").notNull().default(false),
  internalNote: text("internal_note"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clientMessagesTable = pgTable("client_messages", {
  id: serial("id").primaryKey(),
  clientLinkId: integer("client_link_id").notNull(),
  artworkId: integer("artwork_id").notNull(),
  artworkName: text("artwork_name").notNull(),
  sender: text("sender").notNull(),
  message: text("message"),
  attachment: jsonb("attachment"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertClientLinkSchema = z.object({
  swatchOrderId: z.number(),
  token: z.string(),
  isPublished: z.boolean().optional(),
  hiddenImages: z.array(z.object({
    artworkId: z.number(),
    imageType: z.enum(["wip", "final"]),
    imageIndex: z.number(),
  })).optional(),
  portalTitle: z.string().optional().nullable(),
  closedThreads: z.array(z.number()).optional(),
});

export const insertClientFeedbackSchema = z.object({
  clientLinkId: z.number(),
  artworkId: z.number(),
  artworkName: z.string(),
  decision: z.enum(["Approve", "Rework"]),
  comment: z.string().optional().nullable(),
});

export const insertClientMessageSchema = z.object({
  clientLinkId: z.number(),
  artworkId: z.number(),
  artworkName: z.string(),
  sender: z.enum(["client", "team"]),
  message: z.string().optional().nullable(),
  attachment: z.object({
    name: z.string(),
    type: z.string(),
    data: z.string(),
    size: z.number(),
  }).optional().nullable(),
});
