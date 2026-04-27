import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, LogOut, Loader2, ChevronDown, Users, Settings, BarChart2, BookOpen } from "lucide-react";

interface TopNavbarProps {
  username: string;
  role: string;
  onLogout: () => void;
  isLoggingOut: boolean;
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
      { label: "Purchase Orders",   href: "/procurement/purchase-orders" },
      { label: "Purchase Receipts", href: "/procurement/purchase-receipts" },
    ],
  },
];

const ALL_OPERATIONS_HREFS = OPERATIONS_SECTIONS.flatMap(s => s.items.map(i => i.href));

export default function TopNavbar({ username, role, onLogout, isLoggingOut }: TopNavbarProps) {
  const [location, navigate] = useLocation();
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

  const [profileData, setProfileData] = useState<{ name: string; email: string; role: string; photo: string | null } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("zarierp_token");
    const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
    fetch(`${base}/api/settings/profile`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (j?.data) setProfileData({
          name:  j.data.username     ?? username,
          email: j.data.email        ?? "",
          role:  j.data.role         ?? role,
          photo: j.data.profile_photo ?? null,
        });
      })
      .catch(() => {});
  }, []);

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
          <Link href="/dashboard" className="flex flex-col leading-none select-none shrink-0 mr-4">
            <span className="text-base font-bold tracking-widest uppercase" style={{ color: "#C9B45C", letterSpacing: "0.18em" }}>
              ZARI
            </span>
            <span className="text-[9px] font-medium tracking-[0.25em] text-gray-400 uppercase">
              EMBROIDERIES
            </span>
          </Link>

          {/* CENTER — Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5 flex-1 justify-end">

            {/* Dashboard */}
            <Link href="/dashboard" className={navLink(location === "/dashboard")}>
              Dashboard
            </Link>

            {/* Masters */}
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
                  {MASTERS_ITEMS.map(({ label, href }) => {
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

            {/* Orders */}
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
                  {ORDERS_ITEMS.map(({ label, href }) => {
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

            {/* Operations — mega dropdown with sections */}
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
                  {OPERATIONS_SECTIONS.map(({ title, items }) => (
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

            {/* Quotation — direct link */}
            <Link href="/quotation" className={navLink(location === "/quotation" || location.startsWith("/quotation/"))}>
              Quotation
            </Link>

            {/* Logistics — dropdown */}
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
                  {[
                    { label: "Shipments",     href: "/shipping" },
                    { label: "Packing Lists", href: "/logistics/packing-lists" },
                  ].map(({ label, href }) => (
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

            {/* Accounts — dropdown */}
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
                  {[
                    { label: "Dashboard",            href: "/accounts/dashboard" },
                    { label: "Ledgers",              href: "/accounts/ledgers" },
                    { label: "Purchases",            href: "/accounts/purchases" },
                    { label: "Sales",                href: "/accounts/sales" },
                    { label: "Invoices",             href: "/accounts/invoices" },
                    { label: "Payments",             href: "/accounts/payments" },
                    { label: "Credit / Debit Notes", href: "/accounts/credit-debit-notes" },
                    { label: "Other Expenses",       href: "/accounts/other-expenses" },

                  ].map(({ label, href }) => (
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

            {/* Reports — direct link */}
            <Link href="/settings/reports" className={navLink(reportsActive)}>
              Reports
            </Link>

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
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                      {displayEmail && <p className="text-xs text-gray-500 truncate">{displayEmail}</p>}
                      <p className="text-xs text-gray-400 capitalize">{displayRole}</p>
                    </div>
                  </div>
                  <div className="p-1">
                    <button
                      onClick={() => { setProfileOpen(false); navigate("/settings"); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors text-left"
                    >
                      <Settings className="h-4 w-4 text-gray-400 shrink-0" />
                      Settings
                    </button>
                    <button
                      onClick={() => { setProfileOpen(false); navigate("/help"); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors text-left"
                    >
                      <BookOpen className="h-4 w-4 text-gray-400 shrink-0" />
                      User Manual
                    </button>
                    <button
                      onClick={() => { setProfileOpen(false); navigate("/user-management"); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors text-left"
                    >
                      <Users className="h-4 w-4 text-gray-400 shrink-0" />
                      User Management
                    </button>
                    <div className="my-1 border-t border-gray-100" />
                    <button
                      onClick={() => { setProfileOpen(false); onLogout(); }}
                      disabled={isLoggingOut}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors text-left disabled:opacity-50"
                    >
                      {isLoggingOut
                        ? <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                        : <LogOut className="h-4 w-4 shrink-0" />}
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileOpen(v => !v)}
              className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Toggle menu"
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
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  location === "/dashboard" ? "bg-gray-900 text-[#C9B45C]" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                Dashboard
              </Link>

              {/* Mobile Masters */}
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
                  {MASTERS_ITEMS.map(({ label, href }) => (
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

              {/* Mobile Orders */}
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
                  {ORDERS_ITEMS.map(({ label, href }) => (
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

              {/* Mobile Operations */}
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
                  {OPERATIONS_SECTIONS.map(({ title, items }) => (
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

              {/* Quotation — direct link */}
              <Link
                href="/quotation"
                onClick={() => setMobileOpen(false)}
                className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  location === "/quotation" || location.startsWith("/quotation/") ? "bg-gray-900 text-[#C9B45C]" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                Quotation
              </Link>

              {/* Mobile Logistics */}
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
                  {[
                    { label: "Shipments",     href: "/shipping" },
                    { label: "Packing Lists", href: "/logistics/packing-lists" },
                  ].map(({ label, href }) => (
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

              {/* Mobile Accounts */}
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
                  {[
                    { label: "Dashboard",            href: "/accounts/dashboard" },
                    { label: "Ledgers",              href: "/accounts/ledgers" },
                    { label: "Purchases",            href: "/accounts/purchases" },
                    { label: "Sales",                href: "/accounts/sales" },
                    { label: "Invoices",             href: "/accounts/invoices" },
                    { label: "Payments",             href: "/accounts/payments" },
                    { label: "Credit / Debit Notes", href: "/accounts/credit-debit-notes" },
                    { label: "Other Expenses",       href: "/accounts/other-expenses" },

                  ].map(({ label, href }) => (
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

              {/* Mobile Reports */}
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

              <div className="mt-2 border-t border-gray-100 pt-2 flex flex-col gap-1">
                <Link href="/settings" onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <Settings className="h-4 w-4 text-gray-400" /> Settings
                </Link>
                <Link href="/user-management" onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <Users className="h-4 w-4 text-gray-400" /> User Management
                </Link>
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
