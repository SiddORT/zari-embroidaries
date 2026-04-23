import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, ShadingType, convertInchesToTwip,
  PageBreak, LevelFormat,
} from "docx";
import { writeFileSync } from "fs";

// ── Brand palette ────────────────────────────────────────────────────────────
const GOLD   = "C6AF4B";
const GOLD_L = "FDF8E7";
const GOLD_M = "F5E9A0";
const DARK   = "1C1C1C";
const GRAY   = "6B7280";
const MID    = "374151";
const WHITE  = "FFFFFF";
const GREEN  = "166534";
const GREEN_L= "DCFCE7";
const RED_L  = "FEE2E2";
const RED    = "991B1B";
const BLUE_L = "DBEAFE";
const BLUE   = "1E40AF";

// ── Typography helpers ───────────────────────────────────────────────────────
const run  = (text, opts = {}) => new TextRun({ text, font: "Calibri", size: 22, color: DARK, ...opts });
const runB = (text, size = 22, color = DARK) => run(text, { bold: true, size, color });
const runG = (text, size = 22) => run(text, { bold: true, size, color: GOLD });
const runI = (text, color = GRAY) => run(text, { italics: true, color });

const p    = (children, opts = {}) => new Paragraph({ children: Array.isArray(children) ? children : [children], ...opts });
const sp   = (n = 120) => p([], { spacing: { before: n, after: 0 } });

// ── Block builders ────────────────────────────────────────────────────────────

/** Gold-on-gold section banner */
const banner = (text) => [
  sp(240),
  new Paragraph({
    children: [run("  " + text, { bold: true, size: 30, color: WHITE })],
    shading:  { type: ShadingType.SOLID, color: GOLD, fill: GOLD },
    spacing:  { before: 0, after: 0 },
  }),
  sp(40),
];

/** Gold-underlined sub-heading */
const h2 = (text) => new Paragraph({
  children: [runG(text, 26)],
  border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: GOLD, space: 4 } },
  spacing: { before: 280, after: 100 },
});

/** Dark bold subsection heading */
const h3 = (text) => new Paragraph({
  children: [runB(text, 24, MID)],
  spacing: { before: 220, after: 80 },
});

/** Small label heading */
const h4 = (text) => new Paragraph({
  children: [runB(text, 22, GOLD)],
  spacing: { before: 160, after: 60 },
});

/** Body paragraph */
const body = (text) => p(run(text), { spacing: { before: 60, after: 60 } });

/** Bullet item */
const bull = (text, level = 0) => new Paragraph({
  children: [run(text)],
  bullet: { level },
  spacing: { before: 50, after: 50 },
});

/** Workflow step */
const step = (n, text) => new Paragraph({
  children: [
    run(`  ${n}. `, { bold: true, color: GOLD }),
    run(text),
  ],
  spacing: { before: 60, after: 60 },
  indent: { left: convertInchesToTwip(0.2) },
});

/** Inline badge span */
const badge = (label, bg = GOLD, fg = WHITE) =>
  new TextRun({ text: ` ${label} `, font: "Calibri", bold: true, size: 18, color: fg,
    shading: { type: ShadingType.SOLID, color: bg, fill: bg } });

// ── Table helpers ─────────────────────────────────────────────────────────────

const hdrRow = (...labels) => new TableRow({
  tableHeader: true,
  children: labels.map(label => new TableCell({
    children: [p(runB(label, 20, WHITE), { spacing: { before: 80, after: 80 } })],
    shading:  { type: ShadingType.SOLID, color: GOLD, fill: GOLD },
    margins:  { top: 80, bottom: 80, left: 120, right: 120 },
  })),
});

const cell = (text, opts = {}) => new TableCell({
  children: [p(run(text), { spacing: { before: 70, after: 70 } })],
  margins:  { top: 80, bottom: 80, left: 120, right: 120 },
  ...opts,
});

const boldCell = (text, color = GOLD, bg = GOLD_L) => new TableCell({
  children: [p(runB(text, 20, color), { spacing: { before: 70, after: 70 } })],
  shading:  { type: ShadingType.SOLID, color: bg, fill: bg },
  margins:  { top: 80, bottom: 80, left: 120, right: 120 },
});

const tRow = (...cells) => new TableRow({ children: cells });

const infoTable = (rows) => new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: rows.map(([label, value], i) => new TableRow({
    children: [
      new TableCell({
        children: [p(runB(label, 21), { spacing: { before: 80, after: 80 } })],
        width:   { size: 32, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.SOLID, color: i % 2 === 0 ? GOLD_L : "F9FAFB", fill: i % 2 === 0 ? GOLD_L : "F9FAFB" },
        margins: { top: 80, bottom: 80, left: 140, right: 120 },
      }),
      new TableCell({
        children: [p(run(value), { spacing: { before: 80, after: 80 } })],
        width:   { size: 68, type: WidthType.PERCENTAGE },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
      }),
    ],
  })),
});

const statusFlow = (statuses) => new Paragraph({
  children: statuses.flatMap((s, i) => [
    new TextRun({ text: ` ${s} `, font: "Calibri", bold: true, size: 18, color: WHITE,
      shading: { type: ShadingType.SOLID, color: GOLD, fill: GOLD } }),
    ...(i < statuses.length - 1 ? [run("  →  ", { color: GRAY, size: 20 })] : []),
  ]),
  spacing: { before: 80, after: 80 },
  indent: { left: convertInchesToTwip(0.2) },
});

// page break
const pb = () => p([new PageBreak()]);

// ────────────────────────────────────────────────────────────────────────────
// COVER PAGE
// ────────────────────────────────────────────────────────────────────────────
const cover = [
  sp(1000),
  p(runG("ZARI ERP", 96), { alignment: AlignmentType.CENTER }),
  p(run("Enterprise Resource Planning System", { size: 36, color: GRAY }), { alignment: AlignmentType.CENTER }),
  sp(40),
  p(run("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", { color: GOLD, size: 26 }), { alignment: AlignmentType.CENTER }),
  sp(100),
  p(runB("DETAILED PROJECT SCOPE DOCUMENT", 44, DARK), { alignment: AlignmentType.CENTER }),
  sp(60),
  p(runI("Zari Embroideries  ·  All Modules, Submodules, Workflows & Features"), { alignment: AlignmentType.CENTER }),
  sp(500),
  p(run("Version 2.0  ·  April 2026  ·  Confidential", { size: 20, color: GRAY }), { alignment: AlignmentType.CENTER }),
  pb(),
];

// ────────────────────────────────────────────────────────────────────────────
// SECTION 1 — Project Overview
// ────────────────────────────────────────────────────────────────────────────
const sec1 = [
  ...banner("1.  Project Overview"),

  h2("1.1  Background & Context"),
  body("Zari Embroideries is a premium embroidery manufacturer and exporter supplying high-fashion brands across India and internationally. Prior to ZARI ERP, the business tracked its complex operational pipeline — swatch sampling, style production, inventory procurement, client invoicing, and logistics — across a fragmented mix of spreadsheets, WhatsApp messages, paper records, and ad-hoc tools."),
  body("ZARI ERP was purpose-built to unify every business function into a single, always-on web application, giving management, operations, and accounts teams a real-time, shared view of the entire business from one screen."),

  h2("1.2  Project Identity"),
  infoTable([
    ["Project Name",       "ZARI ERP — Enterprise Resource Planning System"],
    ["Client",             "Zari Embroideries"],
    ["Project Type",       "Custom Full-Stack Web Application (SaaS)"],
    ["Version",            "1.0 — Production Release (April 2026)"],
    ["Document Version",   "2.0 — Detailed Scope (April 2026)"],
    ["Document Status",    "Final — For Client & Internal Team Reference"],
    ["Audience",           "Management, Operations Team, Accounts Team, Development Team"],
    ["Deployment",         "Replit Cloud — Always-on managed hosting"],
    ["Production URL",     "Accessible at the .replit.app domain"],
  ]),

  h2("1.3  Core Objectives"),
  bull("Centralise all order management — swatch sampling, style production, and quotations — in one platform."),
  bull("Provide real-time inventory visibility: fabrics, materials, packaging, reservations, and valuations."),
  bull("Automate financial workflows: GST invoicing, payment recording, vendor bill tracking, and ledger reconciliation."),
  bull("Streamline logistics with digital packing lists, package-level item assignment, and centralised shipment tracking."),
  bull("Deliver actionable dashboards and exportable reports for immediate management decision-making."),
  bull("Enforce structured workflows with status gates, role-based access, and audit-ready activity logs."),
  bull("Eliminate manual data entry errors, reduce order-processing time, and provide a single source of truth."),

  pb(),
];

