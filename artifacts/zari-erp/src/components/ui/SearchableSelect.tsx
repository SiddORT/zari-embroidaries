import { useState, useRef, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";

interface SearchableSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
  error?: string;
  clearable?: boolean;
}

export default function SearchableSelect({
  label, value, onChange, options, placeholder = "Select...", required, error, clearable,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = search
    ? options.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  function select(val: string) {
    onChange(val);
    setOpen(false);
    setSearch("");
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
    setSearch("");
  }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  return (
    <div className="flex flex-col gap-1.5" ref={wrapRef}>
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => { setOpen((o) => !o); setSearch(""); }}
          className={`w-full flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-sm bg-white shadow-sm transition outline-none text-left
            ${open ? "border-gray-900 ring-2 ring-gray-900/10" : error ? "border-red-400" : "border-gray-300 hover:border-gray-400"}`}
        >
          <span className={value ? "text-gray-900" : "text-gray-400"}>{value || placeholder}</span>
          <div className="flex items-center gap-1 shrink-0">
            {clearable && value && (
              <span
                role="button"
                onClick={handleClear}
                className="text-gray-400 hover:text-gray-600 p-0.5 rounded"
              >
                <X size={12} />
              </span>
            )}
            <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
          </div>
        </button>
        {open && (
          <div className="absolute z-50 top-full mt-1 left-0 right-0 rounded-lg border border-gray-200 bg-white shadow-xl overflow-hidden">
            <div className="p-2 border-b border-gray-100">
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-gray-400"
              />
            </div>
            <div className="max-h-52 overflow-y-auto">
              {filtered.length === 0 && (
                <div className="px-3 py-4 text-sm text-gray-400 text-center">No results</div>
              )}
              {filtered.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => select(opt)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors
                    ${opt === value ? "bg-gray-50 font-medium text-gray-900" : "text-gray-700"}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
