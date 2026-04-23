import { createWriteStream } from "fs";

const { default: PDFDocument } = await import("pdfkit");

// ── Colours ──────────────────────────────────────────────────────────────────
const GOLD   = "#C6AF4B";
const GOLD_L = "#FDF8E7";
const DARK   = "#1C1C1C";
const GRAY   = "#6B7280";
const MID    = "#374151";
const WHITE  = "#FFFFFF";
const GREEN  = "#166534";
const GREEN_L= "#DCFCE7";

// ── Setup ────────────────────────────────────────────────────────────────────
const doc = new PDFDocument({
  size:   "A4",
  margin: 0,
  info: {
    Title:   "ZARI ERP — Detailed Project Scope Document v2.0",
    Author:  "ZARI Embroideries",
    Subject: "Project Scope",
  },
});

const OUT = "ZARI_ERP_Scope_Document_v2.pdf";
const stream = createWriteStream(OUT);
doc.pipe(stream);

// ── Layout constants ─────────────────────────────────────────────────────────
const PW = 595.28;          // A4 page width
const PH = 841.89;          // A4 page height
const ML = 52;              // left margin
const MR = 52;              // right margin
const MT = 50;              // top margin
const CW = PW - ML - MR;   // content width  ≈ 491

let y = MT;   // current Y cursor

// ── Helpers ──────────────────────────────────────────────────────────────────

function addPage() {
  doc.addPage({ size: "A4", margin: 0 });
  y = MT;
  // footer
  doc.font("Helvetica").fontSize(7).fillColor(GRAY)
     .text("ZARI ERP  ·  Detailed Project Scope Document  ·  Version 2.0  ·  April 2026  ·  Confidential",
           ML, PH - 28, { width: CW, align: "center" });
}

function ensureSpace(need) {
  if (y + need > PH - 55) addPage();
}

function space(n = 10) { y += n; }

/** Gold section banner */
function banner(text) {
  ensureSpace(34);
  doc.rect(ML - 6, y, CW + 12, 28).fill(GOLD);
  doc.font("Helvetica-Bold").fontSize(13).fillColor(WHITE)
     .text(text, ML + 6, y + 8, { width: CW, align: "left" });
  y += 34;
}

/** Gold-underlined sub-heading */
function h2(text) {
  ensureSpace(28);
  space(18);
  doc.font("Helvetica-Bold").fontSize(11.5).fillColor(GOLD)
     .text(text, ML, y, { width: CW });
  y += doc.currentLineHeight() + 2;
  doc.moveTo(ML, y).lineTo(ML + CW, y).strokeColor(GOLD).lineWidth(0.8).stroke();
  y += 6;
}

/** Bold dark subsection heading */
function h3(text) {
  ensureSpace(22);
  space(12);
  doc.font("Helvetica-Bold").fontSize(10.5).fillColor(MID)
     .text(text, ML, y, { width: CW });
  y += doc.currentLineHeight() + 4;
}

/** Small gold label */
function h4(text) {
  ensureSpace(18);
  space(10);
  doc.font("Helvetica-Bold").fontSize(10).fillColor(GOLD)
     .text(text, ML, y, { width: CW });
  y += doc.currentLineHeight() + 3;
}

/** Body text */
function body(text) {
  ensureSpace(16);
  doc.font("Helvetica").fontSize(9.5).fillColor(DARK)
     .text(text, ML, y, { width: CW });
  y += doc.currentLineHeight(true) + 4;
}

/** Bullet point */
function bull(text, level = 0) {
  const indent = ML + (level * 14);
  const w = CW - (level * 14);
  ensureSpace(14);
  doc.font("Helvetica").fontSize(9).fillColor(GOLD)
     .text("•", indent, y, { width: 10 });
  doc.font("Helvetica").fontSize(9).fillColor(DARK)
     .text(text, indent + 12, y, { width: w - 12 });
  const h = doc.heightOfString(text, { width: w - 12, font: "Helvetica", size: 9 });
  y += Math.max(h, 11) + 3;
}

/** Numbered workflow step */
function step(n, text) {
  ensureSpace(14);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(GOLD)
     .text(`${n}.`, ML + 8, y, { width: 16 });
  doc.font("Helvetica").fontSize(9).fillColor(DARK)
     .text(text, ML + 26, y, { width: CW - 26 });
  const h = doc.heightOfString(text, { width: CW - 26, font: "Helvetica", size: 9 });
  y += Math.max(h, 11) + 4;
}

/** Status flow chips */
function statusFlow(statuses) {
  ensureSpace(20);
  space(6);
  let x = ML;
  const chipH = 16;
  for (let i = 0; i < statuses.length; i++) {
    const s   = statuses[i];
    const tw  = doc.widthOfString(s, { font: "Helvetica-Bold", size: 8 });
    const cw  = tw + 10;
    // wrap if needed
    if (x + cw > ML + CW - 20) { x = ML; y += chipH + 4; }
    doc.rect(x, y, cw, chipH).fill(GOLD);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(WHITE)
       .text(s, x + 5, y + 4, { width: cw - 10, align: "center" });
    x += cw;
    if (i < statuses.length - 1) {
      doc.font("Helvetica").fontSize(9).fillColor(GRAY)
         .text(" → ", x, y + 3, { width: 18 });
      x += 20;
    }
  }
  y += chipH + 8;
}

