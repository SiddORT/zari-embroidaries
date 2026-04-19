import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ZariButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  loading?: boolean;
  children: ReactNode;
  fullWidth?: boolean;
}

export default function ZariButton({
  variant = "primary",
  loading = false,
  children,
  fullWidth = false,
  className = "",
  disabled,
  ...props
}: ZariButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed";

  const variants = {
    primary:
      "text-white focus:ring-[#C6AF4B]/40",
    secondary:
      "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 focus:ring-gray-900/20 shadow-none",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      style={variant === "primary" ? { background: "#C6AF4B" } : undefined}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
