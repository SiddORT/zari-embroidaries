import { useState, useRef } from "react";
import {
  BookOpen, LayoutDashboard, Users, ShoppingBag, Package, BarChart2,
  Truck, Settings, ChevronRight, Search, Printer, ArrowUp, Star,
  Zap, ClipboardList, Warehouse, ShoppingCart, FileText, CreditCard,
  AlertTriangle, RotateCcw, DollarSign, Receipt, UserCheck, HelpCircle,
  CheckCircle, Info, List, Box, Globe, Lock, Bell, Database, Tag,
  Layers, Hash, Scissors, Send, Eye, PenLine, Trash2, Plus, Download,
  LogIn, Home, ChevronDown, ArrowLeft,
} from "lucide-react";

const G = "#C6AF4B";

// ─── Screenshot with annotated callout highlights ───────────────────────────

interface Callout {
  n: number;
  label: string;
  top: number; left: number; width: number; height: number;
}

function ScreenshotCallout({ src, alt, callouts }: { src: string; alt: string; callouts: Callout[] }) {
  return (
    <div className="my-5 not-prose">
      <div className="relative w-full overflow-hidden rounded-xl border border-gray-200 shadow-md bg-gray-50">
        <img src={src} alt={alt} className="w-full block" style={{ display: "block" }} />
        {callouts.map(c => (
          <div
            key={c.n}
            style={{
              position: "absolute",
              top: `${c.top}%`, left: `${c.left}%`,
              width: `${c.width}%`, height: `${c.height}%`,
              border: `2px solid ${G}`,
              borderRadius: "5px",
              background: "rgba(198,175,75,0.10)",
              pointerEvents: "none",
            }}
          >
            <span style={{
              position: "absolute", top: "-13px", left: "6px",
              background: G, color: "#fff",
              fontSize: "10px", fontWeight: "800",
              padding: "1px 6px", borderRadius: "4px", lineHeight: "1.5",
              whiteSpace: "nowrap", boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
            }}>{c.n}</span>
          </div>
        ))}
      </div>
      {/* Legend */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {callouts.map(c => (
          <div key={c.n} className="flex items-start gap-2 px-2 py-1.5 rounded-lg bg-[#fdf8e7] border border-[#e8d68a]/50">
            <span className="h-5 w-5 rounded shrink-0 flex items-center justify-center text-[10px] font-black text-white mt-0.5" style={{ background: G }}>{c.n}</span>
            <span className="text-xs text-gray-700 leading-relaxed">{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface Section {
  id: string;
  icon: React.ElementType;
  label: string;
  subsections?: { id: string; label: string }[];
}

const SECTIONS: Section[] = [
  { id: "overview",      icon: BookOpen,      label: "Introduction" },
  { id: "login",         icon: LogIn,         label: "Getting Started" },
  { id: "dashboard",     icon: LayoutDashboard,label: "Dashboard" },
  { id: "masters",       icon: Database,      label: "Masters", subsections: [
    { id: "clients",           label: "Clients" },
    { id: "vendors",           label: "Vendors" },
    { id: "materials",         label: "Materials & Fabrics" },
    { id: "hsn",               label: "HSN Codes" },
    { id: "categories",        label: "Categories & Item Types" },
    { id: "packaging-masters", label: "Packaging Materials" },
    { id: "shipping-vendors",  label: "Shipping Vendors" },
  ]},
  { id: "swatch-orders", icon: Zap,           label: "Swatch Orders" },
  { id: "style-orders",  icon: Star,          label: "Style Orders" },
  { id: "quotations",    icon: FileText,      label: "Quotations" },
  { id: "accounts",      icon: DollarSign,    label: "Accounts & Finance", subsections: [
    { id: "invoices",     label: "Invoices" },
    { id: "payments",     label: "Payments" },
    { id: "cdn",          label: "Credit / Debit Notes" },
    { id: "vendor-ledger",label: "Vendor Ledgers" },
    { id: "purchases-accounts", label: "Purchases & Sales" },
    { id: "expenses",     label: "Other Expenses" },
  ]},
  { id: "inventory",     icon: Warehouse,     label: "Inventory", subsections: [
    { id: "inv-dashboard", label: "Inventory Dashboard" },
    { id: "stock-list",    label: "Item Stock List" },
    { id: "low-stock",     label: "Low Stock Alerts" },
    { id: "ledger",        label: "Stock Ledger" },
    { id: "reservations",  label: "Reservations" },
    { id: "adjustments",   label: "Stock Adjustments" },
  ]},
  { id: "procurement",   icon: ShoppingCart,  label: "Procurement", subsections: [
    { id: "purchase-orders",   label: "Purchase Orders" },
    { id: "purchase-receipts", label: "Purchase Receipts" },
  ]},
  { id: "logistics",     icon: Truck,         label: "Logistics", subsections: [
    { id: "packing-lists", label: "Packing Lists" },
    { id: "shipping",      label: "Shipping" },
  ]},
  { id: "settings-admin",icon: Settings,      label: "Settings & Admin", subsections: [
    { id: "profile",         label: "Profile Settings" },
    { id: "user-management", label: "User Management" },
    { id: "reports",         label: "Reports" },
  ]},
];

function Badge({ children, color = "gold" }: { children: React.ReactNode; color?: "gold" | "blue" | "green" | "red" }) {
  const colors: Record<string, string> = {
    gold:  "bg-[#fdf8e7] text-[#8a6f1e] border-[#e8d68a]",
    blue:  "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-green-50 text-green-700 border-green-200",
    red:   "bg-red-50 text-red-700 border-red-200",
  };
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${colors[color]}`}>{children}</span>;
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 mb-3">
      <div className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 text-white" style={{ background: G }}>{n}</div>
      <div className="text-sm text-gray-700 leading-relaxed">{children}</div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 mt-3 p-3 rounded-lg bg-blue-50 border border-blue-100 text-sm text-blue-800">
      <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
      <span>{children}</span>
    </div>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 mt-3 p-3 rounded-lg bg-amber-50 border border-amber-100 text-sm text-amber-800">
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
      <span>{children}</span>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-4 mb-6 pb-5 border-b border-gray-200">
      <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#fdf8e7", border: `1.5px solid ${G}30` }}>
        <Icon className="h-6 w-6" style={{ color: G }} />
      </div>
      <div>
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

function ModuleCard({ icon: Icon, title, desc, href }: { icon: React.ElementType; title: string; desc: string; href: string }) {
  return (
    <a href={href} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:border-[#C6AF4B]/40 hover:bg-[#fdf8e7]/40 transition-all group cursor-pointer no-underline">
      <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "#fdf8e7" }}>
        <Icon className="h-4.5 w-4.5" style={{ color: G }} />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-800 group-hover:text-gray-900">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-[#C6AF4B] mt-1 ml-auto shrink-0 transition-colors" />
    </a>
  );
}

function FeatureRow({ icon: Icon, label, desc }: { icon: React.ElementType; label: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <Icon className="h-4 w-4 mt-0.5 shrink-0 text-gray-400" />
      <div>
        <span className="text-sm font-medium text-gray-800">{label}</span>
        <span className="text-sm text-gray-500"> — {desc}</span>
      </div>
    </div>
  );
}

// ─── Content Sections ───────────────────────────────────────────────────────

function OverviewContent() {
  return (
    <div>
      <SectionHeader icon={BookOpen} title="ZARI ERP — User Manual" subtitle="Complete guide for using the Enterprise Resource Planning system" />
      <div className="prose-sm text-gray-700 leading-relaxed mb-6">
        <p className="mb-3">
          Welcome to <strong>ZARI ERP</strong> — the complete enterprise management system built exclusively for Zari Embroideries. 
          This manual covers every module of the system, from managing clients and orders to tracking inventory, generating invoices, and shipping goods.
        </p>
        <p>
          Whether you are a new user or an experienced staff member, this guide will help you understand each feature, perform day-to-day operations confidently, and get the most out of the system.
        </p>
      </div>

      <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">All Modules</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <ModuleCard icon={LayoutDashboard} title="Dashboard"         desc="Business overview, KPIs and quick actions"       href="#dashboard" />
        <ModuleCard icon={Database}        title="Masters"           desc="Clients, vendors, materials, categories"          href="#masters" />
        <ModuleCard icon={Zap}             title="Swatch Orders"     desc="Swatch sampling orders with artworks & costing"   href="#swatch-orders" />
        <ModuleCard icon={Star}            title="Style Orders"      desc="Production orders with costing and invoicing"     href="#style-orders" />
        <ModuleCard icon={FileText}        title="Quotations"        desc="Client quotes before order confirmation"          href="#quotations" />
        <ModuleCard icon={DollarSign}      title="Accounts"          desc="Invoices, payments, ledgers, credit notes"        href="#accounts" />
        <ModuleCard icon={Warehouse}       title="Inventory"         desc="Stock tracking, alerts, ledger, adjustments"      href="#inventory" />
        <ModuleCard icon={ShoppingCart}    title="Procurement"       desc="Purchase orders and goods receipt"                href="#procurement" />
        <ModuleCard icon={Truck}           title="Logistics"         desc="Packing lists and shipment tracking"              href="#logistics" />
        <ModuleCard icon={Settings}        title="Settings & Admin"  desc="Profile, users, reports and system config"        href="#settings-admin" />
      </div>

      <div className="mt-6 p-4 rounded-xl" style={{ background: "#fdf8e7", border: `1px solid ${G}30` }}>
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: G }}>How to use this manual</p>
        <p className="text-sm text-gray-700">Use the left sidebar to jump to any section. Each module section includes feature descriptions, step-by-step instructions, and helpful tips. You can also print this manual using the <strong>Print</strong> button at the top.</p>
      </div>
    </div>
  );
}

function LoginContent() {
  return (
    <div>
      <SectionHeader icon={LogIn} title="Getting Started" subtitle="How to log in, navigate the system, and reset your password" />

      <h3 className="font-semibold text-gray-800 mb-3">Logging In</h3>
      <Step n={1}>Open the ZARI ERP URL in your browser (Chrome or Edge recommended).</Step>
      <Step n={2}>On the login screen, enter your <strong>Username or Email</strong> and <strong>Password</strong>.</Step>
      <Step n={3}>Click the <strong>Sign In</strong> button. You will be taken to the Dashboard.</Step>
      <Tip>If you forget your password, click <strong>Forgot password?</strong> on the login page and enter your email to receive a reset link.</Tip>

      <div className="mt-6 mb-6 rounded-xl border border-gray-100 overflow-hidden bg-gray-50 flex items-center justify-center" style={{ minHeight: 120 }}>
        <div className="text-center p-6">
          <Lock className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p className="text-xs text-gray-400">Login Screen — Enter your credentials to access the ERP</p>
        </div>
      </div>

      <h3 className="font-semibold text-gray-800 mb-3 mt-4">Navigating the System</h3>
      <div className="space-y-0">
        <FeatureRow icon={Home}        label="Top Navigation Bar" desc="The main menu at the top provides access to all modules — Masters, Orders, Operations, Logistics, Accounts, Reports." />
        <FeatureRow icon={ChevronDown} label="Dropdown Menus"     desc="Hover or click on Masters, Orders, Operations, Logistics, or Accounts to see sub-pages." />
        <FeatureRow icon={UserCheck}   label="Profile Menu"       desc="Click your name/avatar at the top right to access Settings, User Management, or Sign Out." />
      </div>

      <h3 className="font-semibold text-gray-800 mb-3 mt-6">Access Levels</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
          <p className="text-xs font-bold text-amber-700 mb-1">Admin</p>
          <p className="text-xs text-amber-800">Full access to all modules including User Management, Settings, and all financial data.</p>
        </div>
        <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
          <p className="text-xs font-bold text-gray-700 mb-1">User</p>
          <p className="text-xs text-gray-600">Standard access to operational modules. Cannot manage users or system settings.</p>
        </div>
      </div>
    </div>
  );
}

function DashboardContent() {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  return (
    <div>
      <SectionHeader icon={LayoutDashboard} title="Dashboard" subtitle="Your real-time business overview" />
      <p className="text-sm text-gray-700 mb-4">
        The Dashboard is the first screen you see after logging in. It gives you a live snapshot of your business across all key areas.
      </p>

      <ScreenshotCallout
        src={`${base}/manual-screenshots/dashboard.jpg`}
        alt="Dashboard"
        callouts={[
          { n: 1, label: "KPI Cards — Style Orders, Swatch Orders, Artworks, Active Clients with month-on-month trends", top: 9, left: 1, width: 96, height: 28 },
          { n: 2, label: "Monthly Revenue Chart — Bar chart showing Style vs Swatch order trends over the last 6 months", top: 39, left: 1, width: 62, height: 57 },
          { n: 3, label: "Status Tracker — Donut charts showing the current pipeline breakdown for Style and Swatch orders", top: 39, left: 64, width: 34, height: 57 },
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {[
          { icon: Star,          label: "Style Orders",   desc: "Total active style production orders" },
          { icon: Zap,           label: "Swatch Orders",  desc: "Active swatch sampling requests" },
          { icon: PenLine,       label: "Artworks",       desc: "Artwork files across all orders" },
          { icon: Users,         label: "Active Clients", desc: "Clients with ongoing business" },
        ].map(c => (
          <div key={c.label} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-white">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#fdf8e7" }}>
              <c.icon className="h-4.5 w-4.5" style={{ color: G }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{c.label}</p>
              <p className="text-xs text-gray-500">{c.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <h3 className="font-semibold text-gray-800 mb-3">Dashboard Sections</h3>
      <div className="space-y-0">
        <FeatureRow icon={BarChart2}     label="Revenue Chart"        desc="Monthly revenue trend displayed as a bar chart." />
        <FeatureRow icon={ClipboardList} label="Order Status Donuts"  desc="Visual breakdown of Style and Swatch Orders by status." />
        <FeatureRow icon={Bell}          label="Recent Activity"      desc="Latest actions across the system (orders, invoices, etc.)." />
        <FeatureRow icon={Zap}           label="Quick Actions"        desc="Shortcut buttons to create orders, view clients, and go to accounts." />
        <FeatureRow icon={Eye}           label="Recent Orders Table"  desc="A live table of the most recent orders with status and amounts." />
      </div>
    </div>
  );
}

function MastersContent() {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  return (
    <div>
      <SectionHeader icon={Database} title="Masters" subtitle="Core reference data used throughout the system" />
      <p className="text-sm text-gray-700 mb-5">
        Masters are the foundation of the ERP. Before creating orders or invoices, you should set up your clients, vendors, materials, and categories here.
      </p>

      <div id="clients" className="mb-7">
        <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2"><Users className="h-4 w-4" style={{ color: G }} /> Clients</h3>
        <p className="text-sm text-gray-600 mb-3">Client records store all buyer information. Clients are linked to orders, invoices, and packing lists.</p>
        <ScreenshotCallout
          src={`${base}/manual-screenshots/clients.jpg`}
          alt="Client Master"
          callouts={[
            { n: 1, label: "Add Client — opens the form to create a new client record", top: 8, left: 84, width: 14, height: 13 },
            { n: 2, label: "Search bar — find clients by name, code, or contact details", top: 20, left: 1, width: 72, height: 11 },
            { n: 3, label: "Status filter & Export — filter active/inactive clients or export the list to Excel", top: 20, left: 74, width: 24, height: 11 },
            { n: 4, label: "Client table — shows all clients with code, brand name, contact, email, country and currency", top: 32, left: 1, width: 96, height: 65 },
          ]}
        />
        <Step n={1}>Go to <Badge>Masters → Clients</Badge> from the top navigation.</Step>
        <Step n={2}>Click <strong>Add Client</strong> to create a new client record.</Step>
        <Step n={3}>Fill in the Brand Name, Contact Person, Email, Phone, Address, GST number, and any other details.</Step>
        <Step n={4}>Click <strong>Save</strong>. The client is now available when creating orders and invoices.</Step>
        <Tip>You can search, filter, and edit existing clients from the Clients list. Click any row to view the full client profile.</Tip>
      </div>

      <div id="vendors" className="mb-7">
        <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2"><ShoppingBag className="h-4 w-4" style={{ color: G }} /> Vendors</h3>
        <p className="text-sm text-gray-600 mb-3">Vendors are suppliers from whom you purchase materials. They appear in purchase orders and ledgers.</p>
        <ScreenshotCallout
          src={`${base}/manual-screenshots/vendors.jpg`}
          alt="Vendor Master"
          callouts={[
            { n: 1, label: "Add Vendor — create a new supplier record", top: 8, left: 84, width: 14, height: 13 },
            { n: 2, label: "Search bar — find vendors by name, code, or contact", top: 20, left: 1, width: 73, height: 11 },
            { n: 3, label: "Status filter & Export — filter active/inactive vendors or download the list", top: 20, left: 74, width: 24, height: 11 },
            { n: 4, label: "Vendor table — shows vendor code, name, contact, GST status, country, and active status", top: 32, left: 1, width: 96, height: 65 },
          ]}
        />
        <Step n={1}>Go to <Badge>Masters → Vendors</Badge>.</Step>
        <Step n={2}>Click <strong>Add Vendor</strong> and enter the vendor details: name, contact, GSTIN, bank details, and payment terms.</Step>
        <Step n={3}>Save the vendor. It will now be available in Procurement and Accounts modules.</Step>
      </div>

      <div id="materials" className="mb-7">
        <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2"><Scissors className="h-4 w-4" style={{ color: G }} /> Materials & Fabrics</h3>
        <p className="text-sm text-gray-600 mb-3">Raw materials and fabrics are used in costing sheets and inventory tracking.</p>
        <FeatureRow icon={Layers} label="Materials"  desc="Go to Masters → Materials to add thread, trims, beads, and other raw materials." />
        <FeatureRow icon={Tag}    label="Fabric"     desc="Go to Masters → Fabric to add fabric types with unit prices." />
        <Tip>Materials added here appear in the Costing tab when creating swatch or style orders.</Tip>
      </div>

      <div id="hsn" className="mb-7">
        <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2"><Hash className="h-4 w-4" style={{ color: G }} /> HSN Codes</h3>
        <p className="text-sm text-gray-600 mb-3">HSN (Harmonized System of Nomenclature) codes are used for tax classification on invoices.</p>
        <Step n={1}>Go to <Badge>Masters → HSN</Badge>.</Step>
        <Step n={2}>Click <strong>Add HSN</strong> and enter the HSN code, description, and applicable GST rate.</Step>
        <Step n={3}>These codes will be available when creating style masters and invoices.</Step>
      </div>

      <div id="categories" className="mb-7">
        <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2"><List className="h-4 w-4" style={{ color: G }} /> Categories & Item Types</h3>
        <div className="space-y-0">
          <FeatureRow icon={Layers} label="Style Categories"  desc="Masters → Style Categories — classify styles (e.g., Blouse, Saree Border, Dupatta)." />
          <FeatureRow icon={Layers} label="Swatch Categories" desc="Masters → Swatch Categories — classify swatch samples by type." />
          <FeatureRow icon={Tag}    label="Item Types"        desc="Masters → Item Types — define types of embroidery items for reporting." />
          <FeatureRow icon={Tag}    label="Styles & Swatches" desc="Masters → Style / Swatch — create the design master records that are referenced in orders." />
        </div>
      </div>

      <div id="packaging-masters" className="mb-7">
        <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2"><Box className="h-4 w-4" style={{ color: G }} /> Packaging Materials</h3>
        <p className="text-sm text-gray-600 mb-3">Define the types of boxes and packing materials used in packing lists.</p>
        <Step n={1}>Go to <Badge>Masters → Item Master</Badge>.</Step>
        <Step n={2}>Add packaging items such as cartons, poly bags, bubble wrap with unit costs.</Step>
      </div>

      <div id="shipping-vendors" className="mb-7">
        <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2"><Truck className="h-4 w-4" style={{ color: G }} /> Shipping Vendors</h3>
        <p className="text-sm text-gray-600 mb-3">Shipping vendor records store courier/freight companies used for dispatching goods.</p>
        <Step n={1}>Go to <Badge>Masters → Shipping Vendors</Badge>.</Step>
        <Step n={2}>Add vendor details including their <strong>rate per kg</strong> and minimum charge — these auto-calculate shipping costs in packing lists.</Step>
        <Tip>A shipping vendor can be marked inactive if you no longer use them, without deleting historical records.</Tip>
      </div>
    </div>
  );
}

function SwatchOrdersContent() {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  return (
    <div>
      <SectionHeader icon={Zap} title="Swatch Orders" subtitle="Manage embroidery sampling and swatch production orders" />
      <p className="text-sm text-gray-700 mb-4">
        Swatch Orders track sample embroidery orders — small runs done before full production — that clients use to approve designs.
      </p>

      <ScreenshotCallout
        src={`${base}/manual-screenshots/swatch-orders.jpg`}
        alt="Swatch Orders"
        callouts={[
          { n: 1, label: "New Swatch Order — click to create a new sampling order", top: 9, left: 82, width: 17, height: 13 },
          { n: 2, label: "Status tabs — filter orders by All, Draft, Issued, In Sampling, In Artwork, Pending Approval, Completed, etc.", top: 20, left: 1, width: 63, height: 10 },
          { n: 3, label: "Search & filters — find orders by swatch name or client; filter by priority and chargeability", top: 31, left: 1, width: 55, height: 12 },
          { n: 4, label: "Order cards — each card shows the order code, client, due date, quantity, fabric type, and status badge", top: 44, left: 1, width: 96, height: 55 },
        ]}
      />

      <h3 className="font-semibold text-gray-800 mb-3">Creating a Swatch Order</h3>
      <Step n={1}>Go to <Badge>Orders → Swatch Orders</Badge>.</Step>
      <Step n={2}>Click <strong>New Swatch Order</strong> at the top right.</Step>
      <Step n={3}>Select the <strong>Client</strong> and enter the order date, delivery date, and any remarks.</Step>
      <Step n={4}>Add order line items — each item references a Swatch from your masters, with quantity and notes.</Step>
      <Step n={5}>Save the order. The order gets an auto-generated Order Number.</Step>

      <h3 className="font-semibold text-gray-800 mb-3 mt-6">Order Tabs</h3>
      <div className="space-y-0">
        <FeatureRow icon={Eye}         label="Overview"       desc="View order header details — client, dates, status, and remarks." />
        <FeatureRow icon={PenLine}     label="Artworks"       desc="Upload and manage design artwork files linked to this order." />
        <FeatureRow icon={DollarSign}  label="Costing"        desc="Add material costs (fabric, threads, trims) to calculate the total cost of production." />
        <FeatureRow icon={FileText}    label="Cost Sheet"     desc="Generate a printable/shareable cost breakdown for this order." />
        <FeatureRow icon={Truck}       label="Shipping"       desc="Record shipment details — vendor, tracking number, dates, and weight." />
      </div>

      <h3 className="font-semibold text-gray-800 mb-3 mt-6">Order Statuses</h3>
      <div className="flex flex-wrap gap-2">
        {["Pending","In Progress","Completed","Cancelled","On Hold"].map(s => (
          <Badge key={s} color={s === "Completed" ? "green" : s === "Cancelled" ? "red" : "gold"}>{s}</Badge>
        ))}
      </div>

      <Tip>You can view all artworks for a swatch order by clicking the <strong>Artworks</strong> tab inside the order detail page. Each artwork can have its own approval status.</Tip>
    </div>
  );
}

function StyleOrdersContent() {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  return (
    <div>
      <SectionHeader icon={Star} title="Style Orders" subtitle="Full production orders with costing, invoicing, and shipping" />
      <p className="text-sm text-gray-700 mb-4">
        Style Orders are the main production orders. They go through a complete lifecycle: creation → artworks → costing → invoicing → shipping.
      </p>

      <ScreenshotCallout
        src={`${base}/manual-screenshots/style-orders.jpg`}
        alt="Style Orders"
        callouts={[
          { n: 1, label: "New Style Order — start a new production order", top: 9, left: 82, width: 17, height: 13 },
          { n: 2, label: "Status tabs — filter by Draft, Issued, In Production, In Review, Pending Approval, Completed, Rejected, Cancelled", top: 20, left: 1, width: 64, height: 10 },
          { n: 3, label: "Search & Priority filters — search by style name, order code or client; filter by priority and chargeability", top: 31, left: 1, width: 55, height: 12 },
          { n: 4, label: "Order cards — each shows order code, client, due date, quantity, collection, and current status", top: 44, left: 1, width: 96, height: 55 },
        ]}
      />

      <h3 className="font-semibold text-gray-800 mb-3">Creating a Style Order</h3>
      <Step n={1}>Go to <Badge>Orders → Style Orders</Badge>.</Step>
      <Step n={2}>Click <strong>New Style Order</strong>.</Step>
      <Step n={3}>Select the <strong>Client</strong>, enter dates, and optionally link a Style from your masters.</Step>
      <Step n={4}>Add product line items with quantities, units, and rates.</Step>
      <Step n={5}>Save. The order number is auto-generated.</Step>

      <h3 className="font-semibold text-gray-800 mb-3 mt-6">Order Tabs</h3>
      <div className="space-y-0">
        <FeatureRow icon={Eye}         label="Overview"       desc="Header details: client, order reference, status, delivery date." />
        <FeatureRow icon={PenLine}     label="Artworks"       desc="Upload artwork/design files and track approval status per artwork." />
        <FeatureRow icon={DollarSign}  label="Costing"        desc="Detailed cost build-up: fabric, materials, labour, overhead, margin." />
        <FeatureRow icon={FileText}    label="Cost Sheet"     desc="A formatted cost sheet you can share with the client or print." />
        <FeatureRow icon={Receipt}     label="Invoice"        desc="Generate GST-compliant invoices directly from the order." />
        <FeatureRow icon={Truck}       label="Shipping"       desc="Record shipping details with tracking number, weight, and vendor." />
        <FeatureRow icon={UserCheck}   label="Client Link"   desc="A unique client portal link to share the order status with the buyer." />
      </div>

      <h3 className="font-semibold text-gray-800 mb-3 mt-6">Workflow</h3>
      <div className="flex items-center gap-1 flex-wrap text-xs text-gray-600 mb-4">
        {["Create Order","Add Artworks","Cost the Order","Generate Invoice","Ship & Track"].map((s, i, arr) => (
          <span key={s} className="flex items-center gap-1">
            <span className="px-2 py-1 rounded-lg bg-gray-100 font-medium">{s}</span>
            {i < arr.length - 1 && <ChevronRight className="h-3 w-3 text-gray-300" />}
          </span>
        ))}
      </div>

      <Tip>You can generate the invoice directly from the Invoice tab inside the style order without going to the Accounts module separately.</Tip>
      <Warn>Make sure to complete the Costing tab before generating an invoice, so that the price is accurate.</Warn>
    </div>
  );
}

function QuotationsContent() {
  return (
    <div>
      <SectionHeader icon={FileText} title="Quotations" subtitle="Create and send price quotations to clients before order confirmation" />
      <p className="text-sm text-gray-700 mb-4">
        Quotations are formal price proposals sent to clients. Once a client approves, the quotation can be converted to an order.
      </p>

      <h3 className="font-semibold text-gray-800 mb-3">Creating a Quotation</h3>
      <Step n={1}>Go to <Badge>Quotation</Badge> from the top navigation.</Step>
      <Step n={2}>Click <strong>New Quotation</strong>.</Step>
      <Step n={3}>Select the client, set a valid-until date, and add line items with descriptions, quantities, and rates.</Step>
      <Step n={4}>Add any terms, conditions, or notes at the bottom.</Step>
      <Step n={5}>Save and share the quotation with the client.</Step>

      <h3 className="font-semibold text-gray-800 mb-3 mt-5">Quotation Statuses</h3>
      <div className="flex flex-wrap gap-2">
        {["Draft","Sent","Approved","Rejected","Expired"].map(s => (
          <Badge key={s} color={s === "Approved" ? "green" : s === "Rejected" || s === "Expired" ? "red" : "gold"}>{s}</Badge>
        ))}
      </div>

      <Tip>View the quotation detail page to see the formatted version that the client will see.</Tip>
    </div>
  );
}

function AccountsContent() {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  return (
    <div>
      <SectionHeader icon={DollarSign} title="Accounts & Finance" subtitle="Invoices, payments, ledgers, credit notes, and financial reports" />

      <ScreenshotCallout
        src={`${base}/manual-screenshots/accounts.jpg`}
        alt="Accounts Dashboard"
        callouts={[
          { n: 1, label: "Date & Vendor/Client filters — narrow all dashboard figures to a specific time range, vendor, or client", top: 16, left: 1, width: 96, height: 17 },
          { n: 2, label: "Sales Summary — Total Invoiced, Amount Received, and Pending Receivables at a glance", top: 35, left: 1, width: 96, height: 22 },
          { n: 3, label: "Vendor Bills & Payments — Total vendor bills, paid amount, and pending payables", top: 59, left: 1, width: 96, height: 30 },
        ]}
      />

      <div id="invoices" className="mb-7">
        <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2"><Receipt className="h-4 w-4" style={{ color: G }} /> Invoices</h3>
        <p className="text-sm text-gray-600 mb-3">Create, view, and manage GST invoices for style orders and other sales.</p>
        <ScreenshotCallout
          src={`${base}/manual-screenshots/invoices.jpg`}
          alt="Invoices"
          callouts={[
            { n: 1, label: "New Invoice — create a standalone invoice or link one to an existing Style Order", top: 9, left: 84, width: 14, height: 13 },
            { n: 2, label: "Summary cards — Total Invoice Value, Amount Received, and Amount Pending across all invoices", top: 20, left: 1, width: 96, height: 18 },
            { n: 3, label: "Search & multi-filter row — filter by direction (in/out), type, status, and order type", top: 40, left: 1, width: 96, height: 11 },
            { n: 4, label: "Invoice table — shows invoice number, client/vendor, type, amount, received, pending, and date", top: 53, left: 1, width: 96, height: 45 },
          ]}
        />
        <Step n={1}>Go to <Badge>Accounts → Invoices</Badge> or create an invoice directly from a Style Order's Invoice tab.</Step>
        <Step n={2}>Select the client and the order reference. Line items are auto-filled from the order.</Step>
        <Step n={3}>Verify GST rates (CGST/SGST/IGST), add any adjustments, and save.</Step>
        <Step n={4}>Use the <strong>Print / Preview</strong> button to generate a PDF version of the invoice.</Step>
        <Tip>Invoices created from Style Orders are automatically linked — you can view them from either the order or the Accounts module.</Tip>
      </div>

      <div id="payments" className="mb-7">
        <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2"><CreditCard className="h-4 w-4" style={{ color: G }} /> Payments</h3>
        <p className="text-sm text-gray-600 mb-3">Record incoming payments from clients against invoices.</p>
        <Step n={1}>Go to <Badge>Accounts → Payments</Badge>.</Step>
        <Step n={2}>Click <strong>Record Payment</strong>, select the client and invoice, and enter the amount, date, and payment mode.</Step>
        <Step n={3}>Save. The payment is reflected in the client's outstanding balance.</Step>
      </div>

      <div id="cdn" className="mb-7">
        <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2"><RotateCcw className="h-4 w-4" style={{ color: G }} /> Credit / Debit Notes</h3>
        <p className="text-sm text-gray-600 mb-3">Use credit notes (returns/adjustments) or debit notes (extra charges) to correct invoice amounts.</p>
        <Step n={1}>Go to <Badge>Accounts → Credit/Debit Notes</Badge>.</Step>
        <Step n={2}>Select the type (Credit or Debit), link to the original invoice, and enter the adjustment amount and reason.</Step>
      </div>

      <div id="vendor-ledger" className="mb-7">
        <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2"><Database className="h-4 w-4" style={{ color: G }} /> Vendor Ledgers</h3>
        <p className="text-sm text-gray-600 mb-3">View a complete transaction history with each vendor — purchases, payments, and outstanding amounts.</p>
        <Step n={1}>Go to <Badge>Accounts → Ledgers</Badge>.</Step>
        <Step n={2}>Select a vendor to view their full ledger statement.</Step>
        <Tip>Vendor ledgers are updated automatically whenever a purchase order or payment is recorded.</Tip>
      </div>

      <div id="purchases-accounts" className="mb-7">
        <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2"><ShoppingCart className="h-4 w-4" style={{ color: G }} /> Purchases & Sales</h3>
        <FeatureRow icon={ShoppingCart} label="Purchases" desc="Go to Accounts → Purchases to view all vendor purchase transactions." />
        <FeatureRow icon={BarChart2}    label="Sales"     desc="Go to Accounts → Sales to view all client sales transactions and totals." />
      </div>

      <div id="expenses" className="mb-7">
        <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2"><DollarSign className="h-4 w-4" style={{ color: G }} /> Other Expenses</h3>
        <p className="text-sm text-gray-600 mb-3">Record miscellaneous business expenses such as rent, utilities, or travel that are not linked to a purchase order.</p>
        <Step n={1}>Go to <Badge>Accounts → Other Expenses</Badge>.</Step>
        <Step n={2}>Click <strong>Add Expense</strong>, enter the description, amount, category, and date.</Step>
      </div>
    </div>
  );
}

function InventoryContent() {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  return (
    <div>
      <SectionHeader icon={Warehouse} title="Inventory" subtitle="Track stock levels, movements, alerts, and adjustments" />

      <div id="inv-dashboard" className="mb-7">
        <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2"><LayoutDashboard className="h-4 w-4" style={{ color: G }} /> Inventory Dashboard</h3>
        <p className="text-sm text-gray-600">Provides a visual overview of total stock value, items near reorder point, and recent stock movements.</p>
        <ScreenshotCallout
          src={`${base}/manual-screenshots/inventory.jpg`}
          alt="Inventory Dashboard"
          callouts={[
            { n: 1, label: "Category & date filters — narrow the dashboard to a specific category, sub-category, or date range", top: 14, left: 1, width: 96, height: 16 },
            { n: 2, label: "Stock Status cards — Total Items, In Stock, Low Stock, Out of Stock, and Total Stock Value", top: 32, left: 1, width: 96, height: 19 },
            { n: 3, label: "Procurement snapshot — Active Purchase Orders, Line Items in POs, Pending Quantity, and Receipts", top: 53, left: 1, width: 96, height: 17 },
            { n: 4, label: "Charts — Stock status split (In/Low/Out) and Category split (Fabric/Material/Packaging) at a glance", top: 71, left: 1, width: 96, height: 26 },
          ]}
        />
        <p className="text-sm text-gray-600 mt-1">Navigate to <Badge>Stock → Inventory Dashboard</Badge>.</p>
      </div>

      <div id="stock-list" className="mb-7">
        <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2"><List className="h-4 w-4" style={{ color: G }} /> Item Stock List</h3>
        <p className="text-sm text-gray-600 mb-3">A complete list of all inventory items with current stock quantity, unit of measure, and value.</p>
        <Step n={1}>Go to <Badge>Operations → Inventory → Item Stock List</Badge>.</Step>
        <Step n={2}>Search or filter items by name, category, or stock status.</Step>
        <Step n={3}>Click an item to view its transaction history and reserved quantities.</Step>
      </div>

      <div id="low-stock" className="mb-7">
        <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2"><AlertTriangle className="h-4 w-4" style={{ color: G }} /> Low Stock Alerts</h3>
        <p className="text-sm text-gray-600">Shows items that have fallen below their minimum reorder quantity. Review this regularly to avoid production delays.</p>
        <Warn>Items in the Low Stock Alerts list need to be reordered immediately to avoid delays in production.</Warn>
      </div>

      <div id="ledger" className="mb-7">
        <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2"><ClipboardList className="h-4 w-4" style={{ color: G }} /> Stock Ledger</h3>
        <p className="text-sm text-gray-600">A detailed transaction log showing every inward and outward movement for each inventory item. Useful for auditing stock levels.</p>
      </div>

      <div id="reservations" className="mb-7">
        <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2"><Lock className="h-4 w-4" style={{ color: G }} /> Reservations</h3>
        <p className="text-sm text-gray-600">When an order is confirmed, materials can be reserved so they are not mistakenly used for other orders. View all active reservations here.</p>
      </div>

      <div id="adjustments" className="mb-7">
        <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2"><RotateCcw className="h-4 w-4" style={{ color: G }} /> Stock Adjustments</h3>
        <p className="text-sm text-gray-600 mb-3">Correct stock quantities due to damage, theft, stocktaking discrepancies, or write-offs.</p>
        <Step n={1}>Go to <Badge>Operations → Inventory → Stock Adjustments</Badge>.</Step>
        <Step n={2}>Click <strong>New Adjustment</strong>, select the item, enter the adjusted quantity, and provide a reason.</Step>
        <Warn>Stock adjustments permanently change quantity records. Use with care and always provide a reason.</Warn>
      </div>
    </div>
  );
}

function ProcurementContent() {
  return (
    <div>
      <SectionHeader icon={ShoppingCart} title="Procurement" subtitle="Manage purchase orders and goods receipt from vendors" />

      <div id="purchase-orders" className="mb-7">
        <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2"><FileText className="h-4 w-4" style={{ color: G }} /> Purchase Orders</h3>
        <p className="text-sm text-gray-600 mb-3">Purchase Orders (POs) are formal requests to vendors for materials or services.</p>
        <Step n={1}>Go to <Badge>Operations → Procurement → Purchase Orders</Badge>.</Step>
        <Step n={2}>Click <strong>New Purchase Order</strong>.</Step>
        <Step n={3}>Select the vendor, set the order date and expected delivery, and add line items (materials, quantities, rates).</Step>
        <Step n={4}>Save the PO. You can print or email it to the vendor.</Step>
        <Step n={5}>When goods arrive, create a <strong>Purchase Receipt</strong> against this PO.</Step>
      </div>

      <div id="purchase-receipts" className="mb-7">
        <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2"><CheckCircle className="h-4 w-4" style={{ color: G }} /> Purchase Receipts</h3>
        <p className="text-sm text-gray-600 mb-3">Record goods received from a vendor against an existing Purchase Order. Receipts update inventory stock automatically.</p>
        <Step n={1}>Go to <Badge>Operations → Procurement → Purchase Receipts</Badge>.</Step>
        <Step n={2}>Click <strong>New Receipt</strong> and select the Purchase Order.</Step>
        <Step n={3}>Enter the received quantities for each line item (partial receipts are allowed).</Step>
        <Step n={4}>Save. Inventory levels are updated immediately.</Step>
        <Tip>If you receive fewer items than ordered, you can create another receipt later for the remaining quantity.</Tip>
      </div>
    </div>
  );
}

function LogisticsContent() {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  return (
    <div>
      <SectionHeader icon={Truck} title="Logistics" subtitle="Packing lists, package management, and shipment tracking" />

      <div id="packing-lists" className="mb-8">
        <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2"><Box className="h-4 w-4" style={{ color: G }} /> Packing Lists</h3>
        <p className="text-sm text-gray-600 mb-4">
          Packing Lists are the core logistics document. They define how goods are packed into individual packages before dispatch — specifying which products go in which box, with weights and dimensions.
        </p>

        <ScreenshotCallout
          src={`${base}/manual-screenshots/packing-lists.jpg`}
          alt="Packing Lists"
          callouts={[
            { n: 1, label: "New Packing List — create a packing list and optionally create a new shipment inline", top: 13, left: 82, width: 17, height: 17 },
            { n: 2, label: "Search bar — find packing lists by PL number, client name, or shipment reference", top: 30, left: 1, width: 71, height: 16 },
            { n: 3, label: "Client & Status filters — quickly narrow the list by client or status (Draft / Ready / Shipped)", top: 30, left: 73, width: 25, height: 16 },
            { n: 4, label: "Packing list table — shows PL number, client, delivery address, destination, packages, weights, and status", top: 47, left: 1, width: 96, height: 48 },
          ]}
        />

        <h4 className="text-sm font-semibold text-gray-700 mb-2">Creating a Packing List</h4>
        <Step n={1}>Go to <Badge>Logistics → Packing Lists</Badge> and click <strong>New Packing List</strong>.</Step>
        <Step n={2}>Select the <strong>Client</strong> and fill in the packing list header: destination country, package type (Carton/Bag/Roll/Other), total packages, and dimensions.</Step>
        <Step n={3}>In the <strong>Packages</strong> section, define each physical box/carton. Set its package number, dimensions (L × W × H), net weight, and gross weight.</Step>
        <Step n={4}>For each package, click <strong>Add Item</strong> to assign products. You can add Swatch Orders or Style Orders as source. Enter quantity, unit, and weight per item.</Step>
        <Step n={5}>In the <strong>Shipment & Details</strong> section, either select an existing shipment or click <strong>Create New</strong> to create a new shipment record inline.</Step>
        <Step n={6}>Click <strong>Save Packing List</strong>. If you created a new shipment, it will be created and linked automatically at this point.</Step>

        <h4 className="text-sm font-semibold text-gray-700 mb-2 mt-5">Inline Shipment Creation</h4>
        <p className="text-sm text-gray-600 mb-3">Instead of going to the Shipping module separately, you can create the shipment right from the packing list form:</p>
        <Step n={1}>In the Shipment & Details section, click <strong>Create New</strong>.</Step>
        <Step n={2}>Fill in the shipping vendor, tracking number, weight, shipment status, shipment date, and expected delivery date.</Step>
        <Step n={3}>Click <strong>Add Shipment</strong>. An amber preview card appears showing the staged shipment.</Step>
        <Step n={4}>The shipment is only saved to the database when you click <strong>Save Packing List</strong> — no orphaned records are created if you cancel.</Step>

        <Tip>Each packing list gets a unique PL number (e.g. PL-2024-0001) automatically. You can search and filter packing lists by client or status.</Tip>

        <h4 className="text-sm font-semibold text-gray-700 mb-2 mt-5">Packing List Statuses</h4>
        <div className="flex flex-wrap gap-2">
          {["Draft","Ready","Dispatched","Delivered","Cancelled"].map(s => (
            <Badge key={s} color={s === "Delivered" ? "green" : s === "Cancelled" ? "red" : "gold"}>{s}</Badge>
          ))}
        </div>
      </div>

      <div id="shipping" className="mb-7">
        <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2"><Send className="h-4 w-4" style={{ color: G }} /> Shipping</h3>
        <p className="text-sm text-gray-600 mb-3">The Shipping module lists all shipment records across swatch orders, style orders, and packing lists.</p>
        <ScreenshotCallout
          src={`${base}/manual-screenshots/shipping.jpg`}
          alt="Shipping"
          callouts={[
            { n: 1, label: "Search bar — find shipments by tracking number, reference ID, or client name", top: 19, left: 1, width: 34, height: 16 },
            { n: 2, label: "Multi-filters — filter by status, type (Swatch/Style/PackingList), vendor, and ship date", top: 19, left: 35, width: 64, height: 16 },
            { n: 3, label: "Shipment table — shows type, reference order, client, vendor, tracking no., weight, cost, status, ship date, and EDD", top: 37, left: 1, width: 96, height: 60 },
          ]}
        />
        <Step n={1}>Go to <Badge>Logistics → Shipping</Badge> from the top navigation.</Step>
        <Step n={2}>View all shipments with vendor, tracking number, status, and dates.</Step>
        <Step n={3}>Click a shipment to view or edit its details.</Step>
        <Tip>Shipments can be created directly from Swatch Orders, Style Orders, or Packing Lists. All shipments are centralised here for easy tracking.</Tip>
      </div>
    </div>
  );
}

function SettingsContent() {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  return (
    <div>
      <SectionHeader icon={Settings} title="Settings & Administration" subtitle="Configure your profile, manage users, and access reports" />

      <div id="profile" className="mb-7">
        <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2"><UserCheck className="h-4 w-4" style={{ color: G }} /> Profile Settings</h3>
        <p className="text-sm text-gray-600 mb-3">Update your personal details, upload a profile photo, and change your password.</p>
        <ScreenshotCallout
          src={`${base}/manual-screenshots/settings.jpg`}
          alt="Settings"
          callouts={[
            { n: 1, label: "Settings sidebar — switch between Profile, Currency, Bank Details, GST Settings, Activity Logs, Warehouses, and Invoice Templates", top: 16, left: 1, width: 20, height: 60 },
            { n: 2, label: "Profile Information — update your display name, phone number, and profile photo", top: 16, left: 22, width: 76, height: 50 },
            { n: 3, label: "Change Password — set a new password from the same page below Profile Information", top: 68, left: 22, width: 76, height: 28 },
          ]}
        />
        <Step n={1}>Click your name/avatar at the top right and select <strong>Settings</strong>.</Step>
        <Step n={2}>Edit your display name, email, and upload a profile photo.</Step>
        <Step n={3}>To change your password, enter your current password, then the new password twice, and save.</Step>
      </div>

      <div id="user-management" className="mb-7">
        <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2"><Users className="h-4 w-4" style={{ color: G }} /> User Management</h3>
        <p className="text-sm text-gray-600 mb-3">Admins can add, edit, or deactivate users from this section.</p>
        <Step n={1}>Click your avatar → <strong>User Management</strong>, or go directly via the URL.</Step>
        <Step n={2}>Click <strong>Invite User</strong> to add a new team member. Enter their email and role.</Step>
        <Step n={3}>The new user receives an email invitation to set up their password.</Step>
        <Step n={4}>To deactivate a user, click the toggle next to their name in the user list.</Step>
        <Warn>Only Admin-role users can access User Management. Regular users cannot add or remove team members.</Warn>
      </div>

      <div id="reports" className="mb-7">
        <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2"><BarChart2 className="h-4 w-4" style={{ color: G }} /> Reports</h3>
        <p className="text-sm text-gray-600 mb-3">Generate and export business reports for orders, sales, inventory, and accounts.</p>
        <Step n={1}>Go to <Badge>Reports</Badge> from the top navigation.</Step>
        <Step n={2}>Select the report type and date range, then click <strong>Generate Report</strong>.</Step>
        <Step n={3}>Use the <strong>Export</strong> option to download data as a spreadsheet.</Step>
        <Tip>Reports can be filtered by client, date range, or status to get exactly the data you need.</Tip>
      </div>
    </div>
  );
}

const CONTENT_MAP: Record<string, React.ComponentType> = {
  overview:       OverviewContent,
  login:          LoginContent,
  dashboard:      DashboardContent,
  masters:        MastersContent,
  "swatch-orders":SwatchOrdersContent,
  "style-orders": StyleOrdersContent,
  quotations:     QuotationsContent,
  accounts:       AccountsContent,
  inventory:      InventoryContent,
  procurement:    ProcurementContent,
  logistics:      LogisticsContent,
  "settings-admin":SettingsContent,
};

const SECTION_LABELS: Record<string, string> = {
  overview:        "Introduction",
  login:           "Getting Started",
  dashboard:       "Dashboard",
  masters:         "Masters",
  "swatch-orders": "Swatch Orders",
  "style-orders":  "Style Orders",
  quotations:      "Quotations",
  accounts:        "Accounts & Finance",
  inventory:       "Inventory",
  procurement:     "Procurement",
  logistics:       "Logistics",
  "settings-admin":"Settings & Administration",
};

const ALL_SECTION_IDS = Object.keys(CONTENT_MAP);

export default function UserManual() {
  const [active, setActive]         = useState("overview");
  const [expanded, setExpanded]     = useState<Record<string, boolean>>({});
  const [search, setSearch]         = useState("");
  const [dlOpen, setDlOpen]         = useState(false);
  const [printMode, setPrintMode]   = useState<"full" | "section" | null>(null);
  const contentRef  = useRef<HTMLDivElement>(null);
  const dlRef       = useRef<HTMLDivElement>(null);

  const ActiveContent = CONTENT_MAP[active] ?? OverviewContent;

  const scrollTop = () => contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });

  const filteredSections = search.trim()
    ? SECTIONS.filter(s =>
        s.label.toLowerCase().includes(search.toLowerCase()) ||
        s.subsections?.some(sub => sub.label.toLowerCase().includes(search.toLowerCase()))
      )
    : SECTIONS;

  // Close download dropdown when clicking outside
  const handleDocClick = (e: MouseEvent) => {
    if (dlRef.current && !dlRef.current.contains(e.target as Node)) setDlOpen(false);
  };
  // attach/detach listener
  if (dlOpen) {
    document.addEventListener("mousedown", handleDocClick);
  } else {
    document.removeEventListener("mousedown", handleDocClick);
  }

  const triggerPrint = (mode: "full" | "section") => {
    setDlOpen(false);
    setPrintMode(mode);
    // Give React one frame to render the print content, then print
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
        // Reset after dialog closes (afterprint fires when print dialog is dismissed)
        const reset = () => { setPrintMode(null); window.removeEventListener("afterprint", reset); };
        window.addEventListener("afterprint", reset);
      });
    });
  };

  const activeSectionLabel = SECTION_LABELS[active] ?? active;

  return (
    <div className={`flex flex-col bg-[#f8f9fb] ${printMode ? "" : "h-screen overflow-hidden"}`}>

      {/* ── Top bar (hidden in print) ── */}
      <div className="zari-no-print flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="h-8 w-8 rounded-lg flex items-center justify-center border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors shrink-0"
            title="Go back"
          >
            <ArrowLeft className="h-4 w-4 text-gray-500" />
          </button>
          <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: "#111" }}>
            <BookOpen className="h-4 w-4" style={{ color: G }} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900">User Manual</h1>
            <p className="text-xs text-gray-400">ZARI ERP — Complete Guide</p>
          </div>
        </div>

        {/* Download dropdown */}
        <div className="relative" ref={dlRef}>
          <button
            onClick={() => setDlOpen(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Download
            <ChevronDown className={`h-3 w-3 ml-0.5 transition-transform ${dlOpen ? "rotate-180" : ""}`} />
          </button>

          {dlOpen && (
            <div className="absolute top-full right-0 mt-1.5 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Download as PDF</p>
              </div>
              <div className="p-1">
                <button
                  onClick={() => triggerPrint("full")}
                  className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-gray-50 transition-colors group"
                >
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#fdf8e7" }}>
                    <BookOpen className="h-3.5 w-3.5" style={{ color: G }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">Full Manual</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">All {ALL_SECTION_IDS.length} sections in one PDF</p>
                  </div>
                </button>
                <button
                  onClick={() => triggerPrint("section")}
                  className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-gray-50 transition-colors group"
                >
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-blue-50">
                    <FileText className="h-3.5 w-3.5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">Current Section</p>
                    <p className="text-[10px] text-gray-500 mt-0.5 truncate max-w-[130px]">{activeSectionLabel} only</p>
                  </div>
                </button>
              </div>
              <div className="px-3 py-2 border-t border-gray-100 bg-gray-50">
                <p className="text-[10px] text-gray-400">Use your browser's "Save as PDF" option in the print dialog.</p>
              </div>
              <div className="px-3 py-2 border-t border-gray-100 bg-gray-50">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Project Document</p>
              </div>
              <div className="p-1 space-y-0.5">
                <a
                  href={`${(import.meta.env.BASE_URL ?? "/").replace(/\/$/, "")}/ZARI_ERP_Scope_Document_v2.pdf`}
                  download="ZARI_ERP_Scope_Document_v2.pdf"
                  onClick={() => setDlOpen(false)}
                  className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-gray-50 transition-colors group"
                >
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#FEF2F2" }}>
                    <FileText className="h-3.5 w-3.5" style={{ color: "#DC2626" }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">Scope Document <span className="font-normal text-gray-400">(PDF)</span></p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Full project scope · 18 sections</p>
                  </div>
                </a>
                <a
                  href={`${(import.meta.env.BASE_URL ?? "/").replace(/\/$/, "")}/ZARI_ERP_Scope_Document_v2.docx`}
                  download="ZARI_ERP_Scope_Document_v2.docx"
                  onClick={() => setDlOpen(false)}
                  className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-gray-50 transition-colors group"
                >
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#EEF2FF" }}>
                    <FileText className="h-3.5 w-3.5" style={{ color: "#4F46E5" }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">Scope Document <span className="font-normal text-gray-400">(DOCX)</span></p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Editable Word format · Full project scope</p>
                  </div>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className={`flex ${printMode ? "" : "flex-1 overflow-hidden"}`}>

        {/* Left sidebar */}
        <div className="zari-no-print w-56 shrink-0 bg-white border-r border-gray-100 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-gray-100">
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-100">
              <Search className="h-3.5 w-3.5 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search sections..."
                className="flex-1 bg-transparent text-xs outline-none text-gray-700 placeholder-gray-400"
              />
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto py-2 px-2">
            {filteredSections.map(s => {
              const Icon = s.icon;
              const isActive = active === s.id;
              const isExp = expanded[s.id];
              return (
                <div key={s.id}>
                  <button
                    onClick={() => {
                      setActive(s.id);
                      if (s.subsections) setExpanded(e => ({ ...e, [s.id]: !e[s.id] }));
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-all mb-0.5 text-left ${
                      isActive ? "text-white" : "text-gray-600 hover:bg-gray-50"
                    }`}
                    style={isActive ? { background: G } : {}}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1 truncate">{s.label}</span>
                    {s.subsections && (
                      <ChevronDown className={`h-3 w-3 transition-transform ${isExp ? "rotate-180" : ""}`} />
                    )}
                  </button>
                  {s.subsections && isExp && (
                    <div className="ml-4 mb-1 space-y-0.5">
                      {s.subsections.map(sub => (
                        <a
                          key={sub.id}
                          href={`#${sub.id}`}
                          onClick={() => setActive(s.id)}
                          className="block px-2.5 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors truncate"
                        >
                          {sub.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
          <div className="p-3 border-t border-gray-100">
            <p className="text-[10px] text-gray-400 text-center">ZARI ERP © 2026</p>
          </div>
        </div>

        {/* Main content */}
        <div
          ref={contentRef}
          className={printMode ? "w-full" : "flex-1 overflow-y-auto p-8"}
        >
          <div className={printMode ? "w-full" : "max-w-3xl mx-auto"}>

            {/* Normal / section-print view */}
            {(!printMode || printMode === "section") && (
              <div className={printMode ? "zari-print-section" : "bg-white rounded-2xl shadow-sm border border-gray-100 p-8"}>
                <ActiveContent />
              </div>
            )}

            {/* Full manual print view — all sections */}
            {printMode === "full" && (
              <div className="zari-print-full">
                {ALL_SECTION_IDS.map((id) => {
                  const Comp = CONTENT_MAP[id];
                  return (
                    <div key={id} className="zari-print-page">
                      <Comp />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Back to top — screen only */}
            {!printMode && (
              <div className="zari-no-print flex justify-end mt-4">
                <button
                  onClick={scrollTop}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                  Back to top
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Print styles ── */}
      <style>{`
        /* Screen: full-print and section-print divs are invisible until printMode kicks in */
        .zari-print-full,
        .zari-print-section { display: none; }

        @media print {
          /* Hide UI chrome */
          .zari-no-print { display: none !important; }

          /* Show print content */
          .zari-print-full  { display: block !important; }
          .zari-print-section { display: block !important; }

          /* Each section on its own page */
          .zari-print-page {
            page-break-after: always;
            padding: 32px 48px;
          }
          .zari-print-page:last-child { page-break-after: avoid; }

          /* Section-only padding */
          .zari-print-section { padding: 32px 48px; }

          /* Nice print typography */
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 13px;
            line-height: 1.65;
            color: #111;
            background: white;
          }

          @page { margin: 20mm 18mm; }
        }
      `}</style>
    </div>
  );
}
