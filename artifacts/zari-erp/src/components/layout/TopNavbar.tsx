import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, LogOut, Loader2 } from "lucide-react";

interface TopNavbarProps {
  username: string;
  role: string;
  onLogout: () => void;
  isLoggingOut: boolean;
}

const navLinks = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Masters",   href: "/masters" },
  { label: "Orders",    href: "/orders" },
  { label: "Vendors",   href: "/vendors" },
  { label: "Settings",  href: "/settings" },
];

export default function TopNavbar({ username, role, onLogout, isLoggingOut }: TopNavbarProps) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = username
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
        <div className="flex items-center justify-between h-16 px-6 max-w-screen-2xl mx-auto">

          {/* LEFT — Brand */}
          <Link
            href="/dashboard"
            className="flex flex-col leading-none select-none"
          >
            <span
              className="text-base font-bold tracking-widest uppercase"
              style={{ color: "#C9B45C", letterSpacing: "0.18em" }}
            >
              ZARI
            </span>
            <span className="text-[9px] font-medium tracking-[0.25em] text-gray-400 uppercase">
              EMBROIDERIES
            </span>
          </Link>

          {/* CENTER — Desktop nav links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ label, href }) => {
              const active = location === href;
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
            {/* User info (hidden on small screens) */}
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-sm font-medium text-gray-900">{username}</span>
              <span className="text-xs text-gray-400 capitalize">{role}</span>
            </div>

            {/* Avatar */}
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
              style={{ backgroundColor: "#111", color: "#C9B45C" }}
            >
              {initials}
            </div>

            {/* Logout button */}
            <button
              onClick={onLogout}
              disabled={isLoggingOut}
              title="Sign out"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-gray-200 text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
            >
              {isLoggingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              <span>Sign Out</span>
            </button>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* MOBILE — dropdown menu */}
        {mobileOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-4 pb-4 pt-2 shadow-md">
            <nav className="flex flex-col gap-1 mb-3">
              {navLinks.map(({ label, href }) => {
                const active = location === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? "bg-gray-900 text-[#C9B45C]"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>

            {/* Mobile logout */}
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