/** Simple 2-col info table */
function infoTable(rows) {
  ensureSpace(rows.length * 22 + 4);
  space(6);
  const col1 = CW * 0.33;
  const col2 = CW * 0.67;
  rows.forEach(([label, value], i) => {
    ensureSpace(22);
    const bg = i % 2 === 0 ? GOLD_L : "#F9FAFB";
    doc.rect(ML, y, col1, 20).fill(bg);
    doc.rect(ML + col1, y, col2, 20).fill(WHITE);
    doc.rect(ML, y, CW, 20).stroke("#E5E7EB").lineWidth(0.4);
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(DARK)
       .text(label, ML + 5, y + 6, { width: col1 - 8 });
    doc.font("Helvetica").fontSize(8.5).fillColor(DARK)
       .text(value, ML + col1 + 5, y + 6, { width: col2 - 8 });
    y += 20;
  });
  space(6);
}

/** Flex column-width table */
function table(headers, colWidths, rows) {
  ensureSpace(24);
  space(6);
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  const scaledW = colWidths.map(w => (w / totalW) * CW);

  // Header row
  let x = ML;
  scaledW.forEach((cw, ci) => {
    doc.rect(x, y, cw, 20).fill(GOLD);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(WHITE)
       .text(headers[ci], x + 4, y + 6, { width: cw - 8, align: "left" });
    x += cw;
  });
  y += 20;

  rows.forEach((row, ri) => {
    // Estimate row height first
    const rowH = Math.max(
      ...row.map((cell, ci) => {
        const h = doc.heightOfString(String(cell.text ?? cell), {
          width: scaledW[ci] - 8, font: "Helvetica", size: 8.5,
        });
        return h + 10;
      }),
      20
    );
    ensureSpace(rowH);

    x = ML;
    row.forEach((cell, ci) => {
      const text    = typeof cell === "object" ? cell.text  : cell;
      const bold    = typeof cell === "object" ? cell.bold  : false;
      const gold    = typeof cell === "object" ? cell.gold  : false;
      const bg      = ri % 2 === 0
        ? (ci === 0 && bold ? GOLD_L : WHITE)
        : (ci === 0 && bold ? "#F0EDD6" : "#F9FAFB");
      const color   = gold ? GOLD : (bold ? MID : DARK);
      doc.rect(x, y, scaledW[ci], rowH).fill(bg);
      doc.rect(x, y, scaledW[ci], rowH).stroke("#E5E7EB").lineWidth(0.3);
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8.5).fillColor(color)
         .text(String(text), x + 4, y + 5, { width: scaledW[ci] - 8 });
      x += scaledW[ci];
    });
    y += rowH;
  });
  space(8);
}

// ── Cover page ────────────────────────────────────────────────────────────────
doc.rect(0, 0, PW, PH).fill("#0D0D0D");

// gold stripe
doc.rect(0, PH / 2 - 90, PW, 180).fill(GOLD);

// Title
doc.font("Helvetica-Bold").fontSize(52).fillColor("#0D0D0D")
   .text("ZARI ERP", 0, PH / 2 - 72, { width: PW, align: "center" });
doc.font("Helvetica").fontSize(16).fillColor("#0D0D0D")
   .text("Enterprise Resource Planning System", 0, PH / 2 - 14, { width: PW, align: "center" });
doc.font("Helvetica-Bold").fontSize(20).fillColor("#0D0D0D")
   .text("DETAILED PROJECT SCOPE DOCUMENT", 0, PH / 2 + 14, { width: PW, align: "center" });
doc.font("Helvetica").fontSize(11).fillColor("#0D0D0D")
   .text("Zari Embroideries  ·  All Modules, Submodules, Workflows & Features", 0, PH / 2 + 44, { width: PW, align: "center" });

// bottom metadata
doc.font("Helvetica").fontSize(10).fillColor(GRAY)
   .text("Version 2.0  ·  April 2026  ·  Confidential", 0, PH - 60, { width: PW, align: "center" });

addPage();

// ── SECTION 1: Project Overview ───────────────────────────────────────────────
banner("1.  Project Overview");
h2("1.1  Background & Context");
body("Zari Embroideries is a premium embroidery manufacturer and exporter supplying high-fashion brands across India and internationally. Prior to ZARI ERP, the business tracked its complex operational pipeline — swatch sampling, style production, inventory procurement, client invoicing, and logistics — across a fragmented mix of spreadsheets, WhatsApp messages, paper records, and ad-hoc tools.");
body("ZARI ERP was purpose-built to unify every business function into a single, always-on web application, giving management, operations, and accounts teams a real-time, shared view of the entire business.");

h2("1.2  Project Identity");
infoTable([
  ["Project Name",       "ZARI ERP — Enterprise Resource Planning System"],
  ["Client",             "Zari Embroideries"],
  ["Project Type",       "Custom Full-Stack Web Application (SaaS)"],
  ["Version",            "1.0 — Production Release (April 2026)"],
  ["Document Version",   "2.0 — Detailed Scope (April 2026)"],
  ["Document Status",    "Final — For Client & Internal Team Reference"],
  ["Audience",           "Management, Operations Team, Accounts Team, Development Team"],
  ["Deployment",         "Replit Cloud — Always-on managed hosting"],
]);