// ────────────────────────────────────────────────────────────────────────────
// SECTION 2 — System Architecture
// ────────────────────────────────────────────────────────────────────────────
const sec2 = [
  ...banner("2.  System Architecture & Technology Stack"),

  h2("2.1  Technology Stack"),
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      hdrRow("Layer", "Technology / Library", "Role in System"),
      tRow(boldCell("Frontend Framework"), cell("React 18 + Vite"), cell("SPA UI framework with fast HMR build tooling")),
      tRow(boldCell("Language", MID, "F9FAFB"), cell("TypeScript (strict)"), cell("Type-safe frontend and backend code")),
      tRow(boldCell("Styling"), cell("Tailwind CSS"), cell("Utility-first CSS; brand theme colour #C6AF4B")),
      tRow(boldCell("Client Routing", MID, "F9FAFB"), cell("Wouter"), cell("Lightweight client-side page routing")),
      tRow(boldCell("Data Fetching"), cell("React Query (TanStack)"), cell("Server state, caching, and background refetch")),
      tRow(boldCell("Charts", MID, "F9FAFB"), cell("Recharts"), cell("Bar, donut/pie, stacked charts on dashboards")),
      tRow(boldCell("Backend"), cell("Node.js + Express"), cell("REST API server — all business logic")),
      tRow(boldCell("Database", MID, "F9FAFB"), cell("PostgreSQL + Raw SQL"), cell("Relational store with optimised hand-written queries")),
      tRow(boldCell("Authentication"), cell("JWT + bcrypt"), cell("Stateless token auth; secure password hashing")),
      tRow(boldCell("File Storage", MID, "F9FAFB"), cell("Database BLOB (Base64)"), cell("Artwork images stored directly in PostgreSQL")),
      tRow(boldCell("Monorepo"), cell("pnpm Workspaces"), cell("Frontend + API as separate packages in one repo")),
      tRow(boldCell("Hosting", MID, "F9FAFB"), cell("Replit Cloud"), cell("Managed always-on environment with PostgreSQL")),
    ],
  }),

  h2("2.2  Architecture Overview"),
  bull("The system is a monorepo with two primary packages: the React/Vite frontend (zari-erp) and the Express API server (api-server)."),
  bull("All browser requests to the frontend (SPA) are served by Vite's production build; API calls are routed to the Express server via a path-based proxy."),
  bull("The Express API exposes ~30+ route files, each responsible for a specific domain (clients, orders, invoices, inventory, etc.). All routes are prefixed /api."),
  bull("PostgreSQL schema is auto-migrated on every server start using raw SQL CREATE TABLE IF NOT EXISTS statements — no migration tool required."),
  bull("JWT tokens are issued at login and stored client-side. Every API request carries a Bearer token in the Authorization header."),
  bull("File uploads (artwork images, vendor invoice scans) are stored as Base64 in the database; served back as data URIs."),

  h2("2.3  User Roles & Access Control"),
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      hdrRow("Role", "Access Level", "Capabilities"),
      tRow(boldCell("Admin"), cell("Full system access"), cell("User management, all settings, all modules, approvals, financial records, and audit logs.")),
      tRow(boldCell("Operations Staff", MID, "F9FAFB"), cell("Orders, inventory, logistics"), cell("Create and manage swatch/style orders, inventory receipts, packing lists, and shipments.")),
      tRow(boldCell("Accounts Staff"), cell("Finance module"), cell("Invoices, payments, vendor bills, ledger, credit notes, and accounts dashboard.")),
    ],
  }),
  sp(80),
  bull("User invitation flow: Admin sends email invite → user sets password via token link → role assigned → access granted."),
  bull("Deactivation: Admin can toggle any user inactive — they lose all API access immediately."),
  bull("Activity Log: All significant actions are recorded with timestamp and user identity, accessible in Settings → Activity Logs."),

  pb(),
];

// ────────────────────────────────────────────────────────────────────────────
// SECTION 3 — Dashboard
// ────────────────────────────────────────────────────────────────────────────
const sec3 = [
  ...banner("3.  Dashboard Module"),

  h2("3.1  Overview"),
  body("The Dashboard is the default landing page after login. It provides a real-time snapshot of the entire business — orders, artworks, clients, revenue trends, and pipeline statuses — without navigating into any individual module."),

  h2("3.2  KPI Cards (Top Row)"),
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      hdrRow("Card", "Metric Shown", "Additional Data"),
      tRow(boldCell("Style Orders"),    cell("Total active style production orders"),             cell("Count issued this month; % change vs. last month")),
      tRow(boldCell("Swatch Orders", MID, "F9FAFB"), cell("Total active swatch sampling orders"), cell("Count issued this month; % change vs. last month")),
      tRow(boldCell("Artworks"),        cell("Total artwork files across all orders"),            cell("Count added this month; note if no prior data")),
      tRow(boldCell("Active Clients", MID, "F9FAFB"), cell("Total clients with active orders"),  cell("Count active this month; % change vs. last month")),
    ],
  }),
  sp(80),
  bull("Month-on-month comparison shows as green upward arrow (growth) or red downward arrow (decline)."),
  bull("Top-right header shows: Last Login timestamp, Active Orders count, and logged-in user name/avatar."),
  bull("Refresh button re-fetches all KPI and chart data live."),

  h2("3.3  Charts & Visualisations"),
  h4("Order Trend — Monthly Orders (Last 6 Months)"),
  bull("Bar chart with two series: Style Orders (dark) and Swatch Orders (gold)."),
  bull("X-axis: last 6 calendar months. Y-axis: order count."),
  bull("Toggle buttons to switch between 3-month and 6-month views."),

  h4("Status Tracker — Current Pipeline"),
  bull("Two donut charts side by side: Style Pipeline and Swatch Pipeline."),
  bull("Each donut shows total orders in the centre and a legend below with per-status counts."),
  bull("Style statuses: Completed, Draft, In Production, Issued, In Review, Pending Approval, Rejected, Cancelled."),
  bull("Swatch statuses: Completed, Draft, In Sampling, Issued, In Artwork, Pending Approval, Rejected, Cancelled."),

  h2("3.4  Actions from Dashboard"),
  bull("Click any KPI card to navigate directly to the relevant module list."),
  bull("Refresh button in header updates all data without full page reload."),
  bull("Profile avatar dropdown: Settings, User Manual, Logout."),

  pb(),
];

