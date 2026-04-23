import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, ShadingType, convertInchesToTwip,
  PageBreak, ExternalHyperlink, UnderlineType,
  Header, Footer, PageNumber, NumberFormat,
  LevelFormat, TabStopType, TabStopPosition,
} from "docx";
import { writeFileSync } from "fs";

// ── Colour palette ──────────────────────────────────────────────────────────
const GOLD   = "C6AF4B";
const GOLD_L = "FDF8E7";   // light gold for shaded cells
const DARK   = "1A1A1A";
const GRAY   = "6B7280";
const WHITE  = "FFFFFF";
const BLUE   = "1E40AF";

// ── Helper: styled text ─────────────────────────────────────────────────────
const t = (text, opts = {}) =>
  new TextRun({ text, font: "Calibri", color: DARK, size: 22, ...opts });

const bold = (text, size = 22, color = DARK) =>
  new TextRun({ text, font: "Calibri", bold: true, size, color });

const gold = (text, size = 22) =>
  new TextRun({ text, font: "Calibri", bold: true, size, color: GOLD });

const para = (runs, opts = {}) =>
  new Paragraph({ children: Array.isArray(runs) ? runs : [runs], ...opts });

const spacer = (before = 120) =>
  new Paragraph({ children: [], spacing: { before, after: 0 } });

// ── Section heading ─────────────────────────────────────────────────────────
const sectionHeading = (text) => [
  spacer(240),
  new Paragraph({
    children: [
      new TextRun({
        text: "  " + text,
        font: "Calibri",
        bold: true,
        size: 28,
        color: WHITE,
      }),
    ],
    shading: { type: ShadingType.SOLID, color: GOLD, fill: GOLD },
    spacing: { before: 0, after: 0 },
    indent: { left: 0 },
  }),
];

// ── Sub-heading ─────────────────────────────────────────────────────────────
const subHeading = (text) =>
  new Paragraph({
    children: [bold(text, 24, GOLD)],
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD, space: 4 },
    },
    spacing: { before: 240, after: 80 },
  });

// ── Body paragraph ──────────────────────────────────────────────────────────
const body = (text, opts = {}) =>
  new Paragraph({
    children: [t(text)],
    spacing: { before: 60, after: 60 },
    ...opts,
  });

// ── Bullet ──────────────────────────────────────────────────────────────────
const bullet = (text, sub = false) =>
  new Paragraph({
    children: [t(text)],
    bullet: { level: sub ? 1 : 0 },
    spacing: { before: 40, after: 40 },
  });

// ── Simple 2-col table row ──────────────────────────────────────────────────
const infoRow = (label, value, shade = false) =>
  new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [bold(label)], spacing: { before: 60, after: 60 } })],
        width: { size: 30, type: WidthType.PERCENTAGE },
        shading: shade
          ? { type: ShadingType.SOLID, color: GOLD_L, fill: GOLD_L }
          : { type: ShadingType.SOLID, color: "F9FAFB", fill: "F9FAFB" },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
      }),
      new TableCell({
        children: [new Paragraph({ children: [t(value)], spacing: { before: 60, after: 60 } })],
        width: { size: 70, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.SOLID, color: WHITE, fill: WHITE },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
      }),
    ],
  });

// ── Module table row ────────────────────────────────────────────────────────
const moduleRow = (module, description, status, shade = false) =>
  new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [bold(module, 20, GOLD)], spacing: { before: 60, after: 60 } })],
        width: { size: 22, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.SOLID, color: shade ? GOLD_L : "F9FAFB", fill: shade ? GOLD_L : "F9FAFB" },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
      }),
      new TableCell({
        children: [new Paragraph({ children: [t(description)], spacing: { before: 60, after: 60 } })],
        width: { size: 63, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.SOLID, color: WHITE, fill: WHITE },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
      }),
      new TableCell({
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: status,
                font: "Calibri",
                bold: true,
                size: 18,
                color: status === "Delivered" ? "16A34A" : status === "In Scope" ? GOLD : GRAY,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 60 },
          }),
        ],
        width: { size: 15, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.SOLID, color: WHITE, fill: WHITE },
        margins: { top: 80, bottom: 80, left: 60, right: 60 },
      }),
    ],
  });