h2("1.3  Core Objectives");
bull("Centralise all order management — swatch sampling, style production, and quotations — in one platform.");
bull("Provide real-time inventory visibility: fabrics, materials, packaging, reservations, and valuations.");
bull("Automate financial workflows: GST invoicing, payment recording, vendor bill tracking, and account reconciliation.");
bull("Streamline logistics with digital packing lists, package-level item assignment, and centralised shipment tracking.");
bull("Deliver actionable dashboards and exportable reports for immediate management decision-making.");
bull("Enforce structured workflows with status gates, role-based access, and audit-ready activity logs.");
bull("Eliminate manual data entry errors, reduce order-processing time, and provide a single source of truth.");

addPage();

// ── SECTION 2: Architecture ───────────────────────────────────────────────────
banner("2.  System Architecture & Technology Stack");
h2("2.1  Technology Stack");
table(
  ["Layer", "Technology", "Role in System"],
  [30, 35, 35],
  [
    [{ text: "Frontend Framework", bold: true }, "React 18 + Vite", "SPA UI framework with fast HMR build tooling"],
    [{ text: "Language", bold: true }, "TypeScript (strict)", "Type-safe frontend and backend code"],
    [{ text: "Styling", bold: true }, "Tailwind CSS", "Utility-first CSS; brand theme colour #C6AF4B"],
    [{ text: "Client Routing", bold: true }, "Wouter", "Lightweight client-side page routing"],
    [{ text: "Data Fetching", bold: true }, "React Query (TanStack)", "Server state, caching, and background refetch"],
    [{ text: "Charts", bold: true }, "Recharts", "Bar, donut/pie, stacked charts on dashboards"],
    [{ text: "Backend", bold: true }, "Node.js + Express", "REST API server — all business logic"],
    [{ text: "Database", bold: true }, "PostgreSQL + Raw SQL", "Relational store with optimised hand-written queries"],
    [{ text: "Authentication", bold: true }, "JWT + bcrypt", "Stateless token auth; secure password hashing"],
    [{ text: "File Storage", bold: true }, "Database BLOB (Base64)", "Artwork images stored directly in PostgreSQL"],
    [{ text: "Monorepo", bold: true }, "pnpm Workspaces", "Frontend + API as separate packages in one repo"],
    [{ text: "Hosting", bold: true }, "Replit Cloud", "Managed always-on environment with PostgreSQL"],
  ]
);

h2("2.2  Architecture Overview");
bull("Monorepo with two primary packages: React/Vite frontend and Express API server.");
bull("All browser API calls are routed to the Express server via path-based proxy. All routes prefixed /api.");
bull("Express API exposes 30+ route files, each responsible for a specific domain.");
bull("PostgreSQL schema auto-migrated on every server start using raw SQL CREATE TABLE IF NOT EXISTS.");
bull("JWT tokens issued at login, stored client-side, sent as Bearer token on every API request.");
bull("File uploads (artwork images, vendor invoices) stored as Base64 in PostgreSQL; served back as data URIs.");

h2("2.3  User Roles & Access Control");
table(
  ["Role", "Access Level", "Capabilities"],
  [22, 28, 50],
  [
    [{ text: "Admin", bold: true, gold: true }, "Full system access", "User management, all settings, all modules, approvals, financial records, and audit logs."],
    [{ text: "Operations Staff", bold: true }, "Orders, inventory, logistics", "Create and manage swatch/style orders, inventory receipts, packing lists, and shipments."],
    [{ text: "Accounts Staff", bold: true }, "Finance module", "Invoices, payments, vendor bills, ledger, credit notes, and accounts dashboard."],
  ]
);
bull("User invitation flow: Admin sends email invite → user sets password via token link → role assigned.");
bull("Deactivation: Admin can toggle any user inactive — they lose all API access immediately.");
bull("Activity Log: All significant actions recorded with timestamp and user identity in Settings → Activity Logs.");

addPage();

// ── SECTION 3: Dashboard ──────────────────────────────────────────────────────
banner("3.  Dashboard Module");
h2("3.1  Overview");
body("The Dashboard is the default landing page after login. It provides a real-time snapshot of the entire business — orders, artworks, clients, revenue trends, and pipeline statuses.");

h2("3.2  KPI Cards");
table(
  ["Card", "Metric Shown", "Additional Data"],
  [25, 40, 35],
  [
    [{ text: "Style Orders", bold: true, gold: true }, "Total active style production orders", "Count issued this month; % change vs. last month"],
    [{ text: "Swatch Orders", bold: true }, "Total active swatch sampling orders", "Count issued this month; % change vs. last month"],
    [{ text: "Artworks", bold: true, gold: true }, "Total artwork files across all orders", "Count added this month; note if no prior data"],
    [{ text: "Active Clients", bold: true }, "Total clients with active orders", "Count active this month; % change vs. last month"],
  ]
);
bull("Month-on-month: green upward arrow (growth) or red downward arrow (decline).");
bull("Top-right header: Last Login timestamp, Active Orders count, logged-in user name/avatar.");
bull("Refresh button re-fetches all KPI and chart data live.");

h2("3.3  Charts & Visualisations");
h4("Order Trend — Monthly Orders (Last 6 Months)");
bull("Grouped bar chart: Style Orders (dark) and Swatch Orders (gold).");
bull("X-axis: last 6 calendar months. Y-axis: order count. Toggle between 3-month and 6-month views.");
h4("Status Tracker — Current Pipeline");
bull("Two donut charts: Style Pipeline and Swatch Pipeline with per-status count legends.");
bull("Style statuses: Completed, Draft, In Production, Issued, In Review, Pending Approval, Rejected, Cancelled.");
bull("Swatch statuses: Completed, Draft, In Sampling, Issued, In Artwork, Pending Approval, Rejected, Cancelled.");