// ────────────────────────────────────────────────────────────────────────────
// SECTION 4 — Masters Module
// ────────────────────────────────────────────────────────────────────────────
const sec4 = [
  ...banner("4.  Masters Module"),
  body("Masters are the foundational reference data that all other modules depend on. They must be configured before creating orders, invoices, or procurement documents."),

  // ── 4.1 Clients ──
  h2("4.1  Client Master"),
  body("Manages all buyer/client records. Clients are referenced in style orders, swatch orders, invoices, packing lists, and quotations."),
  h4("Form Fields"),
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      hdrRow("Field", "Type", "Notes"),
      tRow(boldCell("Brand / Client Name"),   cell("Text (required)"),     cell("Primary identifier shown across all modules")),
      tRow(boldCell("Client Code", MID,"F9FAFB"), cell("Auto-generated"),  cell("Format: CLI-XXX — system assigned, unique")),
      tRow(boldCell("Contact Person"),         cell("Text"),               cell("Primary contact name")),
      tRow(boldCell("Email"),                  cell("Email"),              cell("Used for invoices and communications")),
      tRow(boldCell("Contact No."),            cell("Phone + country"),    cell("International phone picker")),
      tRow(boldCell("Country"),                cell("Dropdown"),           cell("Used to determine IGST vs CGST+SGST")),
      tRow(boldCell("Invoice Currency", MID,"F9FAFB"), cell("Dropdown"),  cell("INR, USD, EUR, GBP, AED, etc.")),
      tRow(boldCell("GST / GSTIN"),            cell("Text"),               cell("Required for Indian GST invoicing")),
      tRow(boldCell("Billing Address"),        cell("Multi-line text"),    cell("Used on invoice and packing list headers")),
      tRow(boldCell("Delivery Addresses"),     cell("Up to 5 addresses"),  cell("Each with label, city, state, pin, country")),
      tRow(boldCell("Status", MID, "F9FAFB"),  cell("Toggle"),            cell("Active / Inactive — inactive hides from order forms")),
    ],
  }),
  h4("List View Features"),
  bull("Search: by brand name, client code, or contact name."),
  bull("Filter: All Status / Active / Inactive."),
  bull("Export to Excel: downloads full client list as .xlsx."),
  bull("Click any row to open full client profile and edit."),

  // ── 4.2 Vendors ──
  h2("4.2  Vendor Master"),
  body("Manages all supplier records. Vendors are used in purchase orders, goods receipts, vendor bills, shipping, and ledgers."),
  h4("Form Fields"),
  bull("Brand / Vendor Name (required), Vendor Code (auto: VND-XXX)."),
  bull("Contact Person, Email, Contact No. (international phone picker)."),
  bull("Country, GST / GSTIN, PAN Number."),
  bull("Billing Address + up to 5 delivery addresses (each with label and full address)."),
  bull("Bank Account Details: Bank Name, Account Number, IFSC Code, Branch, Account Type — up to 3 accounts."),
  bull("Attachments: upload vendor documents (agreements, certificates) — stored as file records."),
  bull("Status: Active / Inactive toggle."),
  h4("List View Features"),
  bull("Search: by vendor name, code, or contact."),
  bull("Filter: All Status / Active / Inactive."),
  bull("Export to Excel: full vendor list as .xlsx."),

  // ── 4.3 Materials & Fabrics ──
  h2("4.3  Materials Master"),
  body("Stores raw materials (threads, beads, trims, zari wire, packaging) used in costing sheets and inventory tracking."),
  h4("Form Fields"),
  bull("Item Name, Item Code (auto-generated)."),
  bull("Item Type (Addable Select — user can add custom types on the fly): e.g. Thread, Bead, Trim, Packaging."),
  bull("Quality / Grade, Colour (colour picker), Size / Specification."),
  bull("Unit of Measure: metres, grams, pieces, kg, yards, etc."),
  bull("Unit Price (purchase price), HSN Code (links to HSN master)."),
  bull("Default Vendor (links to Vendor master)."),
  bull("Minimum Reorder Quantity (triggers Low Stock alert)."),
  bull("Images: up to 5 product images with upload and drag-to-reorder."),
  bull("Status: Active / Inactive."),

  h2("4.4  Fabric Master"),
  body("Maintains fabric types used in style and swatch orders."),
  bull("Fabric Name, Fabric Code (auto), Content (e.g. 100% Cotton, Silk-Viscose blend)."),
  bull("GSM (grams per square metre), Width (cm), Colour."),
  bull("Unit Price, HSN Code, Default Vendor."),
  bull("Images: up to 5 fabric swatch images."),
  bull("Status: Active / Inactive."),

  h2("4.5  Style Master"),
  body("A catalogue of pre-defined embroidery styles — referenced when creating Style Orders."),
  bull("Style Number (unique), Style Name, Description."),
  bull("Client (Searchable Select — pre-assigns the style to a client)."),
  bull("Place of Issue: In-house / Out-house."),
  bull("Target Shipping Date, Attach Link (external reference URL)."),
  bull("Status filter and search on list view."),

  h2("4.6  Categories & Sub-Categories"),
  bull("Configurable product categories (e.g. Fabric, Material, Packaging) and sub-categories."),
  bull("Used across inventory, purchase orders, and reports for classification and filtering."),
  bull("Add / Edit / Deactivate categories without affecting existing records."),

  h2("4.7  HSN Codes"),
  body("HSN (Harmonised System of Nomenclature) codes are required for GST-compliant invoicing."),
  bull("HSN Code (numeric), Government Description, Internal Remarks."),
  bull("GST Rate (%): CGST + SGST or IGST — used automatically when the code is assigned to a line item."),
  bull("Status: Active / Inactive. Search and filter on list view. Export to Excel."),

  pb(),
];

// ────────────────────────────────────────────────────────────────────────────
// SECTION 5 — Swatch Orders
// ────────────────────────────────────────────────────────────────────────────
const sec5 = [
  ...banner("5.  Swatch Orders Module"),
  body("Swatch Orders manage the embroidery sampling lifecycle — small production runs made before full-scale manufacture — which clients use to approve designs, colours, and materials."),

  h2("5.1  Status Workflow"),
  statusFlow(["Draft", "Issued", "In Sampling", "In Artwork", "Pending Approval", "Completed", "Rejected", "Cancelled"]),
  bull("Draft: Order created, not yet actioned."),
  bull("Issued: Order formally issued to the production/sampling team."),
  bull("In Sampling: Physical sampling in progress."),
  bull("In Artwork: Artwork creation/revision underway."),
  bull("Pending Approval: Sent to client for sign-off."),
  bull("Completed: Client has approved; order closed."),
  bull("Rejected: Client rejected the sample; order closed."),
  bull("Cancelled: Order voided before completion."),

  h2("5.2  List View"),
  bull("Default view: Card grid (4-up) showing order code, client name, due date, quantity, fabric, priority badge, chargeable flag, and status badge."),
  bull("Toggle: Switch between grid view and table/list view."),
  bull("Status tabs: All, Draft, Issued, In Sampling, In Artwork, Pending Approval, Completed, Rejected, Cancelled."),
  bull("Search: by swatch name, order code, or client name."),
  bull("Filter: Priority (Low, Medium, High, Urgent) and Chargeable (Yes / No)."),
  bull("New Swatch Order button: opens creation form."),

  h2("5.3  Order Detail — Tabs"),

  h3("Tab 1: Basic Info"),
  bull("Swatch Name (required), Swatch Code (auto: ZSW-XXXX)."),
  bull("Client (Addable Searchable Select), Order Date, Delivery Date."),
  bull("Quantity, Fabric Type (links to Fabric master), Sample Size."),
  bull("Priority: Low / Medium / High / Urgent."),
  bull("Chargeable Order: Yes / No toggle."),
  bull("Season, Colorway."),
  bull("Issued To (team member), Department (Addable Select)."),
  bull("Actual Start Date/Time, Actual Completion Date/Time."),
  bull("Delay Reason (text), Approval Date."),
  bull("Description / Instructions, Internal Notes, Client Instructions."),

  h3("Tab 2: References"),
  bull("Style References: link to existing Style Orders (with a Remark field per reference)."),
  bull("Swatch References: link to existing Swatch Orders (with a Remark field)."),
  bull("Ref Docs: drag-and-drop file upload for reference documents (PDF, Word, etc.)."),
  bull("Ref Images: drag-and-drop image upload for reference visuals (JPEG, PNG)."),

  h3("Tab 3: Artworks"),
  body("Artwork records document the visual design work produced for this swatch."),
  bull("Add Artwork: opens artwork form — Artwork Name, Code (auto), Created Date, Total Cost."),
  bull("WIP Images: upload work-in-progress artwork images with drag-and-drop; lightbox gallery viewer."),
  bull("Final Images: upload finalised artwork images; lightbox viewer."),
  bull("Artwork Status: Pending → In Review → Approved / Revision Required / Rejected."),
  bull("Edit: modify name, cost, or images. Delete: available if artwork not yet Approved."),

  h3("Tab 4: Client Link"),
  bull("Share a read-only view of the order with the client via a unique token-secured URL."),
  bull("Client can view order status, artworks, and leave feedback without logging in."),

  h3("Tab 5: Estimate"),
  bull("Initial cost estimation fields: Sampling cost, Material cost, Artisan cost, Outsource cost."),
  bull("Used before the full costing sheet is built — gives a quick ballpark figure."),

  h3("Tab 6: Costing"),
  body("The Costing tab is the full Bill of Materials (BOM) and procurement control center."),
  h4("BOM Line Items"),
  bull("Material / Fabric selection (linked to masters)."),
  bull("Current Stock available for this item."),
  bull("Average Weighted Price (auto-calculated from receipts)."),
  bull("PO Rate: price from the linked Purchase Order."),
  bull("Required Qty and Reserved Qty."),
  bull("PO Total, PR Qty, PR Total (from goods receipts), Consumed Qty, Consumed Total."),
  h4("Linked Purchase Orders (PO)"),
  bull("See all POs linked to this order: PO number, vendor, status, line items, ordered qty, price."),
  bull("PO statuses: Draft, Pending Approval, Approved, In Process (Partially Received), Closed."),
  bull("Create a new PO directly from the Costing tab."),
  h4("Linked Purchase Receipts (PR)"),
  bull("See all goods receipts for this order's materials: PR number, received qty, invoice details."),
  h4("Additional Costs"),
  bull("Artisan Time Sheets: Artisan name, Shift Type (Regular, Night, Sunday, Overtime), Hours, Rate, Total."),
  bull("Outsource Jobs: Vendor, Description, HSN Code, GST %, Amount."),
  bull("Custom Charges: Charge Name, Amount, Notes."),

  h3("Tab 7: Cost Sheet"),
  bull("Consolidated printable report combining all BOM materials, artisan labour, outsource jobs, and custom charges."),
  bull("Totals by category: Material Cost, Labour Cost, Outsource Cost, Custom Charges, Grand Total."),
  bull("GST logic toggle: show/hide GST breakdown per line."),
  bull("Print / Download PDF button for physical records."),

  h3("Tab 8: Shipping"),
  bull("Shipping Vendor (links to shipping vendor list)."),
  bull("Tracking Number, Tracking URL (clickable link on detail view)."),
  bull("Shipment Weight (kg), Rate per KG, Calculated Cost (auto), Manual Override (₹), Final Cost."),
  bull("Shipment Status: Pending, Dispatched, In Transit, Delivered, Returned, Cancelled."),
  bull("Dates: Shipment Date, Expected Delivery Date, Actual Delivery Date."),
  bull("Inline creation: Create New Shipment record without leaving the order form."),

  h3("Tab 9: Invoices"),
  bull("Create client invoice directly from the swatch order."),
  bull("Line Items: Description, Category (Material / Labour / Outsource / Custom / Other), Qty, Unit Price, Total."),
  bull("Re-import from Cost Sheet: auto-populates line items from the completed costing."),
  bull("Discount: Flat amount or Percentage."),
  bull("CGST Rate (%), SGST Rate (%), IGST Rate (%) — auto-determined by client location."),
  bull("Grand Total: calculated automatically."),
  bull("Client GSTIN, Billing Address, State."),
  bull("Bank Details: Bank Name, Account Number, IFSC Code, Branch, UPI ID."),
  bull("Payment Terms: text field for custom terms."),
  bull("Invoice Status: Draft, Sent, Paid, Cancelled."),

  pb(),
];

