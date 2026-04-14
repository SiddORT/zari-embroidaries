import { Menu, LogOut, Loader2 } from "lucide-react";

interface NavbarProps {
  title: string;
  username: string;
  role: string;
  onLogout: () => void;
  isLoggingOut: boolean;
  onMenuToggle?: () => void;
}

export default function Navbar({
  title,
  username,
  role,
  onLogout,
  isLoggingOut,
  onMenuToggle,
}: NavbarProps) {
  const initials = username
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-5 sticky top-0 z-20 shadow-sm">
      {/* Left — hamburger (mobile) + page title */}
      <div className="flex items-center gap-3">
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <h1 className="text-base font-semibold text-gray-900 tracking-tight">{title}</h1>
      </div>

      {/* Right — user info + logout */}
      <div className="flex items-center gap-3">
        {/* User info */}
        <div className="hidden sm:flex flex-col items-end leading-tight">
          <span className="text-sm font-medium text-gray-900">{username}</span>
          <span className="text-xs text-gray-400 capitalize">{role}</span>
        </div>

        {/* Avatar */}
        <div className="h-8 w-8 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-semibold">{initials}</span>
        </div>

        {/* Logout */}
        <button
          onClick={onLogout}
          disabled={isLoggingOut}
          title="Sign out"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
        >
          {isLoggingOut ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
}