addPage();

// ── SECTION 4: Masters ────────────────────────────────────────────────────────
banner("4.  Masters Module");
body("Masters are the foundational reference data that all other modules depend on. Must be configured before creating orders, invoices, or procurement documents.");

h2("4.1  Client Master");
body("Manages all buyer/client records. Referenced in style orders, swatch orders, invoices, packing lists, and quotations.");
h4("Form Fields");
table(
  ["Field", "Type", "Notes"],
  [32, 22, 46],
  [
    [{ text: "Brand / Client Name", bold: true, gold: true }, "Text (required)", "Primary identifier shown across all modules"],
    [{ text: "Client Code", bold: true }, "Auto-generated", "Format: CLI-XXX — system assigned, unique"],
    [{ text: "Contact Person", bold: true, gold: true }, "Text", "Primary contact name"],
    [{ text: "Email", bold: true }, "Email", "Used for invoices and communications"],
    [{ text: "Contact No.", bold: true, gold: true }, "Phone + country picker", "International phone input"],
    [{ text: "Country", bold: true }, "Dropdown", "Used to determine IGST vs CGST+SGST"],
    [{ text: "Invoice Currency", bold: true, gold: true }, "Dropdown", "INR, USD, EUR, GBP, AED, etc."],
    [{ text: "GST / GSTIN", bold: true }, "Text", "Required for Indian GST invoicing"],
    [{ text: "Billing Address", bold: true, gold: true }, "Multi-line text", "Used on invoice and packing list headers"],
    [{ text: "Delivery Addresses", bold: true }, "Up to 5 addresses", "Each with label, city, state, pin, country"],
    [{ text: "Status", bold: true, gold: true }, "Toggle", "Active / Inactive — inactive hides from order forms"],
  ]
);
h4("List View: Search by name/code/contact · Filter by Status · Export to Excel (.xlsx)");

h2("4.2  Vendor Master");
body("Manages all supplier records. Used in purchase orders, goods receipts, vendor bills, shipping, and ledgers.");
bull("Brand / Vendor Name (required), Vendor Code (auto: VND-XXX), Contact Person, Email, Phone.");
bull("Country, GST / GSTIN, PAN Number.");
bull("Billing Address + up to 5 delivery addresses.");
bull("Bank Account Details: Bank Name, Account Number, IFSC, Branch, Account Type — up to 3 accounts.");
bull("Attachments: vendor documents (agreements, certificates). Status: Active / Inactive.");

h2("4.3  Materials Master");
body("Stores raw materials (threads, beads, trims, zari wire, packaging) used in costing sheets and inventory.");
bull("Item Name, Item Code (auto), Item Type (Addable Select — user can add custom types on the fly).");
bull("Quality/Grade, Colour (colour picker), Size/Specification, Unit of Measure.");
bull("Unit Price, HSN Code, Default Vendor, Minimum Reorder Quantity.");
bull("Images: up to 5 product images with upload and drag-to-reorder. Status: Active / Inactive.");

h2("4.4  Fabric Master");
bull("Fabric Name, Code (auto), Content (e.g. 100% Cotton), GSM, Width (cm), Colour.");
bull("Unit Price, HSN Code, Default Vendor. Images: up to 5 fabric swatch images. Status: Active / Inactive.");

h2("4.5  Style Master  |  4.6  Categories  |  4.7  HSN Codes");
bull("Style Master: Style Number, Name, Description, Client, Place of Issue (In/Out-house), Target Shipping Date.");
bull("Categories: configurable product categories and sub-categories for inventory and reporting.");
bull("HSN Codes: Code, GST Rate (%), Government Description, Remarks. Linked to invoice line items for auto GST.");

addPage();

// ── SECTION 5: Swatch Orders ──────────────────────────────────────────────────
banner("5.  Swatch Orders Module");
body("Swatch Orders manage the embroidery sampling lifecycle — small production runs made before full-scale manufacture.");

h2("5.1  Status Workflow");
statusFlow(["Draft", "Issued", "In Sampling", "In Artwork", "Pending Approval", "Completed", "Rejected", "Cancelled"]);
bull("Draft: order created, not yet actioned.");
bull("Issued: formally released to sampling team.");
bull("In Sampling: physical sampling in progress.");
bull("In Artwork: artwork creation / revision underway.");
bull("Pending Approval: sent to client for sign-off.");
bull("Completed / Rejected / Cancelled: terminal states.");

h2("5.2  List View");
bull("Card grid (4-up) showing: order code, client, due date, quantity, fabric, priority, chargeable flag, status.");
bull("Toggle between card grid and table/list view.");
bull("Status tabs, Priority filter, Chargeable filter, and full-text search.");