// ────────────────────────────────────────────────────────────────────────────
// SECTION 6 — Style Orders
// ────────────────────────────────────────────────────────────────────────────
const sec6 = [
  ...banner("6.  Style Orders Module"),
  body("Style Orders are the primary production orders in ZARI ERP. They cover the full lifecycle of a custom embroidery production run — from initial briefing through artworks, costing, invoicing, and final shipment."),

  h2("6.1  Status Workflow"),
  statusFlow(["Draft", "Issued", "In Production", "In Review", "Pending Approval", "Completed", "Rejected", "Cancelled"]),
  bull("Draft: Order created but not yet formally issued."),
  bull("Issued: Order formally released to the production team."),
  bull("In Production: Active embroidery/production underway."),
  bull("In Review: Internal QC review before client submission."),
  bull("Pending Approval: Sent to client for formal approval."),
  bull("Completed: Client approved; order closed and archived."),
  bull("Rejected: Client rejected the output; order closed."),
  bull("Cancelled: Order voided — stock reservations released."),

  h2("6.2  List View"),
  bull("Card grid (4-up) and table/list toggle — same pattern as Swatch Orders."),
  bull("Auto-generated order code: ZST-XXXX (sequential, year-prefixed)."),
  bull("Status tabs, Priority filter, Chargeable filter, and full-text search."),

  h2("6.3  Order Detail — Tabs (10 Tabs)"),

  h3("Tab 1: Basic Info"),
  bull("Style Name (required), Style Code (ZST-XXXX), Client (Addable Searchable Select)."),
  bull("Quantity, Chargeable Order toggle."),
  bull("Season, Colorway, Sample Size, Fabric Type, Target Production Hours."),
  bull("Issued To (team member), Department (Addable Select)."),
  bull("Order Date, Tentative Delivery Date."),
  bull("Actual Start Date/Time, Actual Completion Date/Time, Approval Date, Delay Reason."),
  bull("Description, Internal Notes, Client Instructions."),

  h3("Tab 2: References"),
  bull("Style References and Swatch References — link previously completed orders for design continuity."),
  bull("Ref Docs and Ref Images — file uploads for briefs, design specs, and visual references."),

  h3("Tab 3: Products"),
  bull("This tab is unique to Style Orders (not in Swatch Orders)."),
  bull("Define specific garment/product variants within the order: Product Name, SKU, Size, Colour, Quantity."),
  bull("Each product can have its own artwork records (artworks are grouped per product in Tab 4)."),
  bull("Products are used in packing lists to assign specific garments to specific packages."),

  h3("Tab 4: Artworks"),
  bull("Artworks are grouped by Product (defined in Tab 3)."),
  bull("Same fields and workflow as Swatch Order artworks: Name, Code, Status, WIP Images, Final Images, Lightbox."),
  bull("Multiple artworks per product (e.g., front embroidery, back embroidery, sleeve detail)."),

  h3("Tab 5: Client Link"),
  bull("Token-secured client-facing read-only URL — client can view order status, products, and artworks."),
  bull("Client can submit feedback/comments without an ERP login."),

  h3("Tab 6: Estimate"),
  bull("Quick cost estimation: Sampling, Material, Artisan, Outsource — used before full BOM is built."),

  h3("Tab 7: Costing"),
  body("Identical structure to Swatch Order Costing (BOM, linked POs, PRs, Artisan Timesheets, Outsource, Custom Charges) but scoped to this Style Order."),

  h3("Tab 8: Cost Sheet"),
  bull("Consolidated printable cost breakdown — same structure as Swatch Cost Sheet."),

  h3("Tab 9: Shipping"),
  bull("Same fields and workflow as Swatch Order Shipping tab. Inline shipment creation supported."),

  h3("Tab 10: Invoices"),
  bull("Same invoice creation workflow as Swatch Orders — Re-import from Cost Sheet, GST logic, payment terms."),
  bull("Invoices created here also appear in the central Accounts → Invoices list."),

  pb(),
];

// ────────────────────────────────────────────────────────────────────────────
// SECTION 7 — Quotations
// ────────────────────────────────────────────────────────────────────────────
const sec7 = [
  ...banner("7.  Quotations Module"),
  body("The Quotations module allows the team to prepare formal cost estimates for clients before a Style or Swatch Order is confirmed. Quotations can be converted directly into orders."),

  h2("7.1  Workflow"),
  step(1, "Create quotation — select client (auto-fills contact, address, currency, state)."),
  step(2, "Add Designs — one or more design line items with HSN codes and reference images."),
  step(3, "Add Custom Charges — labour, material, logistics, or other charges with unit and quantity."),
  step(4, "Configure taxes — GST type (CGST+SGST or IGST), GST rate (%), and shipping rate per kg."),
  step(5, "Save quotation to database."),
  step(6, "Generate PDF — choose from multiple cover page templates (Classic, Modern, etc.)."),
  step(7, "Share PDF with client externally via email."),
  step(8, "On approval — convert quotation to a Swatch Order or Style Order (one-click conversion)."),

  h2("7.2  Form Fields"),
  h4("Client Information (auto-filled on client selection)"),
  bull("Client name, Contact person, Email, Phone, Billing address, State, Currency."),
  h4("Order Details"),
  bull("Requirement Summary / Description."),
  bull("Estimated Weight (kg) — used for shipping cost calculation."),
  bull("Internal Notes, Client Notes."),
  h4("Designs (repeatable line items)"),
  bull("Design Name, HSN Code, Remarks."),
  bull("Reference Image: Base64 image upload — appears in the PDF."),
  h4("Custom Charges (repeatable)"),
  bull("Charge Name, HSN Code, Unit (mtr / pc / kg / set / etc.), Quantity, Unit Price."),
  h4("Tax Configuration"),
  bull("GST Tax Type: CGST + SGST or IGST (based on client state)."),
  bull("GST Rate (%): applied to all taxable line items."),
  bull("Shipping Rate per KG: multiplied by estimated weight."),

  h2("7.3  PDF Generation"),
  bull("Multiple cover page templates selectable at PDF generation time."),
  bull("PDF includes: Zari Embroideries letterhead, client details, design list with images, charge breakdown, tax summary, and total."),
  bull("Generated client-side using the quotation PDF builder — no server-side PDF dependency."),

  h2("7.4  List View"),
  bull("Search by Quotation ID or Client Name."),
  bull("Filter by Date Range."),
  bull("Each row shows: Quotation ID, Client, Created Date, Total Amount, Status."),

  pb(),
];