// ── Table header row ────────────────────────────────────────────────────────
const tableHeader = (...labels) =>
  new TableRow({
    tableHeader: true,
    children: labels.map((label, i) =>
      new TableCell({
        children: [
          new Paragraph({
            children: [new TextRun({ text: label, font: "Calibri", bold: true, size: 20, color: WHITE })],
            spacing: { before: 80, after: 80 },
          }),
        ],
        shading: { type: ShadingType.SOLID, color: GOLD, fill: GOLD },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
      })
    ),
  });

// ── Title page ──────────────────────────────────────────────────────────────
const titlePage = [
  spacer(1200),
  new Paragraph({
    children: [
      new TextRun({
        text: "ZARI ERP",
        font: "Calibri",
        bold: true,
        size: 72,
        color: GOLD,
      }),
    ],
    alignment: AlignmentType.CENTER,
  }),
  new Paragraph({
    children: [
      new TextRun({
        text: "Enterprise Resource Planning System",
        font: "Calibri",
        size: 36,
        color: GRAY,
      }),
    ],
    alignment: AlignmentType.CENTER,
  }),
  spacer(60),
  new Paragraph({
    children: [
      new TextRun({ text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", font: "Calibri", color: GOLD, size: 28 }),
    ],
    alignment: AlignmentType.CENTER,
  }),
  spacer(120),
  new Paragraph({
    children: [
      new TextRun({ text: "PROJECT SCOPE DOCUMENT", font: "Calibri", bold: true, size: 40, color: DARK }),
    ],
    alignment: AlignmentType.CENTER,
  }),
  spacer(60),
  new Paragraph({
    children: [
      new TextRun({ text: "Zari Embroideries — Internal & Client Reference", font: "Calibri", size: 24, color: GRAY, italics: true }),
    ],
    alignment: AlignmentType.CENTER,
  }),
  spacer(480),
  new Paragraph({
    children: [
      new TextRun({ text: "Version 1.0  ·  April 2026  ·  Confidential", font: "Calibri", size: 20, color: GRAY }),
    ],
    alignment: AlignmentType.CENTER,
  }),
  // Page break after cover
  new Paragraph({ children: [new PageBreak()] }),
];

// ────────────────────────────────────────────────────────────────────────────
// SECTION 1 — Project Overview
// ────────────────────────────────────────────────────────────────────────────
const section1 = [
  ...sectionHeading("1.  Project Overview"),
  spacer(120),

  subHeading("1.1  Background"),
  body(
    "Zari Embroideries is a premium embroidery manufacturer and exporter supplying high-fashion brands across India and internationally. " +
    "The business manages a complex pipeline of swatch sampling, custom style production, inventory procurement, logistics, and client invoicing — " +
    "all of which were previously tracked through a combination of spreadsheets, WhatsApp, and standalone tools."
  ),
  body(
    "ZARI ERP was commissioned to replace these fragmented workflows with a single, purpose-built web application that gives every " +
    "team member — from production staff to the accounts team — a unified view of the business in real time."
  ),

  spacer(120),
  subHeading("1.2  Project Identity"),

  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      infoRow("Project Name",    "ZARI ERP — Enterprise Resource Planning System", true),
      infoRow("Client",          "Zari Embroideries"),
      infoRow("Project Type",    "Custom Full-Stack Web Application"),
      infoRow("Version",         "1.0 (April 2026)"),
      infoRow("Document Status", "Final — For Client & Team Review", true),
      infoRow("Prepared By",     "Development Team"),
      infoRow("Audience",        "Zari Embroideries Management, Operations Team, Development Team"),
    ],
  }),

  spacer(120),
  subHeading("1.3  Objectives"),
  body("The primary objectives of ZARI ERP are:"),
  bullet("Centralise all order management — swatch sampling, style production, and quotations — on a single platform."),
  bullet("Provide real-time inventory visibility across fabric, materials, and packaging."),
  bullet("Automate financial workflows: GST invoicing, payment tracking, vendor bills, and account reconciliation."),
  bullet("Streamline logistics with digital packing lists, package management, and shipment tracking."),
  bullet("Deliver actionable dashboards and reports so management can make data-driven decisions instantly."),
  bullet("Reduce manual data entry, eliminate spreadsheet errors, and cut order-processing time."),

  new Paragraph({ children: [new PageBreak()] }),
];

