import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { db, usersTable, rolesTable, rolePermissionsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { hashPassword } from "../lib/auth";
import { logger } from "../lib/logger";
import { sendInviteEmail, sendAdminPasswordResetEmail } from "../lib/mailer";

function buildInviteUrl(token: string): string {
  const domain =
    process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.APP_URL ?? "http://localhost:5173";
  return `${domain}/accept-invite?token=${token}`;
}

const router: IRouter = Router();

export const SUPERUSER_EMAIL = "admin@zarierp";

export const ALL_PERMISSIONS = [
  /* ── Dashboard ─────────────────────────────────────────── */
  { key: "dashboard:view",  label: "Dashboard",  resource: "dashboard",  action: "view",  menu: "Dashboard", subgroup: null },

  /* ── Masters ───────────────────────────────────────────── */
  { key: "masters:hsn:view",                    label: "HSN",                resource: "masters:hsn",                 action: "view",     menu: "Masters", subgroup: null },
  { key: "masters:hsn:add_edit",                label: "HSN",                resource: "masters:hsn",                 action: "add_edit", menu: "Masters", subgroup: null },
  { key: "masters:hsn:delete",                  label: "HSN",                resource: "masters:hsn",                 action: "delete",   menu: "Masters", subgroup: null },
  { key: "masters:hsn:download",                label: "HSN",                resource: "masters:hsn",                 action: "download", menu: "Masters", subgroup: null },

  { key: "masters:materials:view",              label: "Materials",           resource: "masters:materials",           action: "view",     menu: "Masters", subgroup: null },
  { key: "masters:materials:add_edit",          label: "Materials",           resource: "masters:materials",           action: "add_edit", menu: "Masters", subgroup: null },
  { key: "masters:materials:delete",            label: "Materials",           resource: "masters:materials",           action: "delete",   menu: "Masters", subgroup: null },
  { key: "masters:materials:download",          label: "Materials",           resource: "masters:materials",           action: "download", menu: "Masters", subgroup: null },

  { key: "masters:fabric:view",                 label: "Fabric",              resource: "masters:fabric",              action: "view",     menu: "Masters", subgroup: null },
  { key: "masters:fabric:add_edit",             label: "Fabric",              resource: "masters:fabric",              action: "add_edit", menu: "Masters", subgroup: null },
  { key: "masters:fabric:delete",               label: "Fabric",              resource: "masters:fabric",              action: "delete",   menu: "Masters", subgroup: null },
  { key: "masters:fabric:download",             label: "Fabric",              resource: "masters:fabric",              action: "download", menu: "Masters", subgroup: null },

  { key: "masters:clients:view",                label: "Clients",             resource: "masters:clients",             action: "view",     menu: "Masters", subgroup: null },
  { key: "masters:clients:add_edit",            label: "Clients",             resource: "masters:clients",             action: "add_edit", menu: "Masters", subgroup: null },
  { key: "masters:clients:delete",              label: "Clients",             resource: "masters:clients",             action: "delete",   menu: "Masters", subgroup: null },
  { key: "masters:clients:download",            label: "Clients",             resource: "masters:clients",             action: "download", menu: "Masters", subgroup: null },

  { key: "masters:vendors:view",                label: "Vendors",             resource: "masters:vendors",             action: "view",     menu: "Masters", subgroup: null },
  { key: "masters:vendors:add_edit",            label: "Vendors",             resource: "masters:vendors",             action: "add_edit", menu: "Masters", subgroup: null },
  { key: "masters:vendors:delete",              label: "Vendors",             resource: "masters:vendors",             action: "delete",   menu: "Masters", subgroup: null },
  { key: "masters:vendors:download",            label: "Vendors",             resource: "masters:vendors",             action: "download", menu: "Masters", subgroup: null },

  { key: "masters:style_categories:view",       label: "Style Categories",    resource: "masters:style_categories",    action: "view",     menu: "Masters", subgroup: null },
  { key: "masters:style_categories:add_edit",   label: "Style Categories",    resource: "masters:style_categories",    action: "add_edit", menu: "Masters", subgroup: null },
  { key: "masters:style_categories:delete",     label: "Style Categories",    resource: "masters:style_categories",    action: "delete",   menu: "Masters", subgroup: null },

  { key: "masters:swatch_categories:view",      label: "Swatch Categories",   resource: "masters:swatch_categories",   action: "view",     menu: "Masters", subgroup: null },
  { key: "masters:swatch_categories:add_edit",  label: "Swatch Categories",   resource: "masters:swatch_categories",   action: "add_edit", menu: "Masters", subgroup: null },
  { key: "masters:swatch_categories:delete",    label: "Swatch Categories",   resource: "masters:swatch_categories",   action: "delete",   menu: "Masters", subgroup: null },

  { key: "masters:swatches:view",               label: "Swatch",              resource: "masters:swatches",            action: "view",     menu: "Masters", subgroup: null },
  { key: "masters:swatches:add_edit",           label: "Swatch",              resource: "masters:swatches",            action: "add_edit", menu: "Masters", subgroup: null },
  { key: "masters:swatches:delete",             label: "Swatch",              resource: "masters:swatches",            action: "delete",   menu: "Masters", subgroup: null },
  { key: "masters:swatches:download",           label: "Swatch",              resource: "masters:swatches",            action: "download", menu: "Masters", subgroup: null },

  { key: "masters:styles:view",                 label: "Style",               resource: "masters:styles",              action: "view",     menu: "Masters", subgroup: null },
  { key: "masters:styles:add_edit",             label: "Style",               resource: "masters:styles",              action: "add_edit", menu: "Masters", subgroup: null },
  { key: "masters:styles:delete",               label: "Style",               resource: "masters:styles",              action: "delete",   menu: "Masters", subgroup: null },
  { key: "masters:styles:download",             label: "Style",               resource: "masters:styles",              action: "download", menu: "Masters", subgroup: null },

  { key: "masters:item_types:view",             label: "Item Types",          resource: "masters:item_types",          action: "view",     menu: "Masters", subgroup: null },
  { key: "masters:item_types:add_edit",         label: "Item Types",          resource: "masters:item_types",          action: "add_edit", menu: "Masters", subgroup: null },
  { key: "masters:item_types:delete",           label: "Item Types",          resource: "masters:item_types",          action: "delete",   menu: "Masters", subgroup: null },

  { key: "masters:packaging_materials:view",    label: "Item Master",         resource: "masters:packaging_materials", action: "view",     menu: "Masters", subgroup: null },
  { key: "masters:packaging_materials:add_edit",label: "Item Master",         resource: "masters:packaging_materials", action: "add_edit", menu: "Masters", subgroup: null },
  { key: "masters:packaging_materials:delete",  label: "Item Master",         resource: "masters:packaging_materials", action: "delete",   menu: "Masters", subgroup: null },

  { key: "masters:shipping_vendors:view",       label: "Shipping Vendors",    resource: "masters:shipping_vendors",    action: "view",     menu: "Masters", subgroup: null },
  { key: "masters:shipping_vendors:add_edit",   label: "Shipping Vendors",    resource: "masters:shipping_vendors",    action: "add_edit", menu: "Masters", subgroup: null },
  { key: "masters:shipping_vendors:delete",     label: "Shipping Vendors",    resource: "masters:shipping_vendors",    action: "delete",   menu: "Masters", subgroup: null },

  /* ── Orders ────────────────────────────────────────────── */
  { key: "swatch_orders:view",     label: "Swatch Orders", resource: "swatch_orders", action: "view",     menu: "Orders", subgroup: null },
  { key: "swatch_orders:add_edit", label: "Swatch Orders", resource: "swatch_orders", action: "add_edit", menu: "Orders", subgroup: null },
  { key: "swatch_orders:delete",   label: "Swatch Orders", resource: "swatch_orders", action: "delete",   menu: "Orders", subgroup: null },
  { key: "swatch_orders:download", label: "Swatch Orders", resource: "swatch_orders", action: "download", menu: "Orders", subgroup: null },

  { key: "style_orders:view",      label: "Style Orders",  resource: "style_orders",  action: "view",     menu: "Orders", subgroup: null },
  { key: "style_orders:add_edit",  label: "Style Orders",  resource: "style_orders",  action: "add_edit", menu: "Orders", subgroup: null },
  { key: "style_orders:delete",    label: "Style Orders",  resource: "style_orders",  action: "delete",   menu: "Orders", subgroup: null },
  { key: "style_orders:download",  label: "Style Orders",  resource: "style_orders",  action: "download", menu: "Orders", subgroup: null },

  { key: "artwork:view",           label: "Artwork",        resource: "artwork",        action: "view",     menu: "Orders", subgroup: null },
  { key: "artwork:add_edit",       label: "Artwork",        resource: "artwork",        action: "add_edit", menu: "Orders", subgroup: null },
  { key: "artwork:delete",         label: "Artwork",        resource: "artwork",        action: "delete",   menu: "Orders", subgroup: null },
  { key: "artwork:download",       label: "Artwork",        resource: "artwork",        action: "download", menu: "Orders", subgroup: null },

  { key: "quotation:view",         label: "Quotation",      resource: "quotation",      action: "view",     menu: "Orders", subgroup: null },
  { key: "quotation:add_edit",     label: "Quotation",      resource: "quotation",      action: "add_edit", menu: "Orders", subgroup: null },
  { key: "quotation:delete",       label: "Quotation",      resource: "quotation",      action: "delete",   menu: "Orders", subgroup: null },
  { key: "quotation:download",     label: "Quotation",      resource: "quotation",      action: "download", menu: "Orders", subgroup: null },

  /* ── Stock ─────────────────────────────────────────────── */
  { key: "stock:dashboard:view",              label: "Inventory Dashboard", resource: "stock:dashboard",         action: "view",     menu: "Stock", subgroup: "Inventory" },

  { key: "stock:items:view",                  label: "Item Stock List",     resource: "stock:items",             action: "view",     menu: "Stock", subgroup: "Inventory" },
  { key: "stock:items:add_edit",              label: "Item Stock List",     resource: "stock:items",             action: "add_edit", menu: "Stock", subgroup: "Inventory" },
  { key: "stock:items:download",              label: "Item Stock List",     resource: "stock:items",             action: "download", menu: "Stock", subgroup: "Inventory" },

  { key: "stock:low_stock:view",              label: "Low Stock Alerts",    resource: "stock:low_stock",         action: "view",     menu: "Stock", subgroup: "Inventory" },
  { key: "stock:low_stock:download",          label: "Low Stock Alerts",    resource: "stock:low_stock",         action: "download", menu: "Stock", subgroup: "Inventory" },

  { key: "stock:ledger:view",                 label: "Stock Ledger",        resource: "stock:ledger",            action: "view",     menu: "Stock", subgroup: "Inventory" },
  { key: "stock:ledger:download",             label: "Stock Ledger",        resource: "stock:ledger",            action: "download", menu: "Stock", subgroup: "Inventory" },

  { key: "stock:reservations:view",           label: "Reservations",        resource: "stock:reservations",      action: "view",     menu: "Stock", subgroup: "Inventory" },

  { key: "stock:adjustments:view",            label: "Stock Adjustments",   resource: "stock:adjustments",       action: "view",     menu: "Stock", subgroup: "Inventory" },
  { key: "stock:adjustments:add_edit",        label: "Stock Adjustments",   resource: "stock:adjustments",       action: "add_edit", menu: "Stock", subgroup: "Inventory" },
  { key: "stock:adjustments:delete",          label: "Stock Adjustments",   resource: "stock:adjustments",       action: "delete",   menu: "Stock", subgroup: "Inventory" },

  { key: "stock:purchase_orders:view",        label: "Purchase Orders",     resource: "stock:purchase_orders",   action: "view",     menu: "Stock", subgroup: "Procurement" },
  { key: "stock:purchase_orders:add_edit",    label: "Purchase Orders",     resource: "stock:purchase_orders",   action: "add_edit", menu: "Stock", subgroup: "Procurement" },
  { key: "stock:purchase_orders:delete",      label: "Purchase Orders",     resource: "stock:purchase_orders",   action: "delete",   menu: "Stock", subgroup: "Procurement" },
  { key: "stock:purchase_orders:download",    label: "Purchase Orders",     resource: "stock:purchase_orders",   action: "download", menu: "Stock", subgroup: "Procurement" },

  { key: "stock:purchase_receipts:view",      label: "Purchase Receipts",   resource: "stock:purchase_receipts", action: "view",     menu: "Stock", subgroup: "Procurement" },
  { key: "stock:purchase_receipts:add_edit",  label: "Purchase Receipts",   resource: "stock:purchase_receipts", action: "add_edit", menu: "Stock", subgroup: "Procurement" },
  { key: "stock:purchase_receipts:delete",    label: "Purchase Receipts",   resource: "stock:purchase_receipts", action: "delete",   menu: "Stock", subgroup: "Procurement" },

  /* ── Logistics ──────────────────────────────────────────── */
  { key: "logistics:shipments:view",          label: "Shipments",           resource: "logistics:shipments",     action: "view",     menu: "Logistics", subgroup: null },
  { key: "logistics:shipments:add_edit",      label: "Shipments",           resource: "logistics:shipments",     action: "add_edit", menu: "Logistics", subgroup: null },
  { key: "logistics:shipments:delete",        label: "Shipments",           resource: "logistics:shipments",     action: "delete",   menu: "Logistics", subgroup: null },
  { key: "logistics:shipments:download",      label: "Shipments",           resource: "logistics:shipments",     action: "download", menu: "Logistics", subgroup: null },

  { key: "logistics:packing_lists:view",      label: "Packing Lists",       resource: "logistics:packing_lists", action: "view",     menu: "Logistics", subgroup: null },
  { key: "logistics:packing_lists:add_edit",  label: "Packing Lists",       resource: "logistics:packing_lists", action: "add_edit", menu: "Logistics", subgroup: null },
  { key: "logistics:packing_lists:delete",    label: "Packing Lists",       resource: "logistics:packing_lists", action: "delete",   menu: "Logistics", subgroup: null },
  { key: "logistics:packing_lists:download",  label: "Packing Lists",       resource: "logistics:packing_lists", action: "download", menu: "Logistics", subgroup: null },

  /* ── Accounts ───────────────────────────────────────────── */
  { key: "accounts:dashboard:view",           label: "Dashboard",           resource: "accounts:dashboard",          action: "view",     menu: "Accounts", subgroup: null },

  { key: "accounts:vendor_ledgers:view",      label: "Vendor Ledgers",      resource: "accounts:vendor_ledgers",     action: "view",     menu: "Accounts", subgroup: null },
  { key: "accounts:vendor_ledgers:download",  label: "Vendor Ledgers",      resource: "accounts:vendor_ledgers",     action: "download", menu: "Accounts", subgroup: null },

  { key: "accounts:purchases:view",           label: "Purchases",           resource: "accounts:purchases",          action: "view",     menu: "Accounts", subgroup: null },
  { key: "accounts:purchases:download",       label: "Purchases",           resource: "accounts:purchases",          action: "download", menu: "Accounts", subgroup: null },

  { key: "accounts:invoices:view",            label: "Invoices",            resource: "accounts:invoices",           action: "view",     menu: "Accounts", subgroup: null },
  { key: "accounts:invoices:add_edit",        label: "Invoices",            resource: "accounts:invoices",           action: "add_edit", menu: "Accounts", subgroup: null },
  { key: "accounts:invoices:delete",          label: "Invoices",            resource: "accounts:invoices",           action: "delete",   menu: "Accounts", subgroup: null },
  { key: "accounts:invoices:download",        label: "Invoices",            resource: "accounts:invoices",           action: "download", menu: "Accounts", subgroup: null },

  { key: "accounts:payments:view",            label: "Payments",            resource: "accounts:payments",           action: "view",     menu: "Accounts", subgroup: null },
  { key: "accounts:payments:add_edit",        label: "Payments",            resource: "accounts:payments",           action: "add_edit", menu: "Accounts", subgroup: null },
  { key: "accounts:payments:delete",          label: "Payments",            resource: "accounts:payments",           action: "delete",   menu: "Accounts", subgroup: null },
  { key: "accounts:payments:download",        label: "Payments",            resource: "accounts:payments",           action: "download", menu: "Accounts", subgroup: null },

  { key: "accounts:credit_debit_notes:view",     label: "Credit / Debit Notes", resource: "accounts:credit_debit_notes", action: "view",     menu: "Accounts", subgroup: null },
  { key: "accounts:credit_debit_notes:add_edit", label: "Credit / Debit Notes", resource: "accounts:credit_debit_notes", action: "add_edit", menu: "Accounts", subgroup: null },
  { key: "accounts:credit_debit_notes:delete",   label: "Credit / Debit Notes", resource: "accounts:credit_debit_notes", action: "delete",   menu: "Accounts", subgroup: null },
  { key: "accounts:credit_debit_notes:download", label: "Credit / Debit Notes", resource: "accounts:credit_debit_notes", action: "download", menu: "Accounts", subgroup: null },

  { key: "accounts:other_expenses:view",      label: "Other Expenses",      resource: "accounts:other_expenses",     action: "view",     menu: "Accounts", subgroup: null },
  { key: "accounts:other_expenses:add_edit",  label: "Other Expenses",      resource: "accounts:other_expenses",     action: "add_edit", menu: "Accounts", subgroup: null },
  { key: "accounts:other_expenses:delete",    label: "Other Expenses",      resource: "accounts:other_expenses",     action: "delete",   menu: "Accounts", subgroup: null },

  /* ── Admin › Settings ──────────────────────────────────── */
  { key: "settings:profile:view",          label: "Profile",           resource: "settings:profile",          action: "view",     menu: "Admin", subgroup: "Settings" },
  { key: "settings:profile:add_edit",      label: "Profile",           resource: "settings:profile",          action: "add_edit", menu: "Admin", subgroup: "Settings" },

  { key: "settings:currency:view",         label: "Currency",          resource: "settings:currency",         action: "view",     menu: "Admin", subgroup: "Settings" },
  { key: "settings:currency:add_edit",     label: "Currency",          resource: "settings:currency",         action: "add_edit", menu: "Admin", subgroup: "Settings" },
  { key: "settings:currency:delete",       label: "Currency",          resource: "settings:currency",         action: "delete",   menu: "Admin", subgroup: "Settings" },

  { key: "settings:banks:view",            label: "Bank Details",      resource: "settings:banks",            action: "view",     menu: "Admin", subgroup: "Settings" },
  { key: "settings:banks:add_edit",        label: "Bank Details",      resource: "settings:banks",            action: "add_edit", menu: "Admin", subgroup: "Settings" },
  { key: "settings:banks:delete",          label: "Bank Details",      resource: "settings:banks",            action: "delete",   menu: "Admin", subgroup: "Settings" },

  { key: "settings:gst:view",              label: "GST Settings",      resource: "settings:gst",              action: "view",     menu: "Admin", subgroup: "Settings" },
  { key: "settings:gst:add_edit",          label: "GST Settings",      resource: "settings:gst",              action: "add_edit", menu: "Admin", subgroup: "Settings" },

  { key: "settings:activity_logs:view",    label: "Activity Logs",     resource: "settings:activity_logs",    action: "view",     menu: "Admin", subgroup: "Settings" },
  { key: "settings:activity_logs:download",label: "Activity Logs",     resource: "settings:activity_logs",    action: "download", menu: "Admin", subgroup: "Settings" },

  { key: "settings:warehouses:view",       label: "Warehouses",        resource: "settings:warehouses",       action: "view",     menu: "Admin", subgroup: "Settings" },
  { key: "settings:warehouses:add_edit",   label: "Warehouses",        resource: "settings:warehouses",       action: "add_edit", menu: "Admin", subgroup: "Settings" },
  { key: "settings:warehouses:delete",     label: "Warehouses",        resource: "settings:warehouses",       action: "delete",   menu: "Admin", subgroup: "Settings" },

  { key: "settings:templates:view",        label: "Invoice Templates", resource: "settings:templates",        action: "view",     menu: "Admin", subgroup: "Settings" },
  { key: "settings:templates:add_edit",    label: "Invoice Templates", resource: "settings:templates",        action: "add_edit", menu: "Admin", subgroup: "Settings" },

  { key: "settings:download_logs:view",    label: "Download Logs",     resource: "settings:download_logs",    action: "view",     menu: "Admin", subgroup: "Settings" },
  { key: "settings:download_logs:download",label: "Download Logs",     resource: "settings:download_logs",    action: "download", menu: "Admin", subgroup: "Settings" },

  { key: "user_management:view",           label: "User Management",   resource: "user_management",           action: "view",     menu: "Admin", subgroup: null },
  { key: "user_management:add_edit",       label: "User Management",   resource: "user_management",           action: "add_edit", menu: "Admin", subgroup: null },
  { key: "user_management:delete",         label: "User Management",   resource: "user_management",           action: "delete",   menu: "Admin", subgroup: null },

  /* ── Style Order Tabs ───────────────────────────────────── */
  { key: "style_orders:tab:basic_info:view",          label: "Basic Info",          resource: "style_orders:tab:basic_info",          action: "view", menu: "Orders", subgroup: "Style Order Tabs" },
  { key: "style_orders:tab:completion_tracking:view", label: "Completion Tracking", resource: "style_orders:tab:completion_tracking", action: "view", menu: "Orders", subgroup: "Style Order Tabs" },
  { key: "style_orders:tab:references:view",          label: "References",          resource: "style_orders:tab:references",          action: "view", menu: "Orders", subgroup: "Style Order Tabs" },
  { key: "style_orders:tab:products:view",            label: "Products",            resource: "style_orders:tab:products",            action: "view", menu: "Orders", subgroup: "Style Order Tabs" },
  { key: "style_orders:tab:artworks:view",            label: "Artworks",            resource: "style_orders:tab:artworks",            action: "view", menu: "Orders", subgroup: "Style Order Tabs" },
  { key: "style_orders:tab:client_link:view",         label: "Client Link",         resource: "style_orders:tab:client_link",         action: "view", menu: "Orders", subgroup: "Style Order Tabs" },
  { key: "style_orders:tab:estimate:view",            label: "Estimate",            resource: "style_orders:tab:estimate",            action: "view", menu: "Orders", subgroup: "Style Order Tabs" },
  { key: "style_orders:tab:costing:view",             label: "Costing",             resource: "style_orders:tab:costing",             action: "view", menu: "Orders", subgroup: "Style Order Tabs" },
  { key: "style_orders:tab:cost_sheet:view",          label: "Cost Sheet",          resource: "style_orders:tab:cost_sheet",          action: "view", menu: "Orders", subgroup: "Style Order Tabs" },
  { key: "style_orders:tab:shipping:view",            label: "Shipping",            resource: "style_orders:tab:shipping",            action: "view", menu: "Orders", subgroup: "Style Order Tabs" },
  { key: "style_orders:tab:invoices:view",            label: "Invoices",            resource: "style_orders:tab:invoices",            action: "view", menu: "Orders", subgroup: "Style Order Tabs" },

  /* ── Swatch Order Tabs ──────────────────────────────────── */
  { key: "swatch_orders:tab:basic_info:view",          label: "Basic Info",          resource: "swatch_orders:tab:basic_info",          action: "view", menu: "Orders", subgroup: "Swatch Order Tabs" },
  { key: "swatch_orders:tab:completion_tracking:view", label: "Completion Tracking", resource: "swatch_orders:tab:completion_tracking", action: "view", menu: "Orders", subgroup: "Swatch Order Tabs" },
  { key: "swatch_orders:tab:references:view",          label: "References",          resource: "swatch_orders:tab:references",          action: "view", menu: "Orders", subgroup: "Swatch Order Tabs" },
  { key: "swatch_orders:tab:artworks:view",            label: "Artworks",            resource: "swatch_orders:tab:artworks",            action: "view", menu: "Orders", subgroup: "Swatch Order Tabs" },
  { key: "swatch_orders:tab:client_link:view",         label: "Client Link",         resource: "swatch_orders:tab:client_link",         action: "view", menu: "Orders", subgroup: "Swatch Order Tabs" },
  { key: "swatch_orders:tab:estimate:view",            label: "Estimate",            resource: "swatch_orders:tab:estimate",            action: "view", menu: "Orders", subgroup: "Swatch Order Tabs" },
  { key: "swatch_orders:tab:costing:view",             label: "Costing",             resource: "swatch_orders:tab:costing",             action: "view", menu: "Orders", subgroup: "Swatch Order Tabs" },
  { key: "swatch_orders:tab:cost_sheet:view",          label: "Cost Sheet",          resource: "swatch_orders:tab:cost_sheet",          action: "view", menu: "Orders", subgroup: "Swatch Order Tabs" },
  { key: "swatch_orders:tab:shipping:view",            label: "Shipping",            resource: "swatch_orders:tab:shipping",            action: "view", menu: "Orders", subgroup: "Swatch Order Tabs" },
  { key: "swatch_orders:tab:invoices:view",            label: "Invoices",            resource: "swatch_orders:tab:invoices",            action: "view", menu: "Orders", subgroup: "Swatch Order Tabs" },
];

const requireAdmin = requireAuth;

async function seedSystemRoles() {
  const existing = await db.select().from(rolesTable);

  if (existing.length === 0) {
    /* ── First boot: create admin + user roles ─────────── */
    const [adminRole] = await db.insert(rolesTable).values({
      name: "admin", description: "Full system access", isSystem: true,
    }).returning();
    await db.insert(rolesTable).values({
      name: "user", description: "Standard user access", isSystem: true,
    });
    const allKeys = ALL_PERMISSIONS.map(p => ({ roleId: adminRole.id, permission: p.key }));
    if (allKeys.length) await db.insert(rolePermissionsTable).values(allKeys);
    logger.info("System roles seeded");
  } else {
    /* ── Subsequent boots: ensure admin has every permission ─ */
    const adminRole = existing.find(r => r.name === "admin");
    if (adminRole) {
      const existingPerms = await db
        .select({ permission: rolePermissionsTable.permission })
        .from(rolePermissionsTable)
        .where(eq(rolePermissionsTable.roleId, adminRole.id));
      const existingKeys = new Set(existingPerms.map(p => p.permission));
      const missing = ALL_PERMISSIONS.filter(p => !existingKeys.has(p.key));
      if (missing.length > 0) {
        await db.insert(rolePermissionsTable).values(
          missing.map(p => ({ roleId: adminRole.id, permission: p.key }))
        );
        logger.info({ count: missing.length }, "Synced new permissions to admin role");
      }
    }
  }
}

seedSystemRoles().catch(err => logger.error(err, "Failed to seed system roles"));

router.get("/user-management/permissions", requireAdmin, (_req, res): void => {
  res.json({ data: ALL_PERMISSIONS });
});

router.get("/user-management/users", requireAdmin, async (_req, res): Promise<void> => {
  const users = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      email: usersTable.email,
      role: usersTable.role,
      isActive: usersTable.isActive,
      inviteToken: usersTable.inviteToken,
      inviteTokenExpiry: usersTable.inviteTokenExpiry,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(usersTable.createdAt);
  res.json({ data: users });
});

router.post("/user-management/users", requireAdmin, async (req, res): Promise<void> => {
  const { email, username, role } = req.body as { email: string; username: string; role: string };
  if (!email || !username || !role) {
    res.status(400).json({ error: "email, username and role are required" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (existing.length > 0) {
    res.status(409).json({ error: "A user with that email already exists" });
    return;
  }

  const inviteToken = crypto.randomBytes(32).toString("hex");
  const inviteTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const tempHash = hashPassword(crypto.randomBytes(16).toString("hex"));

  const [user] = await db.insert(usersTable).values({
    email: email.toLowerCase(),
    username,
    role,
    hashedPassword: tempHash,
    isActive: false,
    inviteToken,
    inviteTokenExpiry,
  }).returning({
    id: usersTable.id, username: usersTable.username, email: usersTable.email,
    role: usersTable.role, isActive: usersTable.isActive, createdAt: usersTable.createdAt,
    inviteToken: usersTable.inviteToken, inviteTokenExpiry: usersTable.inviteTokenExpiry,
  });

  logger.info({ userId: user.id }, "User invited — sending invite email");

  const inviteUrl = buildInviteUrl(inviteToken);
  try {
    await sendInviteEmail(user.email, user.username, inviteUrl);
    logger.info({ userId: user.id }, "Invite email sent");
  } catch (err) {
    logger.error({ err, userId: user.id }, "Failed to send invite email — returning token as fallback");
    res.status(201).json({ data: user, inviteToken, inviteUrl, emailSent: false });
    return;
  }

  res.status(201).json({ data: user, inviteToken, inviteUrl, emailSent: true });
});

router.put("/user-management/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { username, email, role, isActive } = req.body as { username?: string; email?: string; role?: string; isActive?: boolean };

  const [target] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, id));
  if (target?.email === SUPERUSER_EMAIL) {
    res.status(403).json({ error: "The superuser account cannot be modified" }); return;
  }

  if (email !== undefined) {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      res.status(400).json({ error: "Invalid email address" }); return;
    }
    const [conflict] = await db.select({ id: usersTable.id }).from(usersTable)
      .where(eq(usersTable.email, trimmed));
    if (conflict && conflict.id !== id) {
      res.status(409).json({ error: "That email is already in use by another account" }); return;
    }
  }

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (username !== undefined) updates.username = username;
  if (email !== undefined) updates.email = email.trim().toLowerCase();
  if (role !== undefined) updates.role = role;
  if (isActive !== undefined) updates.isActive = isActive;

  const [user] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, id))
    .returning({
      id: usersTable.id, username: usersTable.username, email: usersTable.email,
      role: usersTable.role, isActive: usersTable.isActive, createdAt: usersTable.createdAt,
    });

  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ data: user });
});