// ────────────────────────────────────────────────────────────────────────────
// SECTION 8 — Inventory & Stock
// ────────────────────────────────────────────────────────────────────────────
const sec8 = [
  ...banner("8.  Inventory & Stock Module"),
  body("The Inventory module provides real-time visibility of all raw materials, fabrics, and packaging in stock — including reservations made by active orders and procurement pipeline tracking."),

  h2("8.1  Inventory Dashboard"),
  h4("Filters"),
  bull("Category (All Categories / Fabric / Material / Packaging / custom)."),
  bull("Sub-Category."),
  bull("Date Range (From / To) — filters movement data for charts."),

  h4("Stock Status Cards"),
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      hdrRow("Card", "What It Shows"),
      tRow(boldCell("Total Items"),    cell("Total distinct inventory items in the system")),
      tRow(boldCell("In Stock", MID, "F9FAFB"), cell("Items with current quantity above minimum reorder level")),
      tRow(boldCell("Low Stock"),      cell("Items at or below minimum reorder quantity (alert state)")),
      tRow(boldCell("Out of Stock", MID, "F9FAFB"), cell("Items with zero available quantity")),
      tRow(boldCell("Total Stock Value"), cell("Sum of (current qty × weighted average price) across all items")),
    ],
  }),

  h4("Procurement Snapshot"),
  bull("Active Purchase Orders: count of POs in Draft or Approved status."),
  bull("Line Items in POs: total line items across active POs."),
  bull("Pending Quantity: total units on order not yet received."),
  bull("Receipts: count of Goods Receipt Notes recorded."),

  h4("Charts"),
  bull("Stock Status Split (donut): In Stock vs. Low Stock vs. Out of Stock — item count by status."),
  bull("Category Split (donut): Fabric vs. Material vs. Packaging — item count by category."),
  bull("Reservations panel: Swatch Reserved and Style Reserved quantities with percentage of total stock."),

  h2("8.2  Item Stock List"),
  bull("Full paginated list of all inventory items with: Item Code, Name, Category, Sub-Category, Unit, Current Qty, Reserved Qty, Available Qty, Avg Price, Stock Value."),
  bull("Search: by item name or code."),
  bull("Filter: by Category, Sub-Category, Stock Status (All / In Stock / Low / Out)."),
  bull("Click any item to view full stock detail: transaction ledger, reservations by order, and reorder history."),

  h2("8.3  Stock Ledger (per item)"),
  bull("Transactional history: every IN (receipt) and OUT (consumption/reservation) event with date, reference order/PO, quantity, and balance after."),
  bull("Filter by date range."),

  h2("8.4  Low Stock Alerts"),
  bull("Dedicated view listing all items at or below minimum reorder quantity."),
  bull("Shows: Item, Current Qty, Min Reorder Qty, Shortfall, Suggested PO Qty."),
  bull("Direct link from each row to create a Purchase Order for that item."),

  h2("8.5  Stock Adjustments"),
  bull("Manual correction of stock levels with justification."),
  bull("Adjustment Type: Damage / Lost / Surplus / Bonus / Correction."),
  bull("Fields: Item, Adjustment Qty (positive = add, negative = deduct), Reason, Date, Reference."),
  bull("All adjustments are logged in the Stock Ledger for full audit trail."),

  pb(),
];

// ────────────────────────────────────────────────────────────────────────────
// SECTION 9 — Procurement
// ────────────────────────────────────────────────────────────────────────────
const sec9 = [
  ...banner("9.  Procurement Module"),
  body("The Procurement module manages the sourcing of inventory — from raising Purchase Orders with vendors to recording Goods Receipts that update stock levels."),

  h2("9.1  Purchase Orders (PO)"),
  h4("Status Workflow"),
  statusFlow(["Draft", "Approved", "Partially Received", "Closed", "Cancelled"]),
  bull("Draft: PO created, not yet sent to vendor."),
  bull("Approved: PO verified by Admin/Manager — can now receive goods against it."),
  bull("Partially Received: at least one goods receipt recorded; some items still pending."),
  bull("Closed: all items received or PO manually closed."),
  bull("Cancelled: PO voided — no goods to be received."),

  h4("PO Form Fields"),
  bull("PO Number (auto-generated): PO-YYYY-XXXX."),
  bull("Vendor (Searchable Select — links to Vendor master)."),
  bull("PO Date, Expected Delivery Date."),
  bull("Reference Type: Inventory (standalone), Swatch Order, or Style Order (links PO to a production order for costing)."),
  bull("Reference ID: the specific order linked (if not standalone)."),
  bull("Include GST: toggle to include or exclude GST from pricing."),
  bull("Internal Notes."),
  h4("PO Line Items (repeatable)"),
  bull("Item Category, Inventory Item (Searchable Select from materials/fabrics)."),
  bull("Item Name, Item Code (auto-filled from master), Unit of Measure."),
  bull("Ordered Quantity, Target Price per Unit, Total Price (auto-calculated)."),
  bull("HSN Code, GST Rate (%) — auto-filled from item master."),
  bull("Item Image (pulled from master or manually uploaded), Remarks."),

  h4("PO Actions"),
  bull("Save as Draft: stores PO without committing to vendor."),
  bull("Approve: transitions status and makes PO ready for receiving."),
  bull("Download PDF: formatted PO document for vendor communication."),
  bull("Create Receipt: shortcut to open a new Purchase Receipt pre-filled with this PO."),
  bull("Cancel: voids the PO."),

  h4("PO List View"),
  bull("Search: by PO Number or Vendor name."),
  bull("Filter: by Status, Date Range (From/To)."),
  bull("Columns: PO No., Vendor, Date, Reference, Line Items count, Total Value, Status."),

  h2("9.2  Purchase Receipts / Goods Receipt Notes (GRN)"),
  h4("Status Workflow"),
  statusFlow(["Draft (Open)", "Received (Confirmed)", "Cancelled"]),
  bull("Draft: Receipt saved but inventory not yet updated."),
  bull("Received: Confirmed — inventory stock levels are updated and ledger entries created."),
  bull("Cancelled: Receipt voided — inventory remains unchanged."),

  h4("GRN Form Fields"),
  bull("PR Number (auto-generated), Linked PO Number (Searchable Select)."),
  bull("Vendor Name (auto-filled from PO), Received Date."),
  bull("Vendor Invoice Number, Invoice Date, Invoice Amount (for accounts payable matching)."),
  bull("Vendor Invoice File: upload scanned supplier invoice (PDF/image)."),
  h4("GRN Line Items"),
  bull("Linked PO Line Item (Searchable Select — shows only items from the selected PO)."),
  bull("Item Name, Item Code (auto-filled)."),
  bull("Quantity Ordered (from PO), Quantity Received (editable — supports partial receipts)."),
  bull("Unit Price, Warehouse / Storage Location, Remarks."),
  bull("Total Received Value (auto-calculated)."),

  h4("GRN Actions"),
  bull("Save as Draft: save without updating stock."),
  bull("Confirm & Update Inventory: finalises receipt, adds received qty to stock, creates vendor payable entry."),
  bull("Edit: modify quantities while status is still Draft."),
  bull("Cancel: invalidate the receipt."),

  pb(),
];

