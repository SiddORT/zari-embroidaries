import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
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
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = search
    ? options.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  const reposition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropH = Math.min(280, 60 + filtered.length * 36);
    if (spaceBelow < dropH && rect.top > dropH) {
      setDropdownStyle({ position: "fixed", bottom: window.innerHeight - rect.top + 4, left: rect.left, width: rect.width, zIndex: 9999 });
    } else {
      setDropdownStyle({ position: "fixed", top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 9999 });
    }
  }, [filtered.length]);

  function openDropdown() {
    reposition();
    setOpen(true);
    setSearch("");
  }

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
    if (!open) return;
    setTimeout(() => searchRef.current?.focus(), 10);
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      if (!buttonRef.current?.contains(target)) {
        const portal = document.getElementById("searchable-select-portal");
        if (!portal?.contains(target)) { setOpen(false); setSearch(""); }
      }
    }
    function onScroll() { reposition(); }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, reposition]);

  const dropdown = open ? (
    <div id="searchable-select-portal" style={dropdownStyle}
      className="rounded-lg border border-gray-200 bg-white shadow-xl overflow-hidden">
      <div className="p-2 border-b border-gray-100">
        <input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..." className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-gray-400" />
      </div>
      <div className="max-h-52 overflow-y-auto">
        {filtered.length === 0 && <div className="px-3 py-4 text-sm text-gray-400 text-center">No results</div>}
        {filtered.map((opt) => (
          <button key={opt} type="button" onClick={() => select(opt)}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${opt === value ? "bg-gray-50 font-medium text-gray-900" : "text-gray-700"}`}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        <button ref={buttonRef} type="button" onClick={openDropdown}
          className={`w-full flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-sm bg-white shadow-sm transition outline-none text-left
            ${open ? "border-gray-900 ring-2 ring-gray-900/10" : error ? "border-red-400" : "border-gray-300 hover:border-gray-400"}`}>
          <span className={value ? "text-gray-900" : "text-gray-400"}>{value || placeholder}</span>
          <div className="flex items-center gap-1 shrink-0">
            {clearable && value && (
              <span role="button" onClick={handleClear} className="text-gray-400 hover:text-gray-600 p-0.5 rounded">
                <X size={12} />
              </span>
            )}
            <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
          </div>
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {typeof document !== "undefined" && createPortal(dropdown, document.body)}
    </div>
  );
}
