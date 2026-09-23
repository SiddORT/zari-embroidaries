import { pgTable, serial, integer, varchar, numeric, timestamp, text, boolean} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { vendorChallansTable } from "./vendorChallans";
import { hsnTable } from "./hsn"; 

export const vendorChallanItems = pgTable(
  "vendor_challan_items",
  {
    id: serial("id").primaryKey(),
    vendorChallanId: integer("vendor_challan_id")
      .notNull()
      .references(() => vendorChallansTable.id, { onDelete: "cascade" }),
    description: varchar("description", { length: 500 }),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    unit: varchar("unit", { length: 50 }),
    rate: numeric("rate", { precision: 14, scale: 2 }).notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    hsnId: integer("hsn_id").references(() => hsnTable.id, { onDelete: "set null", }),
    hsnCode: varchar("hsn_code", { length: 20 }),
    gstPercentage: numeric("gst_percentage", { precision: 5, scale: 2 }).notNull(),
    isDeleted: boolean("is_deleted").notNull().default(false),
    deletedBy: text("deleted_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }), 
  },
);

export const vendorChallanItemsRelations = relations(
  vendorChallanItems,
  ({ one }) => ({
    vendorChallan: one(vendorChallansTable, {
      fields: [vendorChallanItems.vendorChallanId],
      references: [vendorChallansTable.id],
    }),
    hsn: one(hsnTable, {
      fields: [vendorChallanItems.hsnId],
      references: [hsnTable.id],
    }),
  })
);
