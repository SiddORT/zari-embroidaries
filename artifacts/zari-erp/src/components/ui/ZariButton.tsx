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
    "inline-flex items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed";

  const variants = {
    primary:
      "bg-gray-900 text-[#C9B45C] hover:bg-black hover:text-[#d9c872] focus:ring-gray-900/30",
    secondary:
      "bg-white border border-gray-900 text-gray-900 hover:bg-gray-50 focus:ring-gray-900/20",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