// ────────────────────────────────────────────────────────────────────────────
// SECTION 10 — Accounts & Finance
// ────────────────────────────────────────────────────────────────────────────
const sec10 = [
  ...banner("10.  Accounts & Finance Module"),
  body("The Accounts module is the financial hub of ZARI ERP, providing unified tracking of all income (sales invoices, client payments) and expenditure (vendor bills, purchase payments) with real-time dashboards, ledgers, and GST-compliant invoicing."),

  h2("10.1  Accounts Dashboard"),
  h4("Global Filters (applied across all dashboard figures simultaneously)"),
  bull("From Date / To Date: narrows all figures to the selected date range."),
  bull("Vendor filter: shows figures for a specific vendor only."),
  bull("Client filter: shows figures for a specific client only."),

  h4("Sales Summary Cards"),
  bull("Total Invoiced: sum of all outgoing invoice values + % of total collected."),
  bull("Total Received: amount collected from clients + % collected label."),
  bull("Pending Receivables: outstanding amount + % uncollected alert."),

  h4("Purchase Summary Cards"),
  bull("Total Vendor Bills: sum of all vendor payables."),
  bull("Paid to Vendors: total amount disbursed."),
  bull("Pending Payables: outstanding vendor obligations."),

  h4("Visualisations"),
  bull("Monthly Sales vs. Purchases bar chart: compare revenue and expenditure month-by-month."),
  bull("Top 5 Pending Clients: list of clients with highest outstanding receivables."),
  bull("Top 5 Pending Vendors: list of vendors with highest outstanding payables."),

  h2("10.2  Invoices (Sales)"),
  body("Central invoice management — all invoices created from Style/Swatch Orders or standalone appear here."),
  h4("Invoice Types"),
  bull("Tax Invoice: standard GST invoice for completed orders."),
  bull("Proforma Invoice: pre-shipment estimate invoice."),
  bull("Credit Note: adjustment for returns, cancellations, or over-billing."),

  h4("Invoice Directions"),
  bull("Outgoing: raised by Zari Embroideries to clients (sales)."),
  bull("Incoming: received from vendors (captures as a payable reference)."),

  h4("Invoice Form Fields"),
  bull("Invoice Number (auto: INV-YYYY-XXXXX), Invoice Date, Due Date."),
  bull("Client / Vendor (Searchable Select), Reference Order (links to Style or Swatch Order)."),
  bull("Currency (multi-currency per client record), Exchange Rate (for foreign currency invoices)."),
  bull("Line Items: Description, Category, HSN Code, Qty, Unit, Rate, Amount."),
  bull("Discount: Flat or Percentage."),
  bull("CGST Rate (%), SGST Rate (%), IGST Rate (%) — auto-applied based on client state."),
  bull("Grand Total (auto-calculated), Tax Breakdown summary."),
  bull("Client GSTIN, Billing Address, Place of Supply."),
  bull("Payment Terms (text), Bank Details (pulled from Settings)."),

  h4("Invoice Actions"),
  bull("Save as Draft, Mark as Sent, Mark as Paid, Cancel Invoice."),
  bull("Record Payment: capture partial or full payment with amount, date, mode (Bank/UPI/Cash/Cheque), and UTR/reference."),
  bull("Print / PDF Preview: renders the invoice in print format."),
  bull("Re-import from Cost Sheet: auto-populates line items from the order's costing tab."),

  h4("Invoice List View"),
  bull("Summary cards at top: Total Invoice Value, Amount Received, Amount Pending."),
  bull("Search: by invoice number, client/vendor name, or reference order."),
  bull("Filter: Direction (All/Outgoing/Incoming), Type (Tax/Proforma/Credit Note), Status (Draft/Sent/Paid/Cancelled), Order Type."),
  bull("Columns: Invoice No., Direction, Type, Client/Vendor, Reference, Currency, Total, Received, Pending, Date."),

  h2("10.3  Purchases — Vendor Bills & Payments"),
  body("Tracks all outgoing payments to vendors across procurement, costing outsource, artisan labour, shipping, and other expenses."),
  h4("Sources of Vendor Liabilities (unified)"),
  bull("Purchase Receipts / GRNs: goods received from vendor — auto-creates a payable."),
  bull("Costing Outsource Jobs: jobs assigned to external vendors on swatch/style orders."),
  bull("Artisan Labour: timesheets for artisan payments."),
  bull("Shipping Costs: amounts due to courier/freight vendors."),
  bull("Other Expenses: miscellaneous overheads."),

  h4("Bill Tracking Fields"),
  bull("Vendor, Reference Number, Department, Total Bill Amount, Paid Amount, Pending Balance, Due Date, Status."),

  h4("Payment Recording"),
  bull("Amount, Payment Date, Payment Mode: Bank Transfer / UPI / Cash / Cheque / DD."),
  bull("UTR Number / Transaction Reference, Bank Account Used, Remarks."),
  bull("Supports partial payments — balance updated after each payment."),

  h4("List Filters"),
  bull("Status Tabs: All, Unpaid, Partially Paid, Paid, Pending."),
  bull("Category / Department dropdown."),
  bull("Search by Reference Number or Vendor name."),

  h2("10.4  Vendor Ledger"),
  bull("Full transaction history per vendor: Bills vs. Payments with running balance."),
  bull("Filter by date range."),
  bull("Export as PDF or CSV statement — suitable for vendor reconciliation."),

  h2("10.5  Client Ledger"),
  bull("Full transaction history per client: Invoices raised vs. Payments received with running balance."),
  bull("Filter by date range."),
  bull("Export as PDF or CSV statement."),

  h2("10.6  Credit & Debit Notes"),
  bull("Credit Note: issued to the client to reduce an outstanding balance (returns, over-billing)."),
  bull("Debit Note: issued to increase an outstanding balance (under-billing, additional charges)."),
  bull("Fields: Note Number, Date, Reference Invoice, Client/Vendor, Line Items, Reason, Amount."),
  bull("Linked to original invoice for audit trail."),

  h2("10.7  Other Expenses"),
  bull("Records non-procurement operational costs: electricity, rent, office supplies, maintenance."),
  bull("Fields: Expense Name, Category, Amount, Date, Vendor (optional), Reference, Notes."),
  bull("Appears in the Purchases / Payables summary for complete expenditure tracking."),

  pb(),
];

// ────────────────────────────────────────────────────────────────────────────
// SECTION 11 — Logistics
// ────────────────────────────────────────────────────────────────────────────
const sec11 = [
  ...banner("11.  Logistics Module"),
  body("The Logistics module manages the physical dispatch of goods — from packing items into boxes, to assigning them to shipments, to tracking delivery status across all order types."),

  h2("11.1  Packing Lists"),
  body("A Packing List is the core logistics document. It defines how goods are physically packed per client shipment — specifying which products go in which package with exact weights and dimensions."),

  h4("Packing List Status Workflow"),
  statusFlow(["Draft", "Ready", "Shipped"]),

  h4("Packing List Header Fields"),
  bull("PL Number (auto: PL-YYYY-XXXX), Client (Searchable Select)."),
  bull("Delivery Address (select from client's stored delivery addresses)."),
  bull("Destination Country."),
  bull("Package Type: Carton / Bag / Roll / Other."),
  bull("Total Number of Packages."),
  bull("Shipment (select existing or create new inline)."),

  h4("Packages Section (repeatable per package)"),
  bull("Package Number (auto-incremented), Package Label / Mark."),
  bull("Dimensions: Length × Width × Height (cm)."),
  bull("Net Weight (kg), Gross Weight (kg)."),
  bull("Items within the package (repeatable per package):"),
  bull("  Source Order: Swatch Order or Style Order (Searchable Select).", 1),
  bull("  Product (from the selected order's product list).", 1),
  bull("  Description, Quantity, Unit (pcs / metres / kg), Weight per Item.", 1),

  h4("Shipment & Details Section"),
  bull("Select existing Shipment or click Create New to create one inline."),
  bull("Inline shipment fields: Shipping Vendor, Tracking Number, Tracking URL, Weight, Cost, Status, Ship Date, Expected Delivery Date."),
  bull("Shipment is only saved to the database when Save Packing List is clicked — no orphaned records if cancelled."),

  h4("Packing List Actions"),
  bull("Save Packing List: saves all packages, items, and the linked/new shipment together."),
  bull("Print / PDF: generates a formatted packing list document for inclusion with shipment."),
  bull("View: read-only summary of the packing list with all package details."),

  h4("List View"),
  bull("Search: by PL Number, Client, or Shipment reference."),
  bull("Filter: by Client and Status (Draft / Ready / Shipped)."),
  bull("Columns: PL Number, Client, Delivery Address, Shipment, Destination, Packages, Net Weight, Gross Weight, Status."),

  h2("11.2  Shipping — Centralised Shipment Tracker"),
  body("The Shipping module aggregates all shipment records created across Swatch Orders, Style Orders, and Packing Lists into one centralised view."),

  h4("Shipment Status Workflow"),
  statusFlow(["Draft", "Dispatched", "In Transit", "Delivered", "Returned", "Cancelled"]),

  h4("Shipment Record Fields"),
  bull("Shipment Number (auto-generated), Reference Type (Swatch / Style / PackingList)."),
  bull("Reference Order ID (links back to the source order or packing list)."),
  bull("Client name (pulled from the linked order), Shipping Vendor."),
  bull("Tracking Number, Tracking URL (clickable)."),
  bull("Weight (kg), Shipping Cost (₹)."),
  bull("Shipment Date, Expected Delivery Date (EDD), Actual Delivery Date."),
  bull("Status, Internal Notes."),

  h4("List View Filters"),
  bull("Search: by Tracking Number, Reference ID, or Client name."),
  bull("Filter: Status (All/Dispatched/In Transit/Delivered/etc.)."),
  bull("Filter: Type (All / Swatch / Style / PackingList)."),
  bull("Filter: Vendor."),
  bull("Filter: Ship Date (date picker)."),
  bull("Columns: Type, Ref ID, Client, Vendor, Tracking No., Weight, Cost, Status, Ship Date, EDD."),

  pb(),
];