h2("5.3  Order Detail — 9 Tabs");
h3("Tab 1: Basic Info");
bull("Swatch Name (req.), Code (ZSW-XXXX auto), Client, Order Date, Delivery Date, Quantity, Fabric Type.");
bull("Priority (Low/Medium/High/Urgent), Chargeable toggle, Season, Colorway, Sample Size.");
bull("Issued To, Department (Addable Select), Actual Start/End Date-Time, Delay Reason, Approval Date.");
bull("Description, Internal Notes, Client Instructions.");
h3("Tab 2: References");
bull("Style/Swatch References with Remark field. Ref Docs and Ref Images via drag-and-drop upload.");
h3("Tab 3: Artworks");
bull("Add Artwork: Name, Code (auto), Date, Total Cost. WIP Images & Final Images with lightbox gallery.");
bull("Artwork Status: Pending → In Review → Approved / Revision Required / Rejected.");
h3("Tab 4: Client Link");
bull("Token-secured client-facing read-only URL — client can view status and artworks without an ERP login.");
h3("Tab 5: Estimate");
bull("Quick cost estimation: Sampling, Material, Artisan, Outsource costs.");
h3("Tab 6: Costing (Full BOM)");
bull("BOM Line Items: material/fabric, current stock, avg weighted price, PO rate, required/reserved/consumed qty and totals.");
bull("Linked POs: see all purchase orders for this swatch. Create new PO from within this tab.");
bull("Linked PRs: goods receipts for this order's materials.");
bull("Artisan Timesheets: Artisan, Shift Type (Regular/Night/Sunday/Overtime), Hours, Rate, Total.");
bull("Outsource Jobs: Vendor, HSN, GST%, Amount. Custom Charges: Name, Amount, Notes.");
h3("Tab 7: Cost Sheet");
bull("Consolidated printable report: Material, Labour, Outsource, Custom Charges, Grand Total. PDF download.");
h3("Tab 8: Shipping");
bull("Vendor, Tracking No., URL, Weight (kg), Rate/KG, Calculated Cost, Manual Override, Final Cost.");
bull("Status: Pending/Dispatched/In Transit/Delivered/Returned/Cancelled. Dates: Shipped/EDD/Actual Delivery.");
bull("Inline shipment creation — create shipment without leaving the order form.");
h3("Tab 9: Invoices");
bull("Line Items: Description, Category (Material/Labour/Outsource/Custom/Other), Qty, Unit Price, Total.");
bull("Re-import from Cost Sheet (auto-populate), Discount (flat/%), CGST/SGST/IGST rates, Grand Total.");
bull("Client GSTIN, Billing Address, Bank Details, Payment Terms. Status: Draft/Sent/Paid/Cancelled.");

addPage();

// ── SECTION 6: Style Orders ───────────────────────────────────────────────────
banner("6.  Style Orders Module");
body("Style Orders are the primary production orders — covering full lifecycle from briefing through artworks, costing, invoicing, and shipment.");

h2("6.1  Status Workflow");
statusFlow(["Draft", "Issued", "In Production", "In Review", "Pending Approval", "Completed", "Rejected", "Cancelled"]);

h2("6.2  Order Detail — 10 Tabs");
body("Style Orders have all 9 Swatch Order tabs plus an additional Products tab (Tab 3):");
h3("Tab 3: Products (unique to Style Orders)");
bull("Define specific garment/product variants: Product Name, SKU, Size, Colour, Quantity.");
bull("Each product can have its own artworks (grouped per product in Tab 4: Artworks).");
bull("Products are referenced when assigning items to packing list packages.");
h3("Tab 10: Invoices");
bull("Same invoice workflow as Swatch Orders. Invoices created here also appear in Accounts → Invoices.");

addPage();

// ── SECTION 7: Quotations ─────────────────────────────────────────────────────
banner("7.  Quotations Module");
body("Formal cost estimates prepared for clients before a Style or Swatch Order is confirmed. Convertible to orders.");

h2("7.1  Workflow");
step(1, "Create quotation — select client (auto-fills contact, address, currency, state).");
step(2, "Add Designs — line items with HSN code, remarks, and reference image (Base64 upload).");
step(3, "Add Custom Charges — labour, material, or other charges with unit, qty, and price.");
step(4, "Configure taxes — GST type (CGST+SGST or IGST), GST rate (%), shipping rate per kg.");
step(5, "Save quotation. Generate PDF — choose from multiple cover page templates.");
step(6, "Share PDF with client externally (via email). Convert to Swatch or Style Order on approval.");

h2("7.2  Form Fields");
bull("Requirement Summary, Estimated Weight (kg), Internal Notes, Client Notes.");
bull("Designs (repeatable): Design Name, HSN Code, Remarks, Reference Image.");
bull("Custom Charges (repeatable): Charge Name, HSN, Unit, Quantity, Unit Price.");
bull("Tax: GST Type, GST Rate (%), Shipping Rate per KG.");

h2("7.3  PDF Generation");
bull("Multiple cover page templates selectable at generation time.");
bull("PDF includes: Zari letterhead, client details, design list with images, charges, tax summary, and total.");

addPage();

// ── SECTION 8: Inventory ──────────────────────────────────────────────────────
banner("8.  Inventory & Stock Module");
body("Real-time visibility of all raw materials, fabrics, and packaging — including order reservations and procurement pipeline.");

h2("8.1  Inventory Dashboard");
h4("Filters: Category · Sub-Category · Date Range (From/To)");
table(
  ["Stock Card", "What It Shows"],
  [35, 65],
  [
    [{ text: "Total Items", bold: true, gold: true }, "Total distinct inventory items in the system"],
    [{ text: "In Stock", bold: true }, "Items with quantity above minimum reorder level"],
    [{ text: "Low Stock", bold: true, gold: true }, "Items at or below minimum reorder quantity (alert state)"],
    [{ text: "Out of Stock", bold: true }, "Items with zero available quantity"],
    [{ text: "Total Stock Value", bold: true, gold: true }, "Sum of (current qty × weighted average price) across all items"],
  ]
);
h4("Procurement Snapshot: Active POs · Line Items in POs · Pending Quantity · Receipts count");
h4("Charts: Stock Status split donut (In/Low/Out) · Category split donut (Fabric/Material/Packaging) · Reservations panel");