router.delete("/user-management/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const authUser = (req as typeof req & { user?: { userId: number } }).user;
  if (authUser?.userId === id) {
    res.status(400).json({ error: "Cannot delete your own account" });
    return;
  }
  const [target] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, id));
  if (target?.email === SUPERUSER_EMAIL) {
    res.status(403).json({ error: "The superuser account cannot be deleted" }); return;
  }
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.json({ message: "User deleted" });
});

router.post("/user-management/users/:id/resend-invite", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const inviteToken = crypto.randomBytes(32).toString("hex");
  const inviteTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [user] = await db
    .update(usersTable)
    .set({ inviteToken, inviteTokenExpiry, isActive: false })
    .where(eq(usersTable.id, id))
    .returning({ id: usersTable.id, email: usersTable.email, username: usersTable.username, inviteToken: usersTable.inviteToken });

  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const inviteUrl = buildInviteUrl(inviteToken);
  try {
    await sendInviteEmail(user.email, user.username, inviteUrl);
    logger.info({ userId: user.id }, "Invite email re-sent");
    res.json({ data: user, inviteToken, inviteUrl, emailSent: true });
  } catch (err) {
    logger.error({ err, userId: user.id }, "Failed to re-send invite email");
    res.json({ data: user, inviteToken, inviteUrl, emailSent: false });
  }
});