// ────────────────────────────────────────────────────────────────────────────
// SECTION 2 — Scope of Work
// ────────────────────────────────────────────────────────────────────────────
const section2 = [
  ...sectionHeading("2.  Scope of Work"),
  spacer(120),

  subHeading("2.1  Modules in Scope"),
  body("The following table lists every module included in the ZARI ERP scope, with a brief description and delivery status."),
  spacer(80),

  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      tableHeader("Module", "Description", "Status"),
      moduleRow("Dashboard",           "Live KPI cards (Style Orders, Swatch Orders, Artworks, Active Clients), monthly revenue bar chart, and style/swatch pipeline donut trackers.", "Delivered"),
      moduleRow("Client Master",        "Full CRUD for client records — brand name, contact, GST, currency, addresses, status. Search, filter, and Excel export.", "Delivered", true),
      moduleRow("Vendor Master",        "Supplier records with GST, bank details, payment terms, and status. Search, filter, Excel export.", "Delivered"),
      moduleRow("Materials & Fabrics",  "Reference data for raw materials, thread, trims, and fabric types used in costing and inventory.", "Delivered", true),
      moduleRow("Categories & HSN",     "Configurable product categories, sub-categories, and HSN codes for GST compliance.", "Delivered"),
      moduleRow("Swatch Orders",        "End-to-end swatch order lifecycle: Draft → Issued → In Sampling → In Artwork → Pending Approval → Completed. Artworks upload, costing sheet, and shipment.", "Delivered", true),
      moduleRow("Style Orders",         "Full production order workflow: Draft → Issued → In Production → In Review → Pending Approval → Completed. Product line items, artworks, costing, invoicing, and shipment.", "Delivered"),
      moduleRow("Quotations",           "Client quotation creation with product lines, pricing, and conversion to style orders.", "Delivered", true),
      moduleRow("Inventory Dashboard",  "Live stock dashboard with category/date filters, stock status cards (total/in/low/out), procurement snapshot, and category-split charts.", "Delivered"),
      moduleRow("Item Stock List",      "Full inventory list with stock levels, unit of measure, reserved quantities, and transaction history per item.", "Delivered", true),
      moduleRow("Purchase Orders",      "Vendor PO creation, line items, approval workflow, and receipt matching.", "Delivered"),
      moduleRow("Goods Receipt",        "Record goods received against POs, update stock levels, and trigger financial entries.", "Delivered", true),
      moduleRow("Accounts Dashboard",   "Real-time financial summary: total invoiced, received, pending receivables, vendor bills, and payables — filterable by date, vendor, and client.", "Delivered"),
      moduleRow("Invoices",             "GST invoice generation (Tax/Proforma/Credit Note), direction (incoming/outgoing), payment recording, and PDF preview.", "Delivered", true),
      moduleRow("Ledger",               "Transaction-level ledger per client and vendor with date-range filtering.", "Delivered"),
      moduleRow("Packing Lists",        "Digital packing lists per client/shipment — packages, items per package, net/gross weights, dimensions, and destination.", "Delivered", true),
      moduleRow("Shipping",             "Centralised shipment tracking across all order types — vendor, tracking number, cost, status, ship date, and EDD.", "Delivered"),
      moduleRow("Settings",             "Profile management, password change, currency configuration, bank details, GST settings, warehouse management, invoice templates, and activity logs.", "Delivered", true),
      moduleRow("User Manual (/help)",  "Built-in interactive user manual with 12 sections, sidebar navigation, search, annotated real screenshots with gold callout highlights, and print/download capability.", "Delivered"),
    ],
  }),

  spacer(200),
  subHeading("2.2  Out of Scope"),
  body("The following are explicitly excluded from the current project scope:"),
  bullet("Mobile application (iOS / Android native app)"),
  bullet("Third-party accounting software integration (e.g. Tally, Zoho Books, QuickBooks)"),
  bullet("E-commerce storefront or customer-facing portal"),
  bullet("Automated bank reconciliation via bank API feeds"),
  bullet("Multi-company / multi-branch ledger consolidation"),
  bullet("Production floor IoT or machine integration"),
  bullet("Automated GST filing or government portal submission"),

  new Paragraph({ children: [new PageBreak()] }),
];

