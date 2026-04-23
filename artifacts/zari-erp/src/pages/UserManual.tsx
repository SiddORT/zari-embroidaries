import { useState, useRef } from "react";
import {
  BookOpen, LayoutDashboard, Users, ShoppingBag, Package, BarChart2,
  Truck, Settings, ChevronRight, Search, Printer, ArrowUp, Star,
  Zap, ClipboardList, Warehouse, ShoppingCart, FileText, CreditCard,
  AlertTriangle, RotateCcw, DollarSign, Receipt, UserCheck, HelpCircle,
  CheckCircle, Info, List, Box, Globe, Lock, Bell, Database, Tag,
  Layers, Hash, Scissors, Send, Eye, PenLine, Trash2, Plus, Download,
  LogIn, Home, ChevronDown,
} from "lucide-react";

const G = "#C6AF4B";

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
  return (
    <div>
      <SectionHeader icon={LayoutDashboard} title="Dashboard" subtitle="Your real-time business overview" />
      <p className="text-sm text-gray-700 mb-4">
        The Dashboard is the first screen you see after logging in. It gives you a live snapshot of your business across all key areas.
      </p>

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
  return (
    <div>
      <SectionHeader icon={Database} title="Masters" subtitle="Core reference data used throughout the system" />
      <p className="text-sm text-gray-700 mb-5">
        Masters are the foundation of the ERP. Before creating orders or invoices, you should set up your clients, vendors, materials, and categories here.
      </p>

      <div id="clients" className="mb-7">
        <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2"><Users className="h-4 w-4" style={{ color: G }} /> Clients</h3>
        <p className="text-sm text-gray-600 mb-3">Client records store all buyer information. Clients are linked to orders, invoices, and packing lists.</p>
        <Step n={1}>Go to <Badge>Masters → Clients</Badge> from the top navigation.</Step>
        <Step n={2}>Click <strong>Add Client</strong> to create a new client record.</Step>
        <Step n={3}>Fill in the Brand Name, Contact Person, Email, Phone, Address, GST number, and any other details.</Step>
        <Step n={4}>Click <strong>Save</strong>. The client is now available when creating orders and invoices.</Step>
        <Tip>You can search, filter, and edit existing clients from the Clients list. Click any row to view the full client profile.</Tip>
      </div>

      <div id="vendors" className="mb-7">
        <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2"><ShoppingBag className="h-4 w-4" style={{ color: G }} /> Vendors</h3>
        <p className="text-sm text-gray-600 mb-3">Vendors are suppliers from whom you purchase materials. They appear in purchase orders and ledgers.</p>
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
  return (
    <div>
      <SectionHeader icon={Zap} title="Swatch Orders" subtitle="Manage embroidery sampling and swatch production orders" />
      <p className="text-sm text-gray-700 mb-4">
        Swatch Orders track sample embroidery orders — small runs done before full production — that clients use to approve designs.
      </p>

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
  return (
    <div>
      <SectionHeader icon={Star} title="Style Orders" subtitle="Full production orders with costing, invoicing, and shipping" />
      <p className="text-sm text-gray-700 mb-4">
        Style Orders are the main production orders. They go through a complete lifecycle: creation → artworks → costing → invoicing → shipping.
      </p>

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
  return (
    <div>
      <SectionHeader icon={DollarSign} title="Accounts & Finance" subtitle="Invoices, payments, ledgers, credit notes, and financial reports" />

      <div id="invoices" className="mb-7">
        <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2"><Receipt className="h-4 w-4" style={{ color: G }} /> Invoices</h3>
        <p className="text-sm text-gray-600 mb-3">Create, view, and manage GST invoices for style orders and other sales.</p>
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
  return (
    <div>
      <SectionHeader icon={Warehouse} title="Inventory" subtitle="Track stock levels, movements, alerts, and adjustments" />

      <div id="inv-dashboard" className="mb-7">
        <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2"><LayoutDashboard className="h-4 w-4" style={{ color: G }} /> Inventory Dashboard</h3>
        <p className="text-sm text-gray-600">Provides a visual overview of total stock value, items near reorder point, and recent stock movements.</p>
        <p className="text-sm text-gray-600 mt-1">Navigate to <Badge>Operations → Inventory → Dashboard</Badge>.</p>
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
  return (
    <div>
      <SectionHeader icon={Truck} title="Logistics" subtitle="Packing lists, package management, and shipment tracking" />

      <div id="packing-lists" className="mb-8">
        <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2"><Box className="h-4 w-4" style={{ color: G }} /> Packing Lists</h3>
        <p className="text-sm text-gray-600 mb-4">
          Packing Lists are the core logistics document. They define how goods are packed into individual packages before dispatch — specifying which products go in which box, with weights and dimensions.
        </p>

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
        <Step n={1}>Go to <Badge>Shipping</Badge> from the top navigation.</Step>
        <Step n={2}>View all shipments with vendor, tracking number, status, and dates.</Step>
        <Step n={3}>Click a shipment to view or edit its details.</Step>
        <Tip>Shipments can be created directly from Swatch Orders, Style Orders, or Packing Lists. All shipments are centralised here for easy tracking.</Tip>
      </div>
    </div>
  );
}

function SettingsContent() {
  return (
    <div>
      <SectionHeader icon={Settings} title="Settings & Administration" subtitle="Configure your profile, manage users, and access reports" />

      <div id="profile" className="mb-7">
        <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2"><UserCheck className="h-4 w-4" style={{ color: G }} /> Profile Settings</h3>
        <p className="text-sm text-gray-600 mb-3">Update your personal details, upload a profile photo, and change your password.</p>
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

export default function UserManual() {
  const [active, setActive] = useState("overview");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  const ActiveContent = CONTENT_MAP[active] ?? OverviewContent;

  const handlePrint = () => window.print();

  const scrollTop = () => contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });

  const filteredSections = search.trim()
    ? SECTIONS.filter(s =>
        s.label.toLowerCase().includes(search.toLowerCase()) ||
        s.subsections?.some(sub => sub.label.toLowerCase().includes(search.toLowerCase()))
      )
    : SECTIONS;

  return (
    <div className="h-screen flex flex-col bg-[#f8f9fb] overflow-hidden print:h-auto print:overflow-visible">

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shrink-0 print:hidden">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: "#111" }}>
            <BookOpen className="h-4 w-4" style={{ color: G }} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900">User Manual</h1>
            <p className="text-xs text-gray-400">ZARI ERP — Complete Guide</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href="/help/print" target="_blank" rel="noopener noreferrer">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              Print Manual
            </button>
          </a>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden print:overflow-visible">

        {/* Left sidebar */}
        <div className="w-56 shrink-0 bg-white border-r border-gray-100 flex flex-col overflow-hidden print:hidden">
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
        <div ref={contentRef} className="flex-1 overflow-y-auto p-8 print:p-4">
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 print:shadow-none print:border-0">
              <ActiveContent />
            </div>

            {/* Back to top */}
            <div className="flex justify-end mt-4 print:hidden">
              <button
                onClick={scrollTop}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowUp className="h-3.5 w-3.5" />
                Back to top
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
