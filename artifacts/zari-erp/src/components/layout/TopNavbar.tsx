import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, LogOut, Loader2, ChevronDown } from "lucide-react";

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
  { label: "Style",            href: "/masters/styles" },
];

const TOP_LINKS = [
  { label: "Dashboard",  href: "/dashboard" },
  { label: "Orders",     href: "/orders" },
  { label: "Accounts",   href: "/accounts" },
  { label: "Quotation",  href: "/quotation" },
  { label: "Shipping",   href: "/shipping" },
];

export default function TopNavbar({ username, role, onLogout, isLoggingOut }: TopNavbarProps) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mastersOpen, setMastersOpen] = useState(false);
  const [mobileMastersOpen, setMobileMastersOpen] = useState(false);
  const mastersRef = useRef<HTMLDivElement>(null);

  const mastersActive = location.startsWith("/masters");

  const initials = username
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  useEffect(() => {
    if (!mastersOpen) return;
    const handle = (e: MouseEvent) => {
      if (mastersRef.current && !mastersRef.current.contains(e.target as Node)) {
        setMastersOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [mastersOpen]);

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
            {/* Dashboard */}
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

          {/* RIGHT — User + logout */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-sm font-medium text-gray-900">{username}</span>
              <span className="text-xs text-gray-400 capitalize">{role}</span>
            </div>
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
              style={{ backgroundColor: "#111", color: "#C9B45C" }}
            >
              {initials}
            </div>
            <button
              onClick={onLogout}
              disabled={isLoggingOut}
              title="Sign out"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-gray-200 text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
            >
              {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              <span>Sign Out</span>
            </button>
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

              {/* Masters expand/collapse */}
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
            </nav>
            <button
              onClick={() => { setMobileOpen(false); onLogout(); }}
              disabled={isLoggingOut}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
            >
              {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              Sign Out
            </button>
          </div>
        )}
      </header>
    </>
  );
}