// ────────────────────────────────────────────────────────────────────────────
// SECTION 3 — Key Features
// ────────────────────────────────────────────────────────────────────────────
const section3 = [
  ...sectionHeading("3.  Key Features & Capabilities"),
  spacer(120),

  subHeading("3.1  Order Management"),
  bullet("Card-grid and list views for Swatch Orders and Style Orders."),
  bullet("Status filter tabs: All · Draft · Issued · In Progress · Completed · Rejected · Cancelled (and stage-specific variants)."),
  bullet("Priority and chargeability filters across all order lists."),
  bullet("Auto-generated order codes: ZST-XXXX for Style, ZSW-XXXX for Swatch."),
  bullet("Artwork attachment per order item with lightbox gallery viewer."),
  bullet("Costing sheet per order with material, labour, and overhead line items."),
  bullet("Inline shipment creation directly from the order form."),

  subHeading("3.2  Inventory & Procurement"),
  bullet("Live stock dashboard filterable by category, sub-category, and date range."),
  bullet("Stock status breakdown: In Stock · Low Stock · Out of Stock with item-level drill-down."),
  bullet("Reservation tracking — fabric/material reserved per swatch and style order."),
  bullet("Purchase Order workflow with vendor selection, line items, and approval."),
  bullet("Goods Receipt Note linked to POs — auto-updates stock on receipt."),

  subHeading("3.3  Finance & Accounts"),
  bullet("Tax Invoice, Proforma Invoice, and Credit Note generation with GST (CGST/SGST/IGST) calculation."),
  bullet("Incoming and outgoing invoice directions for full AR/AP visibility."),
  bullet("Payment recording against invoices with balance tracking."),
  bullet("Accounts Dashboard with date, vendor, and client filters applied across all figures simultaneously."),
  bullet("Vendor and client ledger with full transaction history."),

  subHeading("3.4  Logistics"),
  bullet("Packing list per client and shipment — define packages with exact dimensions and weights."),
  bullet("Assign order line items to specific packages for precise shipment documentation."),
  bullet("Inline shipment creation from packing list form — no orphaned records if cancelled."),
  bullet("Centralised Shipping view across all order types (Swatch, Style, Packing List)."),
  bullet("Shipment status tracking: Draft → In Transit → Delivered."),

  subHeading("3.5  System & Administration"),
  bullet("Role-based access: Admin can manage users; regular users have operational access."),
  bullet("JWT authentication with bcrypt password hashing."),
  bullet("Activity log visible in Settings for audit trail."),
  bullet("Configurable currencies, bank accounts, GST numbers, and warehouse addresses."),
  bullet("Printable and downloadable invoice templates."),
  bullet("Built-in User Manual with annotated screenshots, section search, and PDF print/download."),

  new Paragraph({ children: [new PageBreak()] }),
];

