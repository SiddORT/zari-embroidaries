import {
  pgTable,
  serial,
  text,
  boolean,
  numeric,
  timestamp,
  date,
  integer,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { relations } from "drizzle-orm";


export const tdsMasterTable = pgTable("tds_master", {
  id: serial("id").primaryKey(),

  serviceName: text("service_name").notNull(),

  paymentNature: text("payment_nature").notNull(),

  sectionCode: text("section_code").notNull(),

  ratePercent: numeric("rate_percent", {
    precision: 5,
    scale: 2,
  }).notNull(),

  thresholdAmount: numeric("threshold_amount", {
    precision: 15,
    scale: 2,
  })
    .notNull()
    .default("0"),

  effectiveFrom: date("effective_from").notNull(),

  effectiveTo: date("effective_to"),

  remarks: text("remarks"),

  status: boolean("status").notNull().default(true),

  // Soft delete
  isDeleted: boolean("is_deleted").notNull().default(false),

  deletedBy: integer("deleted_by")
    .references(() => usersTable.id),

  deletedAt: timestamp("deleted_at", {
    withTimezone: true,
  }),

  // Audit
  createdBy: integer("created_by")
    .notNull()
    .references(() => usersTable.id),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),

  updatedBy: integer("updated_by")
    .references(() => usersTable.id),

  updatedAt: timestamp("updated_at", {
    withTimezone: true,
  }),
});

export const tdsMasterRelations = relations(
  tdsMasterTable,
  ({ one }) => ({
    createdByUser: one(usersTable, {
      fields: [tdsMasterTable.createdBy],
      references: [usersTable.id],
    }),

    updatedByUser: one(usersTable, {
      fields: [tdsMasterTable.updatedBy],
      references: [usersTable.id],
    }),

    deletedByUser: one(usersTable, {
      fields: [tdsMasterTable.deletedBy],
      references: [usersTable.id],
    }),
  }),
);

export type TdsMasterRecord = typeof tdsMasterTable.$inferSelect;

export const insertTdsMasterSchema = z
  .object({
    serviceName: z.string().trim().min(1),

    paymentNature: z.string().trim().min(1),

    sectionCode: z.string().trim().min(1),

    ratePercent: z
      .string()
      .trim()
      .min(1, "Rate is required")
      .refine(
        (value) => {
          const num = Number(value);
          return !Number.isNaN(num) && num >= 0 && num <= 100;
        },
        {
          message: "Rate must be between 0 and 100",
        },
      ),

    thresholdAmount: z
      .string()
      .trim()
      .min(1, "Threshold amount is required")
      .refine(
        (value) => {
          const num = Number(value);
          return !Number.isNaN(num) && num >= 0;
        },
        {
          message: "Threshold amount must be greater than or equal to 0",
        },
      )
      .default("0"),

    effectiveFrom: z.string().date(),

    effectiveTo: z.string().date().nullable().optional(),

    remarks: z.string().trim().optional(),

    status: z.boolean().default(true),
  })
  .refine(
    (data) => !data.effectiveTo || data.effectiveTo >= data.effectiveFrom,
    {
      message: "Effective To must be greater than or equal to Effective From",
      path: ["effectiveTo"],
    },
  );

export const updateTdsMasterSchema = insertTdsMasterSchema.partial();

export const updateTdsStatusSchema = z.object({
  status: z.boolean(),
});

export const tdsMasterQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),

  limit: z.coerce.number().int().positive().max(100).default(10),

  search: z.string().trim().optional(),

  status: z.enum(["all", "active", "inactive"]).optional(),

  paginate: z.enum(["true", "false"]).default("true"),
});

export type InsertTdsMaster = z.infer<typeof insertTdsMasterSchema>;

export type UpdateTdsMaster = z.infer<typeof updateTdsMasterSchema>;
