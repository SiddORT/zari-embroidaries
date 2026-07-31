import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, LogOut, Loader2, ChevronDown, Users, Settings, BarChart2 } from "lucide-react";
import zariLogo from "@assets/zari-symbol_1779781911897.png";
import { useMyPermissions } from "@/hooks/useMyPermissions";

interface TopNavbarProps {
  username?: string;
  role?: string;
  onLogout?: () => void;
  isLoggingOut?: boolean;
}

const MASTERS_ITEMS = [
  { label: "HSN",               href: "/masters/hsn" },
  { label: "Materials",         href: "/masters/materials" },
  { label: "Fabric",            href: "/masters/fabric" },
  { label: "Clients",           href: "/masters/clients" },
  { label: "Vendors",           href: "/masters/vendors" },
  { label: "Style Categories",  href: "/masters/style-categories" },
  { label: "Swatch Categories", href: "/masters/swatch-categories" },
  { label: "Swatch",            href: "/masters/swatches" },
  { label: "Style",             href: "/masters/styles" },
  { label: "Item Types",        href: "/masters/item-types" },
  { label: "Item Master",       href: "/masters/items" },
  { label: "Department",        href: "/masters/departments" },
  { label: "Unit Type",         href: "/masters/unit-types" },
  { label: "Shipping Vendors",  href: "/masters/shipping-vendors" },
];

const ORDERS_ITEMS = [
  { label: "Swatch Orders", href: "/swatch-orders" },
  { label: "Style Orders",  href: "/style-orders" },
];

const OPERATIONS_SECTIONS = [
  {
    title: "Inventory",
    items: [
      { label: "Dashboard",         href: "/inventory/dashboard" },
      { label: "Item Stock List",   href: "/inventory/items" },
      { label: "Low Stock Alerts",  href: "/inventory/low-stock-alerts" },
      { label: "Stock Ledger",      href: "/inventory/ledger" },
      { label: "Reservations",      href: "/inventory/reservations" },
      { label: "Stock Adjustments", href: "/inventory/adjustments" },
    ],
  },
  {
    title: "Procurement",
    items: [
      { label: "Vendor Challans",   href: "/procurement/vendor-challans" },
      { label: "Purchase Orders",   href: "/procurement/purchase-orders" },
      { label: "Purchase Receipts", href: "/procurement/purchase-receipts" },
    ],
  },
];

const LOGISTICS_ITEMS = [
  { label: "Shipments",     href: "/shipping" },
  { label: "Packing Lists", href: "/logistics/packing-lists" },
];

const ACCOUNTS_ITEMS = [
  { label: "Dashboard",            href: "/accounts/dashboard" },
  { label: "Ledgers",              href: "/accounts/ledgers" },
  { label: "Purchases",            href: "/accounts/purchases" },
  { label: "Sales",                href: "/accounts/sales" },
  { label: "Invoices",             href: "/accounts/invoices" },
  { label: "Payments",             href: "/accounts/payments" },
  { label: "Credit / Debit Notes", href: "/accounts/credit-debit-notes" },
  { label: "Other Expenses",       href: "/accounts/other-expenses" },
];

const HREF_PERMISSION_MAP: Record<string, string> = {
  "/dashboard": "dashboard",
  "/masters/hsn": "masters:hsn",
  "/masters/materials": "masters:materials",
  "/masters/fabric": "masters:fabric",
  "/masters/clients": "masters:clients",
  "/masters/vendors": "masters:vendors",
  "/masters/style-categories": "masters:style_categories",
  "/masters/swatch-categories": "masters:swatch_categories",
  "/masters/swatches": "masters:swatches",
  "/masters/styles": "masters:styles",
  "/masters/item-types": "masters:item_types",
  "/masters/items": "masters:items",
  "/masters/departments": "masters:departments",
  "/masters/unit-types": "masters:unit_types",
  "/masters/shipping-vendors": "masters:shipping_vendors",
  "/masters/packaging-materials": "masters:packaging_materials",

  "/orders": "orders",
  "/swatch-orders": "swatch_orders",
  "/style-orders": "style_orders",

  "/inventory/dashboard": "stock:dashboard",
  "/inventory/items": "stock:items",
  "/inventory/low-stock-alerts": "stock:low_stock",
  "/inventory/ledger": "stock:ledger",
  "/inventory/reservations": "stock:reservations",
  "/inventory/adjustments": "stock:adjustments",

  "/procurement/vendor-challans": "procurement:vendor_challans",
  "/procurement/purchase-orders": "stock:purchase_orders",
  "/procurement/purchase-receipts": "stock:purchase_receipts",

  "/shipping": "logistics:shipments",
  "/logistics/packing-lists": "logistics:packing_lists",

  "/accounts": "accounts:dashboard",
  "/accounts/dashboard": "accounts:dashboard",
  "/accounts/ledgers": "accounts:vendor_ledgers",
  "/accounts/invoices": "accounts:invoices",
  "/accounts/payments": "accounts:payments",
  "/accounts/credit-debit-notes": "accounts:credit_debit_notes",
  "/accounts/purchases": "accounts:purchases",
  "/accounts/sales": "accounts:sales",
  "/accounts/other-expenses": "accounts:other_expenses",

  "/user-management": "user_management",
  "/settings/reports": "reports",
  "/settings": "settings",
  "/quotation": "quotation",
};