router.post("/user-management/users/:id/send-reset", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const authUser = (req as typeof req & { user?: { userId: number } }).user;
  if (authUser?.userId === id) {
    res.status(400).json({ error: "Use the Forgot Password flow to reset your own password" });
    return;
  }

  const inviteToken = crypto.randomBytes(32).toString("hex");
  const inviteTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [user] = await db
    .update(usersTable)
    .set({ inviteToken, inviteTokenExpiry, isActive: false })
    .where(eq(usersTable.id, id))
    .returning({ id: usersTable.id, email: usersTable.email, username: usersTable.username, inviteToken: usersTable.inviteToken });

  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const inviteUrl = buildInviteUrl(inviteToken);
  try {
    await sendAdminPasswordResetEmail(user.email, user.username, inviteUrl);
    logger.info({ userId: user.id }, "Admin password reset email sent");
    res.json({ data: user, inviteToken, inviteUrl, emailSent: true });
  } catch (err) {
    logger.error({ err, userId: user.id }, "Failed to send admin password reset email");
    res.json({ data: user, inviteToken, inviteUrl, emailSent: false });
  }
});

router.get("/user-management/roles", requireAdmin, async (_req, res): Promise<void> => {
  const roles = await db.select().from(rolesTable).orderBy(rolesTable.createdAt);
  const perms = await db.select().from(rolePermissionsTable);
  const data = roles.map(r => ({
    ...r,
    permissions: perms.filter(p => p.roleId === r.id).map(p => p.permission),
  }));
  res.json({ data });
});