h2("8.2  Item Stock List");
bull("Full list: Item Code, Name, Category, Sub-Category, Unit, Current Qty, Reserved Qty, Available Qty, Avg Price, Value.");
bull("Click any item: full transaction ledger, reservations by order, reorder history.");

h2("8.3  Stock Ledger  |  8.4  Low Stock Alerts  |  8.5  Stock Adjustments");
bull("Stock Ledger: every IN/OUT event with date, reference order/PO, quantity, and running balance.");
bull("Low Stock Alerts: items at or below minimum — shows shortfall, suggested PO qty, direct link to create PO.");
bull("Stock Adjustments: Damage / Lost / Surplus / Bonus / Correction — all logged in ledger for audit trail.");

addPage();

// ── SECTION 9: Procurement ────────────────────────────────────────────────────
banner("9.  Procurement Module");
body("Manages the sourcing of inventory — from raising Purchase Orders to recording Goods Receipts that update stock.");

h2("9.1  Purchase Orders (PO)");
h4("Status Workflow");
statusFlow(["Draft", "Approved", "Partially Received", "Closed", "Cancelled"]);
h4("PO Header Fields");
bull("PO Number (auto: PO-YYYY-XXXX), Vendor, PO Date, Expected Delivery Date.");
bull("Reference Type: Inventory (standalone), Swatch Order, or Style Order.");
bull("Reference ID (linked order), Include GST toggle, Internal Notes.");
h4("PO Line Items (repeatable)");
bull("Item Category, Inventory Item (Searchable Select), Item Name, Code, Unit of Measure.");
bull("Ordered Qty, Target Price/Unit, Total Price (auto), HSN Code, GST Rate (%), Item Image, Remarks.");
h4("Actions: Save Draft · Approve · Download PDF · Create Receipt · Cancel");

h2("9.2  Purchase Receipts / GRN");
h4("Status Workflow");
statusFlow(["Draft (Open)", "Received (Confirmed)", "Cancelled"]);
h4("GRN Fields");
bull("PR Number (auto), Linked PO, Vendor (auto-filled), Received Date.");
bull("Vendor Invoice Number, Invoice Date, Invoice Amount, Invoice File upload.");
h4("Line Items: Linked PO Item · Item Name/Code · Qty Ordered · Qty Received · Unit Price · Warehouse · Remarks");
h4("Actions: Save Draft · Confirm & Update Inventory · Edit · Cancel");

addPage();

// ── SECTION 10: Accounts ──────────────────────────────────────────────────────
banner("10.  Accounts & Finance Module");
body("Financial hub for unified tracking of all income (sales invoices, client payments) and expenditure (vendor bills, purchase payments).");

h2("10.1  Accounts Dashboard");
bull("Global filters: Date Range (From/To), Vendor, Client — all applied simultaneously across all figures.");
bull("Sales Summary: Total Invoiced, Total Received (+ % collected), Pending Receivables (+ % outstanding).");
bull("Purchase Summary: Total Vendor Bills, Paid to Vendors, Pending Payables.");
bull("Charts: Monthly Sales vs. Purchases bar chart · Top 5 Pending Clients · Top 5 Pending Vendors.");

h2("10.2  Invoices");
h4("Invoice Types: Tax Invoice · Proforma Invoice · Credit Note");
h4("Directions: Outgoing (sales to clients) · Incoming (captures vendor bills as payable reference)");
h4("Key Fields");
bull("Invoice No. (auto: INV-YYYY-XXXXX), Date, Due Date, Client/Vendor, Reference Order.");
bull("Currency, Exchange Rate (foreign currency support).");
bull("Line Items: Description, Category, HSN, Qty, Unit, Rate, Amount.");
bull("Discount (flat/%), CGST/SGST/IGST rates, Grand Total (auto), Tax Breakdown.");
bull("Client GSTIN, Billing Address, Place of Supply, Payment Terms, Bank Details.");
h4("Actions: Draft · Sent · Paid · Cancel · Record Payment · Print/PDF · Re-import from Cost Sheet");
h4("List View Summary Cards: Total Invoice Value · Amount Received · Amount Pending");
h4("Filters: Direction · Type · Status · Order Type · Search (invoice no., client, ref order)");

h2("10.3  Vendor Bills & Payments");
bull("Unified view of liabilities from: Purchase Receipts, Costing Outsource, Artisan Labour, Shipping, Other Expenses.");
bull("Record Payment: Amount, Date, Mode (Bank/UPI/Cash/Cheque/DD), UTR/Reference. Supports partial payments.");
bull("Status Tabs: Unpaid · Partially Paid · Paid · Pending. Filter by Category/Department.");

h2("10.4  Ledgers  |  10.5  Credit & Debit Notes  |  10.6  Other Expenses");
bull("Vendor & Client Ledgers: full transaction history with running balance. Export as PDF or CSV statement.");
bull("Credit/Debit Notes: adjust outstanding balances — linked to original invoice for audit trail.");
bull("Other Expenses: electricity, rent, office supplies, maintenance — shown in Purchases summary.");

addPage();

// ── SECTION 11: Logistics ─────────────────────────────────────────────────────
banner("11.  Logistics Module");
body("Manages the physical dispatch of goods — packing items into packages, assigning shipments, and tracking delivery.");