const ALL_OPERATIONS_HREFS = OPERATIONS_SECTIONS.flatMap(s => s.items.map(i => i.href));

type ProfileSnapshot = { name: string; email: string; role: string; photo: string | null };
let cachedProfile: ProfileSnapshot | null = null;
let cachedProfileToken: string | null = null;
const profileSubscribers = new Set<(p: ProfileSnapshot | null) => void>();
let profileFetchInFlight: Promise<void> | null = null;
let profileFetchToken: string | null = null;

function currentToken(): string | null {
  try { return localStorage.getItem("zarierp_token"); } catch { return null; }
}

function fetchProfileOnce(fallbackName: string, fallbackRole: string): Promise<void> {
  const token = currentToken();
  if (profileFetchInFlight && profileFetchToken === token) return profileFetchInFlight;
  profileFetchToken = token;
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  profileFetchInFlight = fetch(`${base}/api/settings/profile`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
    .then(r => r.ok ? r.json() : null)
    .then(j => {
      if (currentToken() !== token) return;
      if (j?.data) {
        const snap: ProfileSnapshot = {
          name:  j.data.username     ?? fallbackName,
          email: j.data.email        ?? "",
          role:  j.data.role         ?? fallbackRole,
          photo: j.data.profile_photo ?? null,
        };
        cachedProfile = snap;
        cachedProfileToken = token;
        profileSubscribers.forEach(fn => fn(snap));
      }
    })
    .catch(() => {})
    .finally(() => { profileFetchInFlight = null; profileFetchToken = null; });
  return profileFetchInFlight;
}

export function invalidateTopNavbarProfile(): void {
  cachedProfile = null;
  cachedProfileToken = null;
  profileSubscribers.forEach(fn => fn(null));
}

function readFreshCache(): ProfileSnapshot | null {
  if (cachedProfile && cachedProfileToken === currentToken()) return cachedProfile;
  if (cachedProfile) {
    cachedProfile = null;
    cachedProfileToken = null;
  }
  return null;
}

export default function TopNavbar({ username = "", role = "", onLogout = () => {}, isLoggingOut = false }: TopNavbarProps) {
  const [location] = useLocation();
  const { can } = useMyPermissions();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mastersOpen, setMastersOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [operationsOpen, setOperationsOpen] = useState(false);
  const [logisticsOpen, setLogisticsOpen] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [mobileMastersOpen, setMobileMastersOpen] = useState(false);
  const [mobileOrdersOpen, setMobileOrdersOpen] = useState(false);
  const [mobileOperationsOpen, setMobileOperationsOpen] = useState(false);
  const [mobileLogisticsOpen, setMobileLogisticsOpen] = useState(false);
  const [mobileAccountsOpen, setMobileAccountsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const [profileData, setProfileData] = useState<ProfileSnapshot | null>(readFreshCache());

  useEffect(() => {
    const sub = (p: ProfileSnapshot | null) => setProfileData(p);
    profileSubscribers.add(sub);
    if (!readFreshCache()) {
      setProfileData(null);
      fetchProfileOnce(username, role);
    }
    return () => { profileSubscribers.delete(sub); };
  }, [username, role]);

  const displayName  = profileData?.name  ?? username;
  const displayEmail = profileData?.email ?? "";
  const displayRole  = profileData?.role  ?? role;
  const displayPhoto = profileData?.photo ?? null;

  const mastersRef    = useRef<HTMLDivElement>(null);
  const ordersRef     = useRef<HTMLDivElement>(null);
  const operationsRef = useRef<HTMLDivElement>(null);
  const logisticsRef  = useRef<HTMLDivElement>(null);
  const accountsRef   = useRef<HTMLDivElement>(null);
  const profileRef    = useRef<HTMLDivElement>(null);

  // Filter menu items by user permissions
  const visibleMastersItems = MASTERS_ITEMS.filter(item => can(HREF_PERMISSION_MAP[item.href] || item.href));
  const visibleOrdersItems = ORDERS_ITEMS.filter(item => can(HREF_PERMISSION_MAP[item.href] || item.href));
  const visibleOperationsSections = OPERATIONS_SECTIONS.map(section => ({
    ...section,
    items: section.items.filter(item => can(HREF_PERMISSION_MAP[item.href] || item.href)),
  })).filter(section => section.items.length > 0);
  const visibleLogisticsItems = LOGISTICS_ITEMS.filter(item => can(HREF_PERMISSION_MAP[item.href] || item.href));
  const visibleAccountsItems = ACCOUNTS_ITEMS.filter(item => can(HREF_PERMISSION_MAP[item.href] || item.href));
  const mastersActive    = location.startsWith("/masters");
  const ordersActive     = ORDERS_ITEMS.some(i => location === i.href || location.startsWith(i.href + "/"));
  const operationsActive = ALL_OPERATIONS_HREFS.some(h => location === h || location.startsWith(h + "/"));
  const logisticsActive  = location.startsWith("/shipping") || location.startsWith("/logistics");
  const accountsActive   = location.startsWith("/accounts");
  const reportsActive    = location.startsWith("/settings/reports");

  const initials = (displayName || displayEmail || "")
    .split(/[\s@]/)
    .map((w: string) => w[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2) || "…";

  useEffect(() => {
    if (!mastersOpen) return;
    const h = (e: MouseEvent) => { if (mastersRef.current && !mastersRef.current.contains(e.target as Node)) setMastersOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, [mastersOpen]);

  useEffect(() => {
    if (!ordersOpen) return;
    const h = (e: MouseEvent) => { if (ordersRef.current && !ordersRef.current.contains(e.target as Node)) setOrdersOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, [ordersOpen]);

  useEffect(() => {
    if (!operationsOpen) return;
    const h = (e: MouseEvent) => { if (operationsRef.current && !operationsRef.current.contains(e.target as Node)) setOperationsOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, [operationsOpen]);

  useEffect(() => {
    if (!logisticsOpen) return;
    const h = (e: MouseEvent) => { if (logisticsRef.current && !logisticsRef.current.contains(e.target as Node)) setLogisticsOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, [logisticsOpen]);

  useEffect(() => {
    if (!accountsOpen) return;
    const h = (e: MouseEvent) => { if (accountsRef.current && !accountsRef.current.contains(e.target as Node)) setAccountsOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, [accountsOpen]);

  useEffect(() => {
    if (!profileOpen) return;
    const h = (e: MouseEvent) => { if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, [profileOpen]);

  const navLink = (active: boolean) =>
    `px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
      active ? "bg-gray-900 text-[#C9B45C]" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
    }`;

  return (
    <>
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
        <div className="flex items-center justify-between h-16 px-6 max-w-screen-2xl mx-auto">

          {/* LEFT — Brand */}
          <Link href="/dashboard" className="flex items-center gap-2.5 leading-none select-none shrink-0 mr-4">
            <img
              src={zariLogo}
              alt="Zari Embroideries"
              className="h-9 w-auto object-contain"
            />
            <span className="flex flex-col leading-none">
              <span className="text-base font-bold tracking-widest uppercase" style={{ color: "#C9B45C", letterSpacing: "0.18em" }}>
                ZARI
              </span>
              <span className="text-[9px] font-medium tracking-[0.25em] text-gray-400 uppercase">
                EMBROIDERIES
              </span>
            </span>
          </Link>

          {/* CENTER — Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5 flex-1 justify-end">

            {/* Dashboard */}
            {can("dashboard") && (
              <Link href="/dashboard" className={navLink(location === "/dashboard")}>
                Dashboard
              </Link>
            )}

            {/* Masters */}
            {visibleMastersItems.length > 0 && (
              <div className="relative" ref={mastersRef}>
                <button
                  onClick={() => setMastersOpen(v => !v)}
                  className={`flex items-center gap-1 ${navLink(mastersActive)}`}
                >
                  Masters
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${mastersOpen ? "rotate-180" : ""}`} />
                </button>
                {mastersOpen && (
                  <div className="absolute top-full left-0 mt-1.5 w-80 bg-white border border-gray-200 rounded-xl shadow-lg p-1.5 z-50 grid grid-cols-2 gap-0.5">
                    {visibleMastersItems.map(({ label, href }) => {
                      const active = location === href || (href === "/masters/hsn" && location === "/masters");
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setMastersOpen(false)}
                          className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                            active ? "text-gray-900 bg-gray-50 font-semibold" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                          }`}
                        >
                          {label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Orders */}
            {visibleOrdersItems.length > 0 && (
              <div className="relative" ref={ordersRef}>
                <button
                  onClick={() => setOrdersOpen(v => !v)}
                  className={`flex items-center gap-1 ${navLink(ordersActive)}`}
                >
                  Orders
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${ordersOpen ? "rotate-180" : ""}`} />
                </button>
                {ordersOpen && (
                  <div className="absolute top-full left-0 mt-1.5 w-48 bg-white border border-gray-200 rounded-xl shadow-lg p-1.5 z-50">
                    {visibleOrdersItems.map(({ label, href }) => {
                      const active = location === href || location.startsWith(href + "/");
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setOrdersOpen(false)}
                          className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                            active ? "text-gray-900 bg-gray-50 font-semibold" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                          }`}
                        >
                          {label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Operations / Stock */}
            {visibleOperationsSections.length > 0 && (
              <div className="relative" ref={operationsRef}>
                <button
                  onClick={() => setOperationsOpen(v => !v)}
                  className={`flex items-center gap-1 ${navLink(operationsActive)}`}
                >
                  Stock
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${operationsOpen ? "rotate-180" : ""}`} />
                </button>
                {operationsOpen && (
                  <div className="absolute top-full left-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-3 grid grid-cols-2 gap-x-6 gap-y-0 min-w-[320px]">
                    {visibleOperationsSections.map(({ title, items }) => (
                      <div key={title}>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-2 pb-1.5 pt-0.5">
                          {title}
                        </p>
                        {items.map(({ label, href }) => {
                          const active = location === href || location.startsWith(href + "/");
                          return (
                            <Link
                              key={href}
                              href={href}
                              onClick={() => setOperationsOpen(false)}
                              className={`block px-2 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                                active ? "text-gray-900 bg-gray-50 font-semibold" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                              }`}
                            >
                              {label}
                            </Link>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Quotation */}
            {can("quotation") && (
              <Link href="/quotation" className={navLink(location === "/quotation" || location.startsWith("/quotation/"))}>
                Quotation
              </Link>
            )}

            {/* Logistics */}
            {visibleLogisticsItems.length > 0 && (
              <div className="relative" ref={logisticsRef}>
                <button
                  onClick={() => setLogisticsOpen(v => !v)}
                  className={`flex items-center gap-1 ${navLink(logisticsActive)}`}
                >
                  Logistics
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${logisticsOpen ? "rotate-180" : ""}`} />
                </button>
                {logisticsOpen && (
                  <div className="absolute top-full left-0 mt-1.5 w-48 bg-white border border-gray-200 rounded-xl shadow-lg p-1.5 z-50">
                    {visibleLogisticsItems.map(({ label, href }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setLogisticsOpen(false)}
                        className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                          location === href || location.startsWith(href + "/")
                            ? "text-gray-900 bg-gray-50 font-semibold"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        }`}
                      >
                        {label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Accounts */}
            {visibleAccountsItems.length > 0 && (
              <div className="relative" ref={accountsRef}>
                <button
                  onClick={() => setAccountsOpen(v => !v)}
                  className={`flex items-center gap-1 ${navLink(accountsActive)}`}
                >
                  Accounts
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${accountsOpen ? "rotate-180" : ""}`} />
                </button>
                {accountsOpen && (
                  <div className="absolute top-full left-0 mt-1.5 w-80 bg-white border border-gray-200 rounded-xl shadow-lg p-1.5 z-50 grid grid-cols-2 gap-0.5">
                    {visibleAccountsItems.map(({ label, href }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setAccountsOpen(false)}
                        className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                          location === href || location.startsWith(href + "/")
                            ? "text-gray-900 bg-gray-50 font-semibold"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        }`}
                      >
                        {label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Reports */}
            {can("reports") && (
              <Link href="/settings/reports" className={navLink(reportsActive)}>
                Reports
              </Link>
            )}

          </nav>

          {/* RIGHT — Profile dropdown */}
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(v => !v)}
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold overflow-hidden"
                  style={{ backgroundColor: "#111", color: "#C9B45C" }}
                >
                  {displayPhoto
                    ? <img src={displayPhoto} alt={displayName} className="h-full w-full object-cover" />
                    : initials}
                </div>
                <div className="hidden sm:flex flex-col items-start leading-tight">
                  <span className="text-sm font-medium text-gray-900">{displayEmail || displayName}</span>
                  <span className="text-xs text-gray-400 capitalize">{displayRole}</span>
                </div>
                <ChevronDown className={`hidden sm:block h-3.5 w-3.5 text-gray-400 transition-transform ${profileOpen ? "rotate-180" : ""}`} />
              </button>

              {profileOpen && (
                <div className="absolute top-full right-0 mt-2 w-60 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold overflow-hidden"
                      style={{ backgroundColor: "#111", color: "#C9B45C" }}
                    >
                      {displayPhoto
                        ? <img src={displayPhoto} alt={displayName} className="h-full w-full object-cover" />
                        : initials}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-gray-900 truncate">{displayName || "User"}</span>
                      {displayEmail && <span className="text-xs text-gray-500 truncate">{displayEmail}</span>}
                      <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded w-max mt-1 capitalize">
                        {displayRole || "Role"}
                      </span>
                    </div>
                  </div>

                  <div className="p-1">
                    {can("settings") && (
                      <Link
                        href="/settings"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <Settings className="h-4 w-4 text-gray-400" />
                        Settings
                      </Link>
                    )}
                    {can("user_management") && (
                      <Link
                        href="/user-management"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <Users className="h-4 w-4 text-gray-400" />
                        User Management
                      </Link>
                    )}
                  </div>

                  <div className="p-1 border-t border-gray-100">
                    <button
                      onClick={() => { setProfileOpen(false); onLogout(); }}
                      disabled={isLoggingOut}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      {isLoggingOut
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <LogOut className="h-4 w-4 text-red-500" />}
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile menu hamburger button */}
            <button
              onClick={() => setMobileOpen(v => !v)}
              className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* MOBILE menu */}
        {mobileOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-4 pb-4 pt-2 shadow-md">
            <nav className="flex flex-col gap-1 mb-3">

              {/* Dashboard */}
              {can("dashboard") && (
                <Link
                  href="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    location === "/dashboard" ? "bg-gray-900 text-[#C9B45C]" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  Dashboard
                </Link>
              )}

              {/* Mobile Masters */}
              {visibleMastersItems.length > 0 && (
                <>
                  <button
                    onClick={() => setMobileMastersOpen(v => !v)}
                    className={`flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full text-left ${
                      mastersActive ? "bg-gray-900 text-[#C9B45C]" : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    Masters
                    <ChevronDown className={`h-4 w-4 transition-transform ${mobileMastersOpen ? "rotate-180" : ""}`} />
                  </button>
                  {mobileMastersOpen && (
                    <div className="ml-4 flex flex-col gap-0.5 border-l-2 border-gray-100 pl-3">
                      {visibleMastersItems.map(({ label, href }) => (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setMobileOpen(false)}
                          className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                            location === href ? "text-gray-900 font-semibold" : "text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          {label}
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Mobile Orders */}
              {visibleOrdersItems.length > 0 && (
                <>
                  <button
                    onClick={() => setMobileOrdersOpen(v => !v)}
                    className={`flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full text-left ${
                      ordersActive ? "bg-gray-900 text-[#C9B45C]" : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <span>Orders</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${mobileOrdersOpen ? "rotate-180" : ""}`} />
                  </button>
                  {mobileOrdersOpen && (
                    <div className="ml-4 flex flex-col gap-0.5 border-l-2 border-gray-100 pl-3">
                      {visibleOrdersItems.map(({ label, href }) => (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setMobileOpen(false)}
                          className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                            location === href ? "text-gray-900 font-semibold" : "text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          {label}
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Mobile Operations */}
              {visibleOperationsSections.length > 0 && (
                <>
                  <button
                    onClick={() => setMobileOperationsOpen(v => !v)}
                    className={`flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full text-left ${
                      operationsActive ? "bg-gray-900 text-[#C9B45C]" : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <span>Stock</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${mobileOperationsOpen ? "rotate-180" : ""}`} />
                  </button>
                  {mobileOperationsOpen && (
                    <div className="ml-4 flex flex-col gap-2 border-l-2 border-gray-100 pl-3 pt-1">
                      {visibleOperationsSections.map(({ title, items }) => (
                        <div key={title}>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-3 pb-1">{title}</p>
                          {items.map(({ label, href }) => (
                            <Link
                              key={href}
                              href={href}
                              onClick={() => setMobileOpen(false)}
                              className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                                location === href ? "text-gray-900 font-semibold" : "text-gray-600 hover:bg-gray-50"
                              }`}
                            >
                              {label}
                            </Link>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Quotation */}
              {can("quotation") && (
                <Link
                  href="/quotation"
                  onClick={() => setMobileOpen(false)}
                  className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    location === "/quotation" || location.startsWith("/quotation/") ? "bg-gray-900 text-[#C9B45C]" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  Quotation
                </Link>
              )}

              {/* Mobile Logistics */}
              {visibleLogisticsItems.length > 0 && (
                <>
                  <button
                    onClick={() => setMobileLogisticsOpen(v => !v)}
                    className={`flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full text-left ${
                      logisticsActive ? "bg-gray-900 text-[#C9B45C]" : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <span>Logistics</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${mobileLogisticsOpen ? "rotate-180" : ""}`} />
                  </button>
                  {mobileLogisticsOpen && (
                    <div className="ml-4 flex flex-col gap-0.5 border-l-2 border-gray-100 pl-3">
                      {visibleLogisticsItems.map(({ label, href }) => (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setMobileOpen(false)}
                          className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                            location === href || location.startsWith(href + "/") ? "text-gray-900 font-semibold" : "text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          {label}
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Mobile Accounts */}
              {visibleAccountsItems.length > 0 && (
                <>
                  <button
                    onClick={() => setMobileAccountsOpen(v => !v)}
                    className={`flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full text-left ${
                      accountsActive ? "bg-gray-900 text-[#C9B45C]" : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <span>Accounts</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${mobileAccountsOpen ? "rotate-180" : ""}`} />
                  </button>
                  {mobileAccountsOpen && (
                    <div className="ml-4 flex flex-col gap-0.5 border-l-2 border-gray-100 pl-3">
                      {visibleAccountsItems.map(({ label, href }) => (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setMobileOpen(false)}
                          className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                            location === href || location.startsWith(href + "/") ? "text-gray-900 font-semibold" : "text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          {label}
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Mobile Reports */}
              {can("reports") && (
                <Link
                  href="/settings/reports"
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    reportsActive ? "bg-gray-900 text-[#C9B45C]" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <BarChart2 className="h-4 w-4" />
                  Reports
                </Link>
              )}

              <div className="mt-2 border-t border-gray-100 pt-2 flex flex-col gap-1">
                {can("settings") && (
                  <Link href="/settings" onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    <Settings className="h-4 w-4 text-gray-400" /> Settings
                  </Link>
                )}
                {can("user_management") && (
                  <Link href="/user-management" onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    <Users className="h-4 w-4 text-gray-400" /> User Management
                  </Link>
                )}
                <button
                  onClick={() => { setMobileOpen(false); onLogout(); }}
                  disabled={isLoggingOut}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors text-left disabled:opacity-50"
                >
                  {isLoggingOut
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <LogOut className="h-4 w-4" />}
                  Sign Out
                </button>
              </div>
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