// ────────────────────────────────────────────────────────────────────────────
// SECTION 4 — Technical Architecture
// ────────────────────────────────────────────────────────────────────────────
const section4 = [
  ...sectionHeading("4.  Technical Architecture"),
  spacer(120),

  subHeading("4.1  Technology Stack"),
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      tableHeader("Layer", "Technology", "Purpose"),
      new TableRow({ children: [
        new TableCell({ children: [para(bold("Frontend"))], shading: { type: ShadingType.SOLID, color: GOLD_L, fill: GOLD_L }, width: { size: 20, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
        new TableCell({ children: [para(t("React 18 + Vite"))], width: { size: 40, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
        new TableCell({ children: [para(t("UI framework and build tooling"))], width: { size: 40, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
      ]}),
      new TableRow({ children: [
        new TableCell({ children: [para(bold("Styling"))], shading: { type: ShadingType.SOLID, color: "F9FAFB", fill: "F9FAFB" }, width: { size: 20, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
        new TableCell({ children: [para(t("Tailwind CSS"))], width: { size: 40, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
        new TableCell({ children: [para(t("Utility-first CSS with brand theme (#C6AF4B)"))], width: { size: 40, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
      ]}),
      new TableRow({ children: [
        new TableCell({ children: [para(bold("Routing"))], shading: { type: ShadingType.SOLID, color: GOLD_L, fill: GOLD_L }, width: { size: 20, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
        new TableCell({ children: [para(t("Wouter"))], width: { size: 40, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
        new TableCell({ children: [para(t("Client-side routing for single-page application"))], width: { size: 40, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
      ]}),
      new TableRow({ children: [
        new TableCell({ children: [para(bold("Charts"))], shading: { type: ShadingType.SOLID, color: "F9FAFB", fill: "F9FAFB" }, width: { size: 20, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
        new TableCell({ children: [para(t("Recharts"))], width: { size: 40, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
        new TableCell({ children: [para(t("Bar charts, donut/pie charts on dashboard and reports"))], width: { size: 40, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
      ]}),
      new TableRow({ children: [
        new TableCell({ children: [para(bold("Backend"))], shading: { type: ShadingType.SOLID, color: GOLD_L, fill: GOLD_L }, width: { size: 20, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
        new TableCell({ children: [para(t("Node.js + Express"))], width: { size: 40, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
        new TableCell({ children: [para(t("REST API server for all business logic"))], width: { size: 40, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
      ]}),
      new TableRow({ children: [
        new TableCell({ children: [para(bold("Database"))], shading: { type: ShadingType.SOLID, color: "F9FAFB", fill: "F9FAFB" }, width: { size: 20, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
        new TableCell({ children: [para(t("PostgreSQL + Raw SQL"))], width: { size: 40, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
        new TableCell({ children: [para(t("Relational data store with optimised queries"))], width: { size: 40, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
      ]}),
      new TableRow({ children: [
        new TableCell({ children: [para(bold("Auth"))], shading: { type: ShadingType.SOLID, color: GOLD_L, fill: GOLD_L }, width: { size: 20, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
        new TableCell({ children: [para(t("JWT + bcrypt"))], width: { size: 40, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
        new TableCell({ children: [para(t("Stateless token auth with secure password hashing"))], width: { size: 40, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
      ]}),
      new TableRow({ children: [
        new TableCell({ children: [para(bold("Deployment"))], shading: { type: ShadingType.SOLID, color: "F9FAFB", fill: "F9FAFB" }, width: { size: 20, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
        new TableCell({ children: [para(t("Replit Cloud"))], width: { size: 40, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
        new TableCell({ children: [para(t("Managed hosting, always-on production environment"))], width: { size: 40, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
      ]}),
    ],
  }),

  spacer(120),
  subHeading("4.2  Architecture Overview"),
  bullet("Monorepo structure managed with pnpm workspaces — frontend and API server as separate packages."),
  bullet("React frontend communicates with the Express backend via a JSON REST API on a dedicated port."),
  bullet("PostgreSQL database stores all business data; the schema is managed with raw SQL migrations on startup."),
  bullet("JWT tokens issued at login are stored client-side and sent as Bearer tokens on every API request."),
  bullet("All file uploads (artwork images) are stored as binary data in the database."),
  bullet("The production environment is hosted on Replit Cloud with a managed PostgreSQL instance."),

  new Paragraph({ children: [new PageBreak()] }),
];

// ────────────────────────────────────────────────────────────────────────────
// SECTION 5 — User Roles
// ────────────────────────────────────────────────────────────────────────────
const section5 = [
  ...sectionHeading("5.  User Roles & Access"),
  spacer(120),

  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      tableHeader("Role", "Access Level", "Primary Responsibilities"),
      new TableRow({ children: [
        new TableCell({ children: [para(bold("Admin", 20, GOLD))], shading: { type: ShadingType.SOLID, color: GOLD_L, fill: GOLD_L }, width: { size: 15, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
        new TableCell({ children: [para(t("Full access to all modules"))], width: { size: 25, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
        new TableCell({ children: [para(t("User management, settings, financial approvals, master data, and all operational modules."))], width: { size: 60, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
      ]}),
      new TableRow({ children: [
        new TableCell({ children: [para(bold("Operations", 20, DARK))], shading: { type: ShadingType.SOLID, color: "F9FAFB", fill: "F9FAFB" }, width: { size: 15, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
        new TableCell({ children: [para(t("Orders, inventory, logistics"))], width: { size: 25, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
        new TableCell({ children: [para(t("Create and manage swatch/style orders, update inventory, create packing lists and shipments."))], width: { size: 60, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
      ]}),
      new TableRow({ children: [
        new TableCell({ children: [para(bold("Accounts", 20, DARK))], shading: { type: ShadingType.SOLID, color: GOLD_L, fill: GOLD_L }, width: { size: 15, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
        new TableCell({ children: [para(t("Finance and reporting"))], width: { size: 25, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
        new TableCell({ children: [para(t("Manage invoices, record payments, view ledgers, accounts dashboard, and financial reports."))], width: { size: 60, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
      ]}),
    ],
  }),

  new Paragraph({ children: [new PageBreak()] }),
];

// ────────────────────────────────────────────────────────────────────────────
// SECTION 6 — Deliverables
// ────────────────────────────────────────────────────────────────────────────
const section6 = [
  ...sectionHeading("6.  Deliverables"),
  spacer(120),

  subHeading("6.1  Software Deliverables"),
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      tableHeader("Deliverable", "Description"),
      new TableRow({ children: [
        new TableCell({ children: [para(bold("Web Application", 20, GOLD))], shading: { type: ShadingType.SOLID, color: GOLD_L, fill: GOLD_L }, width: { size: 35, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
        new TableCell({ children: [para(t("Fully functional ZARI ERP system accessible via browser at the production URL."))], width: { size: 65, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
      ]}),
      new TableRow({ children: [
        new TableCell({ children: [para(bold("REST API", 20, DARK))], shading: { type: ShadingType.SOLID, color: "F9FAFB", fill: "F9FAFB" }, width: { size: 35, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
        new TableCell({ children: [para(t("Express API server with all business logic, authentication, and database access."))], width: { size: 65, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
      ]}),
      new TableRow({ children: [
        new TableCell({ children: [para(bold("Database Schema", 20, GOLD))], shading: { type: ShadingType.SOLID, color: GOLD_L, fill: GOLD_L }, width: { size: 35, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
        new TableCell({ children: [para(t("PostgreSQL schema for all entities with auto-migration on deployment."))], width: { size: 65, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
      ]}),
      new TableRow({ children: [
        new TableCell({ children: [para(bold("Source Code", 20, DARK))], shading: { type: ShadingType.SOLID, color: "F9FAFB", fill: "F9FAFB" }, width: { size: 35, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
        new TableCell({ children: [para(t("Full codebase (frontend + backend) in a version-controlled pnpm monorepo."))], width: { size: 65, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
      ]}),
      new TableRow({ children: [
        new TableCell({ children: [para(bold("User Manual", 20, GOLD))], shading: { type: ShadingType.SOLID, color: GOLD_L, fill: GOLD_L }, width: { size: 35, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
        new TableCell({ children: [para(t("Built-in interactive user manual (accessible at /help) with annotated screenshots, search, and print/download capability. This scope document delivered as a Word file."))], width: { size: 65, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } }),
      ]}),
    ],
  }),

  spacer(200),
  subHeading("6.2  Documentation Deliverables"),
  bullet("This Project Scope Document (Word format)"),
  bullet("In-app User Manual — 12 sections covering all modules with annotated screenshots"),
  bullet("Module-level step-by-step instructions for all major workflows"),

  new Paragraph({ children: [new PageBreak()] }),
];

// ────────────────────────────────────────────────────────────────────────────
// SECTION 7 — Assumptions & Constraints
// ────────────────────────────────────────────────────────────────────────────
const section7 = [
  ...sectionHeading("7.  Assumptions & Constraints"),
  spacer(120),

  subHeading("7.1  Assumptions"),
  bullet("Users have access to a modern web browser (Chrome, Firefox, Edge, or Safari)."),
  bullet("The client provides accurate master data (clients, vendors, materials) during onboarding."),
  bullet("Internet connectivity is available at all times during system use."),
  bullet("User roles and permissions will be assigned by the Admin before staff onboarding."),
  bullet("GST rates and HSN codes will be configured by the client in the Settings module before invoicing begins."),

  spacer(80),
  subHeading("7.2  Constraints"),
  bullet("The system is web-based only — no native mobile application is included in scope."),
  bullet("All data is stored in the cloud (Replit-managed PostgreSQL) — on-premises deployment is not included."),
  bullet("The system is single-currency per client record — multi-currency ledger consolidation is out of scope."),
  bullet("File uploads (artworks) are stored in the database — external CDN storage is not included."),

  new Paragraph({ children: [new PageBreak()] }),
];

// ────────────────────────────────────────────────────────────────────────────
// SECTION 8 — Sign-off
// ────────────────────────────────────────────────────────────────────────────
const section8 = [
  ...sectionHeading("8.  Approval & Sign-off"),
  spacer(200),

  body("By signing below, the parties confirm that this Scope Document accurately represents the agreed deliverables for the ZARI ERP project."),
  spacer(200),

  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [
        new TableCell({
          children: [
            para(bold("Client Representative", 22, GOLD)),
            spacer(400),
            para(t("Name: ___________________________")),
            spacer(80),
            para(t("Designation: ____________________")),
            spacer(80),
            para(t("Date: ___________________________")),
            spacer(80),
            para(t("Signature: ______________________")),
          ],
          width: { size: 50, type: WidthType.PERCENTAGE },
          margins: { top: 160, bottom: 160, left: 240, right: 240 },
          shading: { type: ShadingType.SOLID, color: GOLD_L, fill: GOLD_L },
        }),
        new TableCell({
          children: [
            para(bold("Development Team", 22, DARK)),
            spacer(400),
            para(t("Name: ___________________________")),
            spacer(80),
            para(t("Designation: ____________________")),
            spacer(80),
            para(t("Date: ___________________________")),
            spacer(80),
            para(t("Signature: ______________________")),
          ],
          width: { size: 50, type: WidthType.PERCENTAGE },
          margins: { top: 160, bottom: 160, left: 240, right: 240 },
        }),
      ]}),
    ],
  }),

  spacer(400),
  new Paragraph({
    children: [
      new TextRun({ text: "ZARI ERP — Confidential  ·  Version 1.0  ·  April 2026", font: "Calibri", size: 18, color: GRAY, italics: true }),
    ],
    alignment: AlignmentType.CENTER,
  }),
];

// ────────────────────────────────────────────────────────────────────────────
// Assemble Document
// ────────────────────────────────────────────────────────────────────────────
const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullet-list",
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: convertInchesToTwip(0.25), hanging: convertInchesToTwip(0.25) } } } },
          { level: 1, format: LevelFormat.BULLET, text: "◦", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) } } } },
        ],
      },
    ],
  },
  styles: {
    default: {
      document: {
        run: { font: "Calibri", size: 22, color: DARK },
      },
    },
  },
  sections: [
    {
      properties: {
        page: {
          margin: { top: convertInchesToTwip(1), bottom: convertInchesToTwip(1), left: convertInchesToTwip(1.25), right: convertInchesToTwip(1.25) },
        },
      },
      children: [
        ...titlePage,
        ...section1,
        ...section2,
        ...section3,
        ...section4,
        ...section5,
        ...section6,
        ...section7,
        ...section8,
      ],
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
writeFileSync("ZARI_ERP_Scope_Document.docx", buffer);
console.log("✓ Generated: ZARI_ERP_Scope_Document.docx");