// ────────────────────────────────────────────────────────────────────────────
// SECTION 12 — Reports
// ────────────────────────────────────────────────────────────────────────────
const sec12 = [
  ...banner("12.  Reports Module"),
  body("The Reports module provides exportable, filterable data views across all ERP modules — enabling management to analyse operations, financials, inventory, and GST compliance."),

  h2("12.1  Available Reports"),
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      hdrRow("Report Name", "Data Covered", "Key Filters"),
      tRow(boldCell("Stock Summary"),          cell("Current stock levels, reserved qty, available qty, and reorder alerts per item"), cell("Category, Sub-Category, Stock Status")),
      tRow(boldCell("Stock Movement", MID,"F9FAFB"), cell("Every IN/OUT transaction with date, reference, and running balance"), cell("Item, Date Range, Movement Type")),
      tRow(boldCell("Purchase Summary"),       cell("PO vs. PR vs. Vendor Bill values per vendor with variance"), cell("Vendor, Date Range, Status")),
      tRow(boldCell("Invoice Summary", MID,"F9FAFB"), cell("Client-wise invoicing, collected, and pending amounts"), cell("Client, Date Range, Status")),
      tRow(boldCell("Vendor Ledger"),          cell("Full transaction history per vendor — bills and payments with running balance"), cell("Vendor, Date Range")),
      tRow(boldCell("Client Ledger", MID,"F9FAFB"), cell("Full transaction history per client — invoices and receipts with running balance"), cell("Client, Date Range")),
      tRow(boldCell("Order Profitability"),    cell("Revenue vs. material + labour + shipping costs per order — gross margin per order"), cell("Order Type, Client, Date Range")),
      tRow(boldCell("Purchase vs. Sales", MID,"F9FAFB"), cell("Aggregate P&L — total sales revenue vs. total purchase expenditure by period"), cell("Date Range, Month/Year")),
      tRow(boldCell("GST Summary"),            cell("GST Collected (output tax on sales) vs. GST Paid (input tax on purchases) and Net GST Liability"), cell("Financial Year, Month, GST Type")),
    ],
  }),

  h2("12.2  Common Actions Across All Reports"),
  bull("Apply Filters: dynamic data refresh without page reload."),
  bull("Export CSV: download current filtered view as a .csv spreadsheet."),
  bull("Pagination: navigate large datasets with page size control."),
  bull("Date Range pickers with preset shortcuts: This Month, Last Month, This Quarter, This Year."),

  pb(),
];

// ────────────────────────────────────────────────────────────────────────────
// SECTION 13 — Settings & Administration
// ────────────────────────────────────────────────────────────────────────────
const sec13 = [
  ...banner("13.  Settings & Administration"),
  body("The Settings module is accessible from the user profile dropdown. It is divided into tabbed sections covering profile, company configuration, financial settings, warehouses, invoice templates, and audit logs."),

  h2("13.1  Profile"),
  bull("Display Name, Profile Photo (upload / replace / remove)."),
  bull("Phone Number, Email Address (read-only — cannot be changed post-registration)."),
  bull("Change Password: Current Password, New Password, Confirm New Password."),

  h2("13.2  Currency Settings"),
  bull("Configure which currencies are active in the system."),
  bull("Set exchange rates for foreign currency invoicing."),
  bull("INR is the base/default currency; all financial summaries display in INR."),

  h2("13.3  Bank Details"),
  bull("Add company bank accounts that appear on invoices."),
  bull("Fields per account: Bank Name, Account Number, IFSC Code, Branch Name, Account Type, UPI ID."),
  bull("Multiple bank accounts supported — select which appears on each invoice."),

  h2("13.4  GST Settings"),
  bull("Company GSTIN, Legal Name (as per GST registration)."),
  bull("Place of Business (State) — determines CGST+SGST vs. IGST applicability."),
  bull("Company PAN Number."),
  bull("Default GST rates for common invoice categories."),

  h2("13.5  Warehouses"),
  bull("Define warehouse / storage locations used in Goods Receipts and stock tracking."),
  bull("Fields: Warehouse Name, Address, City, State, PIN, Country."),
  bull("Multiple warehouses supported — stock movements are attributed to a warehouse."),

  h2("13.6  Invoice Templates"),
  bull("Configurable invoice header: Company Name, Logo, Address, GSTIN, Phone, Email, Website."),
  bull("Invoice footer: custom terms, bank details display preference, signature line."),
  bull("Preview rendered invoice template before saving."),

  h2("13.7  Activity Logs"),
  bull("Timestamped log of all significant actions in the system."),
  bull("Fields: Date/Time, User, Action Type, Module, Record ID, Details."),
  bull("Filter by User, Module, Date Range."),
  bull("Read-only — cannot be edited or deleted. Full audit trail."),

  h2("13.8  User Management (Admin Only)"),
  bull("List all users: Name, Email, Role, Status (Active/Inactive), Last Login, Created Date."),
  bull("Invite User: enter email and role → system sends invitation email with token link."),
  bull("Accept Invite: user sets password via the token link; account activated."),
  bull("Edit User: change display name, role."),
  bull("Deactivate/Activate: toggle user status — inactive users cannot log in."),
  bull("Remove User: permanently delete user account (Admin only)."),

  pb(),
];

// ────────────────────────────────────────────────────────────────────────────
// SECTION 14 — User Manual (In-App)
// ────────────────────────────────────────────────────────────────────────────
const sec14 = [
  ...banner("14.  Built-in User Manual"),
  body("ZARI ERP includes a comprehensive built-in User Manual accessible from within the application at /help. It is available to all logged-in users without any external documentation dependency."),

  h2("14.1  Features"),
  bull("12 sections covering every module: Introduction, Getting Started, Dashboard, Masters, Swatch Orders, Style Orders, Quotations, Accounts, Inventory, Procurement, Logistics, and Settings."),
  bull("Left sidebar navigation with collapsible sub-sections per module."),
  bull("Full-text search across all section headings."),
  bull("Annotated screenshots: every major module has a real authenticated screenshot with gold (#C6AF4B) bordered callout highlight boxes and a numbered legend."),
  bull("Step-by-step numbered workflows for all key operations."),
  bull("Download options: Full Manual (all sections) or Current Section — rendered via browser print API with @media print CSS."),
  bull("Accessible from the user profile dropdown as 'User Manual' (BookOpen icon)."),

  h2("14.2  Screenshots Embedded"),
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      hdrRow("Section", "Screenshot", "Callouts"),
      tRow(boldCell("Dashboard"),      cell("dashboard.jpg"),       cell("KPI cards, revenue chart, status tracker")),
      tRow(boldCell("Clients", MID,"F9FAFB"), cell("clients.jpg"),  cell("Add Client, search bar, filter/export, table")),
      tRow(boldCell("Vendors"),        cell("vendors.jpg"),         cell("Add Vendor, search, filter/export, table")),
      tRow(boldCell("Swatch Orders", MID,"F9FAFB"), cell("swatch-orders.jpg"), cell("New button, status tabs, search, order cards")),
      tRow(boldCell("Style Orders"),   cell("style-orders.jpg"),    cell("New button, status tabs, search, order cards")),
      tRow(boldCell("Accounts Dashboard", MID,"F9FAFB"), cell("accounts.jpg"), cell("Date filters, sales summary, vendor bills")),
      tRow(boldCell("Invoices"),       cell("invoices.jpg"),        cell("New Invoice, summary cards, filters, table")),
      tRow(boldCell("Inventory", MID,"F9FAFB"), cell("inventory.jpg"), cell("Filters, stock cards, procurement snapshot, charts")),
      tRow(boldCell("Packing Lists"),  cell("packing-lists.jpg"),   cell("New PL, search, filters, table")),
      tRow(boldCell("Shipping", MID,"F9FAFB"), cell("shipping.jpg"), cell("Search, multi-filters, shipment table")),
      tRow(boldCell("Settings"),       cell("settings.jpg"),        cell("Sidebar tabs, profile form, change password")),
    ],
  }),

  pb(),
];

