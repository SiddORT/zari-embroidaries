import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Plus } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface AddableSelectProps {
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  onAdd?: () => void;
  addLabel?: string;
  options: Option[];
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}

export default function AddableSelect({
  label,
  required,
  value,
  onChange,
  onAdd,
  addLabel = "+ Add New",
  options,
  placeholder = "Select...",
  error,
  disabled,
}: AddableSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected ? selected.label : "";

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      <label className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className={`w-full flex items-center justify-between rounded-lg border bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition
            ${open ? "border-gray-900 ring-2 ring-gray-900/10" : "border-gray-300"}
            ${error ? "border-red-400 ring-0" : ""}
            ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-gray-400"}`}
        >
          <span className={displayLabel ? "text-gray-900" : "text-gray-400"}>
            {displayLabel || placeholder}
          </span>
          <ChevronDown className={`h-4 w-4 text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div className="absolute z-50 mt-1.5 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
            <ul className="max-h-52 overflow-y-auto py-1">
              {options.length === 0 && (
                <li className="px-4 py-2.5 text-sm text-gray-400 italic">No options yet</li>
              )}
              {options.map((opt) => (
                <li key={opt.value}>
                  <button
                    type="button"
                    onClick={() => { onChange(opt.value); setOpen(false); }}
                    className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors
                      ${value === opt.value ? "bg-gray-50 text-gray-900 font-medium" : "text-gray-700 hover:bg-gray-50"}`}
                  >
                    {value === opt.value && <Check className="h-3.5 w-3.5 text-gray-900 shrink-0" />}
                    <span className={value === opt.value ? "" : "ml-5.5"}>{opt.label}</span>
                  </button>
                </li>
              ))}
            </ul>

            {onAdd && (
              <>
                <div className="border-t border-gray-100" />
                <button
                  type="button"
                  onClick={() => { setOpen(false); onAdd(); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-gray-50"
                  style={{ color: "#C9B45C" }}
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  {addLabel}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