router.post("/user-management/roles", requireAdmin, async (req, res): Promise<void> => {
  const { name, description } = req.body as { name: string; description?: string };
  if (!name?.trim()) { res.status(400).json({ error: "Role name is required" }); return; }

  const existing = await db.select().from(rolesTable).where(eq(rolesTable.name, name.trim()));
  if (existing.length > 0) { res.status(409).json({ error: "Role already exists" }); return; }

  const [role] = await db.insert(rolesTable).values({ name: name.trim(), description: description ?? null }).returning();
  res.status(201).json({ data: { ...role, permissions: [] } });
});

router.put("/user-management/roles/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { name, description } = req.body as { name?: string; description?: string };

  const [existing] = await db.select().from(rolesTable).where(eq(rolesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Role not found" }); return; }
  if (existing.isSystem && name && name !== existing.name) {
    res.status(400).json({ error: "Cannot rename a system role" }); return;
  }

  const updates: Partial<typeof rolesTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;

  const [role] = await db.update(rolesTable).set(updates).where(eq(rolesTable.id, id)).returning();
  const perms = await db.select().from(rolePermissionsTable).where(eq(rolePermissionsTable.roleId, id));
  res.json({ data: { ...role, permissions: perms.map(p => p.permission) } });
});

router.delete("/user-management/roles/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [role] = await db.select().from(rolesTable).where(eq(rolesTable.id, id));
  if (!role) { res.status(404).json({ error: "Role not found" }); return; }
  if (role.isSystem) { res.status(400).json({ error: "Cannot delete a system role" }); return; }
  await db.delete(rolesTable).where(eq(rolesTable.id, id));
  res.json({ message: "Role deleted" });
});

router.put("/user-management/roles/:id/permissions", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { permissions } = req.body as { permissions: string[] };
  if (!Array.isArray(permissions)) { res.status(400).json({ error: "permissions must be an array" }); return; }

  const validKeys = new Set(ALL_PERMISSIONS.map(p => p.key));
  const filtered = permissions.filter(p => validKeys.has(p));

  await db.delete(rolePermissionsTable).where(eq(rolePermissionsTable.roleId, id));
  if (filtered.length > 0) {
    await db.insert(rolePermissionsTable).values(filtered.map(p => ({ roleId: id, permission: p })));
  }

  const [role] = await db.select().from(rolesTable).where(eq(rolesTable.id, id));
  res.json({ data: { ...role, permissions: filtered } });
});

export default router;