// ────────────────────────────────────────────────────────────────────────────
// SECTION 15 — Out of Scope
// ────────────────────────────────────────────────────────────────────────────
const sec15 = [
  ...banner("15.  Out of Scope"),
  body("The following are explicitly excluded from the current version of ZARI ERP:"),
  bull("Native mobile application (iOS / Android)."),
  bull("Third-party accounting software integration (Tally, Zoho Books, QuickBooks, Busy)."),
  bull("E-commerce storefront or public customer-facing ordering portal."),
  bull("Automated bank reconciliation via bank API feeds."),
  bull("Multi-company / multi-branch ledger consolidation."),
  bull("Production floor IoT or machine-level integration."),
  bull("Automated GST filing or government portal (GSTN) submission."),
  bull("AI/ML-based demand forecasting or production scheduling."),
  bull("Employee payroll management."),
  bull("On-premises / self-hosted deployment — cloud-only at present."),

  pb(),
];

// ────────────────────────────────────────────────────────────────────────────
// SECTION 16 — Assumptions & Constraints
// ────────────────────────────────────────────────────────────────────────────
const sec16 = [
  ...banner("16.  Assumptions & Constraints"),

  h2("16.1  Assumptions"),
  bull("All users have access to a modern browser (Chrome 110+, Firefox 110+, Edge 110+, or Safari 16+)."),
  bull("Internet connectivity is available continuously during system use."),
  bull("Master data (clients, vendors, materials, HSN codes) is provided by the client during onboarding."),
  bull("GST rates and GSTIN are configured in Settings before any invoicing begins."),
  bull("Admin role is assigned to at least one person before staff onboarding."),
  bull("Shipping vendor list is maintained by the operations team in the system."),

  h2("16.2  Constraints"),
  bull("Web-only — no native mobile application in this version."),
  bull("Single database instance — horizontal sharding not implemented."),
  bull("Single-currency per client record — no automatic multi-currency ledger roll-up."),
  bull("Artwork files stored as Base64 in PostgreSQL — large files (>5MB per image) may slow upload."),
  bull("PDF generation (invoices, POs, packing lists) is client-side — depends on browser print capabilities."),
  bull("No offline/PWA mode — internet connection required at all times."),

  pb(),
];

// ────────────────────────────────────────────────────────────────────────────
// SECTION 17 — Deliverables Summary
// ────────────────────────────────────────────────────────────────────────────
const sec17 = [
  ...banner("17.  Deliverables Summary"),
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      hdrRow("#", "Deliverable", "Status"),
      tRow(boldCell("1"), cell("Full-stack web application (ZARI ERP) — all 14 modules"), boldCell("Delivered", GREEN, GREEN_L)),
      tRow(boldCell("2", MID,"F9FAFB"), cell("React + Vite frontend with Tailwind brand theme"), boldCell("Delivered", GREEN, GREEN_L)),
      tRow(boldCell("3"), cell("Node.js + Express REST API — 30+ route files"), boldCell("Delivered", GREEN, GREEN_L)),
      tRow(boldCell("4", MID,"F9FAFB"), cell("PostgreSQL database with auto-migration schema"), boldCell("Delivered", GREEN, GREEN_L)),
      tRow(boldCell("5"), cell("JWT + bcrypt authentication and user management"), boldCell("Delivered", GREEN, GREEN_L)),
      tRow(boldCell("6", MID,"F9FAFB"), cell("Real-time dashboards (Main + Accounts + Inventory)"), boldCell("Delivered", GREEN, GREEN_L)),
      tRow(boldCell("7"), cell("GST-compliant invoicing with PDF preview"), boldCell("Delivered", GREEN, GREEN_L)),
      tRow(boldCell("8", MID,"F9FAFB"), cell("Procurement module (PO + GRN)"), boldCell("Delivered", GREEN, GREEN_L)),
      tRow(boldCell("9"), cell("Logistics module (Packing Lists + Shipping)"), boldCell("Delivered", GREEN, GREEN_L)),
      tRow(boldCell("10", MID,"F9FAFB"), cell("Quotation module with PDF generation"), boldCell("Delivered", GREEN, GREEN_L)),
      tRow(boldCell("11"), cell("Built-in User Manual with annotated screenshots"), boldCell("Delivered", GREEN, GREEN_L)),
      tRow(boldCell("12", MID,"F9FAFB"), cell("This Scope Document (Word format)"), boldCell("Delivered", GREEN, GREEN_L)),
    ],
  }),

  pb(),
];

// ────────────────────────────────────────────────────────────────────────────
// SECTION 18 — Sign-off
// ────────────────────────────────────────────────────────────────────────────
const sec18 = [
  ...banner("18.  Approval & Sign-off"),
  sp(160),
  body("By signing below, both parties confirm that this Detailed Scope Document accurately represents the agreed deliverables for the ZARI ERP project."),
  sp(200),

  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              p(runG("Client Representative", 24)),
              sp(360),
              body("Name:  ____________________________________"),
              sp(60),
              body("Designation:  _____________________________"),
              sp(60),
              body("Date:  ____________________________________"),
              sp(120),
              body("Signature:  _______________________________"),
            ],
            width: { size: 50, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: GOLD_L, fill: GOLD_L },
            margins: { top: 160, bottom: 220, left: 280, right: 160 },
          }),
          new TableCell({
            children: [
              p(runB("Development Team", 24, MID)),
              sp(360),
              body("Name:  ____________________________________"),
              sp(60),
              body("Designation:  _____________________________"),
              sp(60),
              body("Date:  ____________________________________"),
              sp(120),
              body("Signature:  _______________________________"),
            ],
            width: { size: 50, type: WidthType.PERCENTAGE },
            margins: { top: 160, bottom: 220, left: 280, right: 160 },
          }),
        ],
      }),
    ],
  }),

  sp(400),
  p(runI("ZARI ERP — Detailed Project Scope Document  ·  Version 2.0  ·  April 2026  ·  Confidential"), { alignment: AlignmentType.CENTER }),
];

// ────────────────────────────────────────────────────────────────────────────
// Assemble & Export
// ────────────────────────────────────────────────────────────────────────────
const doc = new Document({
  styles: {
    default: {
      document: { run: { font: "Calibri", size: 22, color: DARK } },
    },
  },
  sections: [{
    properties: {
      page: {
        margin: {
          top:    convertInchesToTwip(1.0),
          bottom: convertInchesToTwip(1.0),
          left:   convertInchesToTwip(1.2),
          right:  convertInchesToTwip(1.2),
        },
      },
    },
    children: [
      ...cover,
      ...sec1,
      ...sec2,
      ...sec3,
      ...sec4,
      ...sec5,
      ...sec6,
      ...sec7,
      ...sec8,
      ...sec9,
      ...sec10,
      ...sec11,
      ...sec12,
      ...sec13,
      ...sec14,
      ...sec15,
      ...sec16,
      ...sec17,
      ...sec18,
    ],
  }],
});

const buffer = await Packer.toBuffer(doc);
writeFileSync("ZARI_ERP_Scope_Document_v2.docx", buffer);
console.log("✓  Generated: ZARI_ERP_Scope_Document_v2.docx");