h2("11.1  Packing Lists");
h4("Status Workflow");
statusFlow(["Draft", "Ready", "Shipped"]);
h4("Packing List Header Fields");
bull("PL Number (auto: PL-YYYY-XXXX), Client, Delivery Address, Destination Country, Package Type.");
bull("Total Packages, Shipment (select existing or create new inline).");
h4("Packages Section (repeatable per package)");
bull("Package Number (auto-incremented), Label/Mark, Dimensions (L × W × H cm), Net Weight, Gross Weight.");
bull("Items per package: Source Order (Swatch/Style), Product, Description, Quantity, Unit, Weight per Item.");
h4("Shipment Creation (inline)");
bull("Fill: Shipping Vendor, Tracking Number, URL, Weight, Cost, Status, Ship Date, EDD.");
bull("Shipment only saved to DB when Save Packing List is clicked — no orphaned records if cancelled.");
h4("Actions: Save · Print/PDF for physical inclusion with shipment");

h2("11.2  Shipping — Centralised Shipment Tracker");
h4("Status Workflow");
statusFlow(["Draft", "Dispatched", "In Transit", "Delivered", "Returned", "Cancelled"]);
h4("Shipment Fields");
bull("Shipment Number, Reference Type (Swatch/Style/PackingList), Reference Order ID, Client.");
bull("Shipping Vendor, Tracking Number, Tracking URL (clickable), Weight (kg), Cost (₹).");
bull("Shipment Date, Expected Delivery Date (EDD), Actual Delivery Date, Status, Notes.");
h4("List Filters: Status · Type (Swatch/Style/PackingList) · Vendor · Ship Date · Search (tracking no., ref, client)");

addPage();

// ── SECTION 12: Reports ───────────────────────────────────────────────────────
banner("12.  Reports Module");
body("Exportable, filterable data views across all ERP modules for management analysis and GST compliance.");
table(
  ["Report Name", "Data Covered", "Key Filters"],
  [28, 42, 30],
  [
    [{ text: "Stock Summary", bold: true, gold: true }, "Stock levels, reserved qty, available qty, reorder alerts", "Category, Sub-Category, Status"],
    [{ text: "Stock Movement", bold: true }, "Every IN/OUT transaction with date, reference, running balance", "Item, Date Range, Movement Type"],
    [{ text: "Purchase Summary", bold: true, gold: true }, "PO vs PR vs Vendor Bill values per vendor with variance", "Vendor, Date Range, Status"],
    [{ text: "Invoice Summary", bold: true }, "Client-wise invoicing, collected, and pending amounts", "Client, Date Range, Status"],
    [{ text: "Vendor Ledger", bold: true, gold: true }, "Full transaction history per vendor — bills and payments", "Vendor, Date Range"],
    [{ text: "Client Ledger", bold: true }, "Full transaction history per client — invoices and receipts", "Client, Date Range"],
    [{ text: "Order Profitability", bold: true, gold: true }, "Revenue vs material+labour+shipping costs; gross margin per order", "Order Type, Client, Date Range"],
    [{ text: "Purchase vs Sales", bold: true }, "Aggregate P&L — total sales vs total purchases by period", "Date Range, Month/Year"],
    [{ text: "GST Summary", bold: true, gold: true }, "GST Collected vs GST Paid and Net GST Liability", "Financial Year, Month, GST Type"],
  ]
);
h4("Common Actions: Apply Filters · Export CSV · Pagination · Date preset shortcuts (This Month, Last Month, This Year)");

addPage();

// ── SECTION 13: Settings ──────────────────────────────────────────────────────
banner("13.  Settings & Administration");
body("Accessible from the user profile dropdown. Tabbed sections for profile, company config, financial settings, warehouses, templates, and audit logs.");
h2("Settings Tabs");
bull("Profile: Display Name, Profile Photo (upload/replace/remove), Phone. Change Password (current → new → confirm).");
bull("Currency: configure active currencies and exchange rates. INR is base/default.");
bull("Bank Details: company bank accounts (Name, Account No., IFSC, Branch, Type, UPI ID) — multiple accounts supported.");
bull("GST Settings: Company GSTIN, Legal Name, Place of Business (State), PAN Number, default GST rates.");
bull("Warehouses: Name, Address, City, State, PIN, Country — multiple warehouses; stock movements attributed per warehouse.");
bull("Invoice Templates: header (logo, name, address, GSTIN), footer (terms, signature line). Live preview before save.");
bull("Activity Logs: read-only timestamped audit log of all significant actions — Date/Time, User, Module, Action, Record ID.");
bull("User Management (Admin only): invite, edit roles, activate/deactivate, remove users.");

addPage();

// ── SECTION 14: User Manual ───────────────────────────────────────────────────
banner("14.  Built-in User Manual  (/help)");
bull("12 sections covering every module with left sidebar navigation and section search.");
bull("Annotated real screenshots with gold (#C6AF4B) callout highlights and numbered legends for 11 pages.");
bull("Step-by-step numbered workflows for all key operations.");
bull("Download options: Full Manual PDF · Current Section PDF · Scope Document DOCX + PDF.");
bull("Accessible from profile dropdown: User Manual (BookOpen icon).");

// ── SECTION 15: Out of Scope ──────────────────────────────────────────────────
banner("15.  Out of Scope");
bull("Native mobile application (iOS / Android).");
bull("Third-party accounting software integration (Tally, Zoho Books, QuickBooks, Busy).");
bull("E-commerce storefront or public customer-facing ordering portal.");
bull("Automated bank reconciliation via bank API feeds.");
bull("Multi-company / multi-branch ledger consolidation.");
bull("Production floor IoT or machine-level integration.");
bull("Automated GST filing or government portal (GSTN) submission.");
bull("Employee payroll management.");
bull("On-premises / self-hosted deployment — cloud-only at present.");

