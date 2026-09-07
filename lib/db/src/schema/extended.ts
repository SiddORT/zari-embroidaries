/**
 * Extended schema — tables that were previously created at runtime
 * (via `ensureShippingTables`, `ensureSettingsTables`, or manual psql)
 * and were missing from the Drizzle source of truth. Consolidated here
 * so Replit's publish-time schema diff can create them in production.
 *
 * Do not add new tables to this file; create a domain-specific file
 * (e.g. `quotations.ts`, `packing.ts`) instead. This file exists
 * only to absorb the legacy gap.
 */
import { sql } from "drizzle-orm";
import {
  pgTable, foreignKey, check, serial, text, integer, numeric, date,
  timestamp, unique, boolean, jsonb, index, primaryKey,
} from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";
import { invoicesTable } from "./invoices";
import { purchaseOrdersTable } from "./costing";
import { usersTable } from "./users";

export const activityLogs = pgTable("activity_logs", {
        id: serial().primaryKey().notNull(),
        userEmail: text("user_email").notNull(),
        userName: text("user_name").default('').notNull(),
        method: text().notNull(),
        url: text().notNull(),
        action: text().default('').notNull(),
        statusCode: integer("status_code").default(200).notNull(),
        ipAddress: text("ip_address").default('').notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const downloadLogs = pgTable("download_logs", {
        id: serial().primaryKey().notNull(),
        userId: integer("user_id"),
        userName: text("user_name").default('').notNull(),
        userEmail: text("user_email").default('').notNull(),
        fileType: text("file_type").notNull(),
        fileName: text("file_name").notNull(),
        module: text().default('').notNull(),
        reference: text().default('').notNull(),
        downloadedAt: timestamp("downloaded_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
        index("idx_download_logs_downloaded_at").using("btree", table.downloadedAt.desc().nullsFirst().op("timestamptz_ops")),
        index("idx_download_logs_user_id").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
        foreignKey({
                        columns: [table.userId],
                        foreignColumns: [usersTable.id],
                        name: "download_logs_user_id_fkey"
                }).onDelete("set null"),
]);

export const bankAccounts = pgTable("bank_accounts", {
        id: serial().primaryKey().notNull(),
        bankName: text("bank_name").notNull(),
        accountNo: text("account_no").notNull(),
        ifscCode: text("ifsc_code").default('').notNull(),
        branch: text().default('').notNull(),
        accountName: text("account_name").default('').notNull(),
        bankUpi: text("bank_upi").default('').notNull(),
        isDefault: boolean("is_default").default(false).notNull(),
        createdBy: text("created_by").default('').notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const companyGstSettings = pgTable("company_gst_settings", {
        gstSettingsId: serial("gst_settings_id").primaryKey().notNull(),
        companyGstin: text("company_gstin").default('').notNull(),
        companyState: text("company_state").default('').notNull(),
        companyCountry: text("company_country").default('India').notNull(),
        exportUnderLutEnabled: boolean("export_under_lut_enabled").default(true).notNull(),
        reverseChargeEnabled: boolean("reverse_charge_enabled").default(false).notNull(),
        gstMode: text("gst_mode").default('Auto Detect').notNull(),
        defaultServiceGstRate: numeric("default_service_gst_rate", { precision: 5, scale:  2 }).default('18').notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
        companyName: text("company_name").default('ZARI EMBROIDERIES').notNull(),
        companyAddress: text("company_address").default('').notNull(),
        companyPhone: text("company_phone").default('').notNull(),
        companyEmail: text("company_email").default('').notNull(),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const currencies = pgTable("currencies", {
        code: text().primaryKey().notNull(),
        name: text().notNull(),
        symbol: text().notNull(),
        decimalPlaces: integer("decimal_places").default(2).notNull(),
        isActive: boolean("is_active").default(true).notNull(),
        isBase: boolean("is_base").default(false).notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const exchangeRates = pgTable("exchange_rates", {
        id: serial().primaryKey().notNull(),
        currencyCode: text("currency_code").notNull(),
        rate: numeric({ precision: 20, scale:  6 }).notNull(),
        sourceType: text("source_type").default('Auto').notNull(),
        isManualOverride: boolean("is_manual_override").default(false).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const invoiceTemplates = pgTable("invoice_templates", {
        id: serial().primaryKey().notNull(),
        name: text().notNull(),
        layout: text().default('classic').notNull(),
        paymentTerms: text("payment_terms").default('').notNull(),
        notes: text().default('').notNull(),
        isDefault: boolean("is_default").default(false).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const warehouseLocations = pgTable("warehouse_locations", {
        id: serial().primaryKey().notNull(),
        name: text().notNull(),
        code: text().default('').notNull(),
        addressLine1: text("address_line1").default('').notNull(),
        addressLine2: text("address_line2").default('').notNull(),
        city: text().default('').notNull(),
        state: text().default('').notNull(),
        pincode: text().default('').notNull(),
        country: text().default('India').notNull(),
        contactName: text("contact_name").default('').notNull(),
        contactPhone: text("contact_phone").default('').notNull(),
        contactEmail: text("contact_email").default('').notNull(),
        isActive: boolean("is_active").default(true).notNull(),
        notes: text().default('').notNull(),
        createdBy: text("created_by").default('').notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const shippingVendors = pgTable("shipping_vendors", {
        id: serial().primaryKey().notNull(),
        vendorName: text("vendor_name").notNull(),
        contactPerson: text("contact_person"),
        phoneNumber: text("phone_number"),
        emailAddress: text("email_address"),
        weightRatePerKg: numeric("weight_rate_per_kg", { precision: 12, scale:  4 }).default('0').notNull(),
        minimumCharge: numeric("minimum_charge", { precision: 12, scale:  2 }).default('0').notNull(),
        remarks: text(),
        isActive: boolean("is_active").default(true).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const orderShippingDetails = pgTable("order_shipping_details", {
        id: serial().primaryKey().notNull(),
        referenceType: text("reference_type").notNull(),
        referenceId: integer("reference_id").notNull(),
        clientName: text("client_name"),
        shippingVendorId: integer("shipping_vendor_id"),
        trackingNumber: text("tracking_number"),
        trackingUrl: text("tracking_url"),
        shipmentWeight: numeric("shipment_weight", { precision: 12, scale:  4 }).default('0').notNull(),
        ratePerKg: numeric("rate_per_kg", { precision: 12, scale:  4 }).default('0').notNull(),
        calculatedShippingAmount: numeric("calculated_shipping_amount", { precision: 12, scale:  2 }).default('0').notNull(),
        manualShippingAmountOverride: numeric("manual_shipping_amount_override", { precision: 12, scale:  2 }),
        finalShippingAmount: numeric("final_shipping_amount", { precision: 12, scale:  2 }).default('0').notNull(),
        shipmentStatus: text("shipment_status").default('Pending').notNull(),
        shipmentDate: date("shipment_date"),
        expectedDeliveryDate: date("expected_delivery_date"),
        actualDeliveryDate: date("actual_delivery_date"),
        remarks: text(),
        createdBy: text("created_by").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
        foreignKey({
                        columns: [table.shippingVendorId],
                        foreignColumns: [shippingVendors.id],
                        name: "order_shipping_details_shipping_vendor_id_fkey"
                }),
        check("order_shipping_details_reference_type_check", sql`reference_type = ANY (ARRAY['Swatch'::text, 'Style'::text, 'PackingList'::text])`),
]);

export const deliveryAddresses = pgTable("delivery_addresses", {
        id: serial().primaryKey().notNull(),
        clientId: integer("client_id").notNull(),
        clientAddressId: text("client_address_id"),
        label: text().default('Default').notNull(),
        addressLine1: text("address_line1"),
        addressLine2: text("address_line2"),
        city: text(),
        state: text(),
        country: text(),
        pincode: text(),
        isDefault: boolean("is_default").default(false).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
        foreignKey({
                        columns: [table.clientId],
                        foreignColumns: [clientsTable.id],
                        name: "delivery_addresses_client_id_fkey"
                }).onDelete("cascade"),
]);

export const vendorInvoiceLedger = pgTable("vendor_invoice_ledger", {
        id: serial().primaryKey().notNull(),
        vendorId: integer("vendor_id").notNull(),
        vendorName: text("vendor_name"),
        purchaseReceiptId: integer("purchase_receipt_id").notNull(),
        prNumber: text("pr_number").notNull(),
        vendorInvoiceNumber: text("vendor_invoice_number").notNull(),
        vendorInvoiceDate: date("vendor_invoice_date"),
        vendorInvoiceAmount: numeric("vendor_invoice_amount", { precision: 12, scale:  2 }).notNull(),
        currencyCode: text("currency_code").default('INR').notNull(),
        exchangeRateSnapshot: numeric("exchange_rate_snapshot", { precision: 18, scale:  6 }).default('1').notNull(),
        baseCurrencyAmount: numeric("base_currency_amount", { precision: 18, scale:  2 }).default('0').notNull(),
        entryType: text("entry_type").default('Vendor Invoice').notNull(),
        status: text().default('Unpaid').notNull(),
        notes: text(),
        createdBy: text("created_by"),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
        paidAmount: numeric("paid_amount", { precision: 18, scale:  2 }).default('0').notNull(),
        legacyPaidBase: numeric("legacy_paid_base", { precision: 18, scale:  2 }).default('0').notNull(),
        pendingAmount: numeric("pending_amount", { precision: 18, scale:  2 }).generatedAlwaysAs(sql`(vendor_invoice_amount - paid_amount)`),
        linkedPoNumber: text("linked_po_number").default(''),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
        index("idx_vendor_invoice_ledger_pr").using("btree", table.purchaseReceiptId.asc().nullsLast().op("int4_ops")),
        index("idx_vendor_invoice_ledger_vendor").using("btree", table.vendorId.asc().nullsLast().op("int4_ops")),
]);

export const clientInvoiceLedger = pgTable("client_invoice_ledger", {
        id: serial().primaryKey().notNull(),
        clientId: integer("client_id"),
        invoiceId: integer("invoice_id"),
        entryType: text("entry_type").default('Payment Received').notNull(),
        paymentAmount: numeric("payment_amount", { precision: 18, scale:  2 }).notNull(),
        paymentDate: text("payment_date").notNull(),
        transactionReference: text("transaction_reference").default(''),
        status: text().default('Completed'),
        createdBy: text("created_by").default(''),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
        index("idx_client_invoice_ledger_client").using("btree", table.clientId.asc().nullsLast().op("int4_ops")),
        index("idx_client_invoice_ledger_invoice").using("btree", table.invoiceId.asc().nullsLast().op("int4_ops")),
]);

export const otherExpenses = pgTable("other_expenses", {
        expenseId: serial("expense_id").primaryKey().notNull(),
        expenseNumber: text("expense_number").notNull(),
        expenseCategory: text("expense_category").notNull(),
        vendorId: integer("vendor_id"),
        vendorName: text("vendor_name").default(''),
        referenceType: text("reference_type").default('Manual'),
        referenceId: text("reference_id").default(''),
        hsnId: integer("hsn_id").notNull(),
        hsnCode: text("hsn_code").notNull(),
        gstPercentage: text("gst_percentage").notNull().default("5"),
        amount: numeric({ precision: 18, scale:  2 }).notNull(),
        currencyCode: text("currency_code").default('INR').notNull(),
        paymentStatus: text("payment_status").default('Unpaid').notNull(),
        paymentType: text("payment_type").default(''),
        paidAmount: numeric("paid_amount", { precision: 18, scale:  2 }).default('0').notNull(),
        expenseDate: text("expense_date").notNull(),
        remarks: text().default(''),
        attachment: text().default(''),
        createdBy: text("created_by").default(''),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
        unique("other_expenses_expense_number_key").on(table.expenseNumber),
]);

export const invoicePayments = pgTable("invoice_payments", {
        paymentId: serial("payment_id").primaryKey().notNull(),
        invoiceId: integer("invoice_id").notNull(),
        paymentDirection: text("payment_direction").default('Received').notNull(),
        partyId: integer("party_id"),
        paymentType: text("payment_type").default('Bank Transfer').notNull(),
        paymentAmount: numeric("payment_amount", { precision: 18, scale:  2 }).notNull(),
        currencyCode: text("currency_code").default('INR').notNull(),
        exchangeRateSnapshot: numeric("exchange_rate_snapshot", { precision: 18, scale:  6 }).default('1').notNull(),
        baseCurrencyAmount: numeric("base_currency_amount", { precision: 18, scale:  2 }).notNull(),
        transactionReference: text("transaction_reference").default(''),
        paymentStatus: text("payment_status").default('Completed').notNull(),
        paymentDate: text("payment_date").notNull(),
        remarks: text().default(''),
        attachment: text().default(''),
        createdBy: text("created_by").default(''),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
        index("idx_invoice_payments_invoice").using("btree", table.invoiceId.asc().nullsLast().op("int4_ops")),
        index("idx_invoice_payments_party").using("btree", table.partyId.asc().nullsLast().op("int4_ops")),
        foreignKey({
                        columns: [table.invoiceId],
                        foreignColumns: [invoicesTable.id],
                        name: "invoice_payments_invoice_id_fkey"
                }).onDelete("cascade"),
]);

export const creditDebitNotes = pgTable("credit_debit_notes", {
        noteId: serial("note_id").primaryKey().notNull(),
        noteNumber: text("note_number").notNull(),
        noteType: text("note_type").notNull(),
        referenceType: text("reference_type").default('Manual Entry').notNull(),
        invoiceId: integer("invoice_id"),
        vendorBillId: integer("vendor_bill_id"),
        partyId: integer("party_id"),
        partyName: text("party_name"),
        partyType: text("party_type"),
        currencyCode: text("currency_code").default('INR').notNull(),
        exchangeRateSnapshot: numeric("exchange_rate_snapshot", { precision: 18, scale:  6 }).default('1').notNull(),
        noteAmount: numeric("note_amount", { precision: 18, scale:  2 }).notNull(),
        baseCurrencyAmount: numeric("base_currency_amount", { precision: 18, scale:  2 }).notNull(),
        reason: text().notNull(),
        remarks: text(),
        noteDate: text("note_date").notNull(),
        status: text().default('Draft').notNull(),
        createdBy: text("created_by"),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
        index("idx_cdn_invoice").using("btree", table.invoiceId.asc().nullsLast().op("int4_ops")),
        index("idx_cdn_party").using("btree", table.partyId.asc().nullsLast().op("int4_ops")),
        index("idx_cdn_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
        index("idx_cdn_type").using("btree", table.noteType.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.invoiceId],
                        foreignColumns: [invoicesTable.id],
                        name: "credit_debit_notes_invoice_id_fkey"
                }).onDelete("set null"),
        unique("credit_debit_notes_note_number_key").on(table.noteNumber),
]);

export const purchaseOrderItems = pgTable("purchase_order_items", {
        id: serial().primaryKey().notNull(),
        poId: integer("po_id").notNull(),
        vendorId: integer("vendor_id"),
        vendorName: text("vendor_name"),
        inventoryItemId: integer("inventory_item_id"),
        itemName: text("item_name").notNull(),
        itemCode: text("item_code").default('').notNull(),
        orderedQuantity: numeric("ordered_quantity", { precision: 14, scale:  3 }).notNull(),
        receivedQuantity: numeric("received_quantity", { precision: 14, scale:  3 }).default('0').notNull(),
        hsnId: integer("hsn_id"),
        hsnCode: text("hsn_code"),
        gstPercentage: numeric("gst_percentage", { precision: 5, scale: 2 }).default('0'),
        unitPrice: numeric("unit_price", { precision: 14, scale:  2 }).default('0').notNull(),
        warehouseLocation: text("warehouse_location"),
        remarks: text(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
        itemImage: text("item_image"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
        foreignKey({
                        columns: [table.poId],
                        foreignColumns: [purchaseOrdersTable.id],
                        name: "purchase_order_items_po_id_fkey"
                }).onDelete("cascade"),
]);

export const purchaseReceiptItems = pgTable("purchase_receipt_items", {
        id: serial().primaryKey().notNull(),
        prId: integer("pr_id").notNull(),
        inventoryItemId: integer("inventory_item_id").notNull(),
        itemName: text("item_name").notNull(),
        itemCode: text("item_code").notNull(),
        hsnId: integer("hsn_id"),
        hsnCode: text("hsn_code"),
        gstPercentage: numeric("gst_percentage", { precision: 5, scale: 2 }).default('0'),
        quantity: numeric({ precision: 14, scale:  3 }).notNull(),
        unitPrice: numeric("unit_price", { precision: 14, scale:  2 }).default('0').notNull(),
        warehouseLocation: text("warehouse_location"),
        remarks: text(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
        poItemId: integer("po_item_id"),
        itemImage: text("item_image"),
        vendorId: integer("vendor_id"),
        vendorName: text("vendor_name"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
        foreignKey({
                        columns: [table.poItemId],
                        foreignColumns: [purchaseOrderItems.id],
                        name: "purchase_receipt_items_po_item_id_fkey"
                }),
]);

export const quotations = pgTable("quotations", {
        id: serial().primaryKey().notNull(),
        quotationNumber: text("quotation_number").notNull(),
        clientId: integer("client_id"),
        clientName: text("client_name"),
        clientState: text("client_state"),
        requirementSummary: text("requirement_summary"),
        estimatedWeight: numeric("estimated_weight", { precision: 10, scale:  3 }).default('0'),
        estimatedShippingCharges: numeric("estimated_shipping_charges", { precision: 14, scale:  2 }).default('0'),
        subtotalAmount: numeric("subtotal_amount", { precision: 14, scale:  2 }).default('0'),
        gstType: text("gst_type").default('IGST'),
        gstRate: numeric("gst_rate", { precision: 5, scale:  2 }).default('18'),
        gstAmount: numeric("gst_amount", { precision: 14, scale:  2 }).default('0'),
        totalAmount: numeric("total_amount", { precision: 14, scale:  2 }).default('0'),
        status: text().default('Draft').notNull(),
        revisionNumber: integer("revision_number").default(1).notNull(),
        parentQuotationId: integer("parent_quotation_id"),
        internalNotes: text("internal_notes"),
        clientNotes: text("client_notes"),
        convertedTo: text("converted_to"),
        convertedReferenceId: text("converted_reference_id"),
        convertedAt: timestamp("converted_at", { withTimezone: true, mode: 'string' }),
        createdBy: text("created_by"),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
        coverPage: text("cover_page").default('classic').notNull(),
        coverPageImage: text("cover_page_image"),
        shippingRatePerKg: numeric("shipping_rate_per_kg").default('0'),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
        foreignKey({
                        columns: [table.parentQuotationId],
                        foreignColumns: [table.id],
                        name: "quotations_parent_quotation_id_fkey"
                }),
        unique("quotations_quotation_number_key").on(table.quotationNumber),
]);

export const quotationDesigns = pgTable("quotation_designs", {
        id: serial().primaryKey().notNull(),
        quotationId: integer("quotation_id").notNull(),
        designName: text("design_name").notNull(),
        hsnCode: text("hsn_code"),
        designImage: text("design_image"),
        remarks: text(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
        foreignKey({
                        columns: [table.quotationId],
                        foreignColumns: [quotations.id],
                        name: "quotation_designs_quotation_id_fkey"
                }).onDelete("cascade"),
]);

export const quotationCustomCharges = pgTable("quotation_custom_charges", {
        id: serial().primaryKey().notNull(),
        quotationId: integer("quotation_id").notNull(),
        chargeName: text("charge_name").notNull(),
        hsnCode: text("hsn_code"),
        unit: text(),
        quantity: numeric({ precision: 14, scale:  3 }).default('1'),
        price: numeric({ precision: 14, scale:  2 }).default('0'),
        amount: numeric({ precision: 14, scale:  2 }).default('0'),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
        foreignKey({
                        columns: [table.quotationId],
                        foreignColumns: [quotations.id],
                        name: "quotation_custom_charges_quotation_id_fkey"
                }).onDelete("cascade"),
]);

export const quotationFeedbackLogs = pgTable("quotation_feedback_logs", {
        id: serial().primaryKey().notNull(),
        quotationId: integer("quotation_id").notNull(),
        feedbackText: text("feedback_text").notNull(),
        feedbackBy: text("feedback_by"),
        feedbackDate: text("feedback_date").notNull(),
        revisionReference: text("revision_reference"),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
        foreignKey({
                        columns: [table.quotationId],
                        foreignColumns: [quotations.id],
                        name: "quotation_feedback_logs_quotation_id_fkey"
                }).onDelete("cascade"),
]);

export const packingLists = pgTable("packing_lists", {
        id: serial().primaryKey().notNull(),
        plNumber: text("pl_number").notNull(),
        clientId: integer("client_id").notNull(),
        deliveryAddressId: integer("delivery_address_id"),
        shipmentId: integer("shipment_id"),
        destinationCountry: text("destination_country"),
        packageCount: integer("package_count"),
        packageType: text("package_type"),
        dimensions: text(),
        netWeight: numeric("net_weight", { precision: 12, scale:  3 }),
        grossWeight: numeric("gross_weight", { precision: 12, scale:  3 }),
        status: text().default('Draft').notNull(),
        remarks: text(),
        createdBy: text("created_by"),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
        foreignKey({
                        columns: [table.clientId],
                        foreignColumns: [clientsTable.id],
                        name: "packing_lists_client_id_fkey"
                }),
        foreignKey({
                        columns: [table.deliveryAddressId],
                        foreignColumns: [deliveryAddresses.id],
                        name: "packing_lists_delivery_address_id_fkey"
                }),
        foreignKey({
                        columns: [table.shipmentId],
                        foreignColumns: [orderShippingDetails.id],
                        name: "packing_lists_shipment_id_fkey"
                }),
        unique("packing_lists_pl_number_key").on(table.plNumber),
]);

export const packingListItems = pgTable("packing_list_items", {
        id: serial().primaryKey().notNull(),
        packingListId: integer("packing_list_id").notNull(),
        itemType: text("item_type").notNull(),
        itemId: integer("item_id").notNull(),
        orderCode: text("order_code"),
        description: text(),
        qty: numeric({ precision: 12, scale:  3 }),
        unit: text(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
        weightKg: numeric("weight_kg", { precision: 10, scale:  3 }),
        itemImageUrl: text("item_image_url"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
        foreignKey({
                        columns: [table.packingListId],
                        foreignColumns: [packingLists.id],
                        name: "packing_list_items_packing_list_id_fkey"
                }).onDelete("cascade"),
]);

export const packingPackages = pgTable("packing_packages", {
        id: serial().primaryKey().notNull(),
        packingListId: integer("packing_list_id").notNull(),
        packageNumber: integer("package_number").notNull(),
        length: numeric({ precision: 10, scale:  2 }),
        width: numeric({ precision: 10, scale:  2 }),
        height: numeric({ precision: 10, scale:  2 }),
        netWeight: numeric("net_weight", { precision: 12, scale:  3 }),
        grossWeight: numeric("gross_weight", { precision: 12, scale:  3 }),
        shipmentId: integer("shipment_id"),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
        foreignKey({
                        columns: [table.packingListId],
                        foreignColumns: [packingLists.id],
                        name: "packing_packages_packing_list_id_fkey"
                }).onDelete("cascade"),
]);

export const packingPackageItems = pgTable("packing_package_items", {
        id: serial().primaryKey().notNull(),
        packageId: integer("package_id").notNull(),
        orderType: text("order_type"),
        orderId: integer("order_id"),
        productId: integer("product_id"),
        orderCode: text("order_code"),
        description: text(),
        quantity: numeric({ precision: 12, scale:  3 }),
        unit: text(),
        itemWeight: numeric("item_weight", { precision: 10, scale:  3 }),
        itemImageUrl: text("item_image_url"),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
        itemSource: text("item_source").default('order').notNull(),
        inventoryId: integer("inventory_id"),
        inventoryType: text("inventory_type"),
        stockDeducted: numeric("stock_deducted", { precision: 12, scale:  3 }).default('0'),
        deductedFromLocation: text("deducted_from_location"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
        foreignKey({
                        columns: [table.packageId],
                        foreignColumns: [packingPackages.id],
                        name: "packing_package_items_package_id_fkey"
                }).onDelete("cascade"),
]);

export type ActivityLogsRecord = typeof activityLogs.$inferSelect;
export type DownloadLogsRecord = typeof downloadLogs.$inferSelect;
export type BankAccountsRecord = typeof bankAccounts.$inferSelect;
export type CompanyGstSettingsRecord = typeof companyGstSettings.$inferSelect;
export type CurrenciesRecord = typeof currencies.$inferSelect;
export type ExchangeRatesRecord = typeof exchangeRates.$inferSelect;
export type InvoiceTemplatesRecord = typeof invoiceTemplates.$inferSelect;
export type WarehouseLocationsRecord = typeof warehouseLocations.$inferSelect;
export type ShippingVendorsRecord = typeof shippingVendors.$inferSelect;
export type OrderShippingDetailsRecord = typeof orderShippingDetails.$inferSelect;
export type DeliveryAddressesRecord = typeof deliveryAddresses.$inferSelect;
export type VendorInvoiceLedgerRecord = typeof vendorInvoiceLedger.$inferSelect;
export type ClientInvoiceLedgerRecord = typeof clientInvoiceLedger.$inferSelect;
export type OtherExpensesRecord = typeof otherExpenses.$inferSelect;
export type InvoicePaymentsRecord = typeof invoicePayments.$inferSelect;
export type CreditDebitNotesRecord = typeof creditDebitNotes.$inferSelect;
export type PurchaseOrderItemsRecord = typeof purchaseOrderItems.$inferSelect;
export type PurchaseReceiptItemsRecord = typeof purchaseReceiptItems.$inferSelect;
export type QuotationsRecord = typeof quotations.$inferSelect;
export type QuotationDesignsRecord = typeof quotationDesigns.$inferSelect;
export type QuotationCustomChargesRecord = typeof quotationCustomCharges.$inferSelect;
export type QuotationFeedbackLogsRecord = typeof quotationFeedbackLogs.$inferSelect;
export type PackingListsRecord = typeof packingLists.$inferSelect;
export type PackingListItemsRecord = typeof packingListItems.$inferSelect;
export type PackingPackagesRecord = typeof packingPackages.$inferSelect;
export type PackingPackageItemsRecord = typeof packingPackageItems.$inferSelect;
