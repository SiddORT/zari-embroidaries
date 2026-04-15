import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  BarChart2,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import ZariLogo from "@assets/image_1776152751088.png";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  { label: "Dashboard",  icon: LayoutDashboard, href: "/dashboard" },
  { label: "Products",   icon: Package,         href: "/products" },
  { label: "Orders",     icon: ShoppingCart,    href: "/orders" },
  { label: "Users",      icon: Users,           href: "/users" },
  { label: "Analytics",  icon: BarChart2,       href: "/analytics" },
  { label: "Settings",   icon: Settings,        href: "/settings" },
];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const [location] = useLocation();

  return (
    <aside
      className={`hidden md:flex flex-col bg-white border-r border-gray-200 h-full transition-all duration-200 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center h-16 border-b border-gray-100 px-4 shrink-0 ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed && (
          <img src={ZariLogo} alt="ZARI ERP" className="h-8 w-auto" />
        )}
        {collapsed && (
          <div className="h-8 w-8 bg-gray-900 rounded-md flex items-center justify-center">
            <span className="text-white text-xs font-bold">Z</span>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ label, icon: Icon, href }) => {
          const active = location === href;
          return (
            <Link key={href} href={href}>
              <a
                className={`flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-gray-900 text-[#C9B45C]"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                } ${collapsed ? "justify-center" : ""}`}
                title={collapsed ? label : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{label}</span>}
              </a>
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-gray-100 p-3">
        <button
          onClick={onToggle}
          className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors ${
            collapsed ? "justify-center" : ""
          }`}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 shrink-0" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 shrink-0" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