// ── SECTION 16: Assumptions & Constraints ────────────────────────────────────
h2(" ");
banner("16.  Assumptions & Constraints");
h2("16.1  Assumptions");
bull("All users have access to a modern browser (Chrome 110+, Firefox 110+, Edge 110+, Safari 16+).");
bull("Internet connectivity available continuously during system use.");
bull("Master data (clients, vendors, materials, HSN) provided by client during onboarding.");
bull("GST rates and GSTIN configured in Settings before any invoicing begins.");
bull("Admin role assigned to at least one person before staff onboarding.");
h2("16.2  Constraints");
bull("Web-only — no native mobile app in this version.");
bull("Single-currency per client record — no automatic multi-currency ledger roll-up.");
bull("Artwork files stored as Base64 in PostgreSQL — large files (>5MB) may slow upload.");
bull("PDF generation is client-side — depends on browser print capability.");
bull("No offline/PWA mode — internet connection required at all times.");

addPage();

// ── SECTION 17: Deliverables ──────────────────────────────────────────────────
banner("17.  Deliverables Summary");
table(
  ["#", "Deliverable", "Status"],
  [8, 72, 20],
  [
    [{ text: "1", bold: true, gold: true }, "Full-stack web application (ZARI ERP) — all 14 modules", { text: "Delivered", bold: true, gold: true }],
    [{ text: "2", bold: true }, "React + Vite frontend with Tailwind brand theme", { text: "Delivered", bold: true, gold: true }],
    [{ text: "3", bold: true, gold: true }, "Node.js + Express REST API — 30+ route files", { text: "Delivered", bold: true, gold: true }],
    [{ text: "4", bold: true }, "PostgreSQL database with auto-migration schema", { text: "Delivered", bold: true, gold: true }],
    [{ text: "5", bold: true, gold: true }, "JWT + bcrypt authentication and user management", { text: "Delivered", bold: true, gold: true }],
    [{ text: "6", bold: true }, "Real-time dashboards (Main + Accounts + Inventory)", { text: "Delivered", bold: true, gold: true }],
    [{ text: "7", bold: true, gold: true }, "GST-compliant invoicing with PDF preview", { text: "Delivered", bold: true, gold: true }],
    [{ text: "8", bold: true }, "Procurement module (PO + GRN)", { text: "Delivered", bold: true, gold: true }],
    [{ text: "9", bold: true, gold: true }, "Logistics module (Packing Lists + Shipping)", { text: "Delivered", bold: true, gold: true }],
    [{ text: "10", bold: true }, "Quotation module with PDF generation", { text: "Delivered", bold: true, gold: true }],
    [{ text: "11", bold: true, gold: true }, "Built-in User Manual with annotated screenshots", { text: "Delivered", bold: true, gold: true }],
    [{ text: "12", bold: true }, "Scope Document — DOCX + PDF", { text: "Delivered", bold: true, gold: true }],
  ]
);

// ── SECTION 18: Sign-off ──────────────────────────────────────────────────────
addPage();
banner("18.  Approval & Sign-off");
space(16);
body("By signing below, both parties confirm that this Detailed Scope Document accurately represents the agreed deliverables for the ZARI ERP project.");
space(30);

// Sign-off boxes
const boxY = y;
const boxW = (CW - 24) / 2;
// Left box
doc.rect(ML, boxY, boxW, 140).fill(GOLD_L).stroke(GOLD).lineWidth(0.8);
doc.font("Helvetica-Bold").fontSize(11).fillColor(GOLD)
   .text("Client Representative", ML + 10, boxY + 10, { width: boxW - 20 });
doc.font("Helvetica").fontSize(9).fillColor(DARK)
   .text("Name:  ______________________________", ML + 10, boxY + 36)
   .text("Designation:  ________________________", ML + 10, boxY + 58)
   .text("Date:  ________________________________", ML + 10, boxY + 80)
   .text("Signature:  ___________________________", ML + 10, boxY + 108);

// Right box
const rx = ML + boxW + 24;
doc.rect(rx, boxY, boxW, 140).fill("#F9FAFB").stroke("#E5E7EB").lineWidth(0.8);
doc.font("Helvetica-Bold").fontSize(11).fillColor(MID)
   .text("Development Team", rx + 10, boxY + 10, { width: boxW - 20 });
doc.font("Helvetica").fontSize(9).fillColor(DARK)
   .text("Name:  ______________________________", rx + 10, boxY + 36)
   .text("Designation:  ________________________", rx + 10, boxY + 58)
   .text("Date:  ________________________________", rx + 10, boxY + 80)
   .text("Signature:  ___________________________", rx + 10, boxY + 108);

y = boxY + 160;
space(30);
doc.font("Helvetica").fontSize(8).fillColor(GRAY)
   .text("ZARI ERP  ·  Detailed Project Scope Document  ·  Version 2.0  ·  April 2026  ·  Confidential", ML, y, { width: CW, align: "center" });

// ── Finalise ──────────────────────────────────────────────────────────────────
await new Promise((res, rej) => { stream.on("finish", res); stream.on("error", rej); doc.end(); });
console.log(`✓  Generated: ${OUT}`);
