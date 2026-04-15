import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, LogOut, Loader2, ChevronDown, User, Users } from "lucide-react";

interface TopNavbarProps {
  username: string;
  role: string;
  onLogout: () => void;
  isLoggingOut: boolean;
}

const MASTERS_ITEMS = [
  { label: "HSN",              href: "/masters/hsn" },
  { label: "Materials",        href: "/masters/materials" },
  { label: "Fabric",           href: "/masters/fabric" },
  { label: "Clients",          href: "/masters/clients" },
  { label: "Vendors",          href: "/masters/vendors" },
  { label: "Style Categories",  href: "/masters/style-categories" },
  { label: "Swatch Categories", href: "/masters/swatch-categories" },
  { label: "Swatch",            href: "/masters/swatches" },
  { label: "Style",             href: "/masters/styles" },
  { label: "Item Master",       href: "/masters/packaging-materials" },
];

const OTHER_ORDERS_ITEMS = [
  { label: "Swatch Orders", href: "/swatch-orders" },
  { label: "Style Orders",  href: "/style-orders" },
];

const TOP_LINKS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Accounts",  href: "/accounts" },
  { label: "Quotation", href: "/quotation" },
  { label: "Shipping",  href: "/shipping" },
];

export default function TopNavbar({ username, role, onLogout, isLoggingOut }: TopNavbarProps) {
  const [location, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mastersOpen, setMastersOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [mobileMastersOpen, setMobileMastersOpen] = useState(false);
  const [mobileOrdersOpen, setMobileOrdersOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const mastersRef = useRef<HTMLDivElement>(null);
  const ordersRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const mastersActive = location.startsWith("/masters");
  const ordersActive = OTHER_ORDERS_ITEMS.some(i => location === i.href || location.startsWith(i.href + "/"));

  const initials = (username ?? "")
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2) || "…";

  useEffect(() => {
    if (!mastersOpen) return;
    const handle = (e: MouseEvent) => {
      if (mastersRef.current && !mastersRef.current.contains(e.target as Node)) setMastersOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [mastersOpen]);

  useEffect(() => {
    if (!ordersOpen) return;
    const handle = (e: MouseEvent) => {
      if (ordersRef.current && !ordersRef.current.contains(e.target as Node)) setOrdersOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [ordersOpen]);

  useEffect(() => {
    if (!profileOpen) return;
    const handle = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [profileOpen]);

  return (
    <>
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
        <div className="flex items-center justify-between h-16 px-6 max-w-screen-2xl mx-auto">

          {/* LEFT — Brand */}
          <Link href="/dashboard" className="flex flex-col leading-none select-none">
            <span className="text-base font-bold tracking-widest uppercase" style={{ color: "#C9B45C", letterSpacing: "0.18em" }}>
              ZARI
            </span>
            <span className="text-[9px] font-medium tracking-[0.25em] text-gray-400 uppercase">
              EMBROIDERIES
            </span>
          </Link>

          {/* CENTER — Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              href="/dashboard"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                location === "/dashboard"
                  ? "bg-gray-900 text-[#C9B45C]"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              Dashboard
            </Link>

            {/* Masters dropdown */}
            <div className="relative" ref={mastersRef}>
              <button
                onClick={() => setMastersOpen((v) => !v)}
                className={`flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  mastersActive
                    ? "bg-gray-900 text-[#C9B45C]"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
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
                          active
                            ? "text-gray-900 bg-gray-50 font-semibold"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        }`}
                      >
                        {label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Other Orders dropdown */}
            <div className="relative" ref={ordersRef}>
              <button
                onClick={() => setOrdersOpen((v) => !v)}
                className={`flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  ordersActive
                    ? "bg-gray-900 text-[#C9B45C]"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                Orders
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${ordersOpen ? "rotate-180" : ""}`} />
              </button>

              {ordersOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-52 bg-white border border-gray-200 rounded-xl shadow-lg p-1.5 z-50">
                  {OTHER_ORDERS_ITEMS.map(({ label, href }) => {
                    const active = location === href || location.startsWith(href + "/");
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setOrdersOpen(false)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                          active
                            ? "text-gray-900 bg-gray-50 font-semibold"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        }`}
                      >
                        {label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Other top links */}
            {TOP_LINKS.filter((l) => l.href !== "/dashboard").map(({ label, href }) => {
              const active = location === href || location.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-gray-900 text-[#C9B45C]"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* RIGHT — Profile dropdown */}
          <div className="flex items-center gap-2">
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen((v) => !v)}
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                  style={{ backgroundColor: "#111", color: "#C9B45C" }}
                >
                  {initials}
                </div>
                <div className="hidden sm:flex flex-col items-start leading-tight">
                  <span className="text-sm font-medium text-gray-900">{username}</span>
                  <span className="text-xs text-gray-400 capitalize">{role}</span>
                </div>
                <ChevronDown className={`hidden sm:block h-3.5 w-3.5 text-gray-400 transition-transform ${profileOpen ? "rotate-180" : ""}`} />
              </button>

              {profileOpen && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <p className="text-sm font-semibold text-gray-900 truncate">{username}</p>
                    <p className="text-xs text-gray-400 capitalize">{role}</p>
                  </div>
                  <div className="p-1">
                    <button
                      onClick={() => { setProfileOpen(false); navigate("/profile"); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors text-left"
                    >
                      <User className="h-4 w-4 text-gray-400 shrink-0" />
                      Profile
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
              onClick={() => setMobileOpen((v) => !v)}
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
                onClick={() => setMobileMastersOpen((v) => !v)}
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

              {/* Mobile Other Orders */}
              <button
                onClick={() => setMobileOrdersOpen((v) => !v)}
                className={`flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full text-left ${
                  ordersActive ? "bg-gray-900 text-[#C9B45C]" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span>Orders</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${mobileOrdersOpen ? "rotate-180" : ""}`} />
              </button>
              {mobileOrdersOpen && (
                <div className="ml-4 flex flex-col gap-0.5 border-l-2 border-gray-100 pl-3">
                  {OTHER_ORDERS_ITEMS.map(({ label, href }) => (
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

              {TOP_LINKS.filter((l) => l.href !== "/dashboard").map(({ label, href }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    location === href ? "bg-gray-900 text-[#C9B45C]" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {label}
                </Link>
              ))}

              <div className="mt-2 border-t border-gray-100 pt-2 flex flex-col gap-1">
                <Link href="/profile" onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <User className="h-4 w-4 text-gray-400" /> Profile
                </Link>
                <Link href="/user-management" onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <Users className="h-4 w-4 text-gray-400" /> User Management
                </Link>
                <button
                  onClick={() => { setMobileOpen(false); onLogout(); }}
                  disabled={isLoggingOut}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
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
