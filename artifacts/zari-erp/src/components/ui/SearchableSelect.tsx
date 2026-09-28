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
  footerAction?: { label: string; onClick: () => void };
  displayValue?: string;
  disabled?: boolean;
}

export default function SearchableSelect({
  label, value, onChange, options, placeholder = "Select...", required, error, clearable,
  footerAction, displayValue, disabled = false
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
    if (disabled) return;
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
      {footerAction && (
        <div className="border-t border-gray-100">
          <button type="button"
            onClick={() => { setOpen(false); setSearch(""); footerAction.onClick(); }}
            className="w-full text-left px-3 py-2.5 text-sm font-medium text-[#a8922e] hover:bg-[#fdf8ee] transition-colors flex items-center gap-1.5">
            {footerAction.label}
          </button>
        </div>
      )}
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
          <span className={(displayValue ?? value) ? "text-gray-900" : "text-gray-400"}>{displayValue ?? (value || placeholder)}</span>
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

// ── Compact searchable select for use inside BOM / costing forms ──────────────
export interface SmallSearchSelectOption {
  value: string | number;
  label: string;
}

export interface SmallSearchSelectProps {
  options: SmallSearchSelectOption[];
  value?: string | number | null;
  onChange: (value: any) => void;
  onSearch?: (search: string) => void;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
}

export function SmallSearchSelect({ options, value, onChange, onSearch, placeholder = "Select...", disabled = false, clearable = true, }: SmallSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Loose equality check to safely match numbers vs string types
  const selected = options.find(
    (o) => value !== null && value !== undefined && String(o.value) === String(value)
  );
  
  const filtered = options;

  // Dynamically calculate coordinates relative to the button
  const reposition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropH = Math.min(220, 50 + filtered.length * 32);

    if (spaceBelow < dropH && rect.top > dropH) {
      setDropdownStyle({
        position: "fixed",
        bottom: window.innerHeight - rect.top + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    } else {
      setDropdownStyle({
        position: "fixed",
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    }
  }, [filtered.length]);

  function handleOpen() {
    if (disabled) return;
    reposition();
    setOpen((v) => !v);
    setSearch("");
  }

  // Handle outside click, scroll, and window resize
  useEffect(() => {
    if (!open) return;
    setTimeout(() => searchRef.current?.focus(), 10);

    function handler(e: MouseEvent) {
      const target = e.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        !document.getElementById("small-select-portal")?.contains(target)
      ) {
        setOpen(false);
        setSearch("");
      }
    }

    function onScroll() {
      reposition();
    }

    document.addEventListener("mousedown", handler);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", reposition);

    return () => {
      document.removeEventListener("mousedown", handler);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, reposition]);

  if (disabled) {
    return (
      <div className="flex-1 text-xs text-gray-400 border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 opacity-50 cursor-not-allowed flex items-center justify-between">
        <span>{selected?.label || placeholder}</span>
        <ChevronDown size={12} className="text-gray-300 shrink-0" />
      </div>
    );
  }

  const dropdown = open ? (
    <div
      id="small-select-portal"
      style={dropdownStyle}
      className="bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
    >
      <div className="p-1.5 border-b border-gray-100">
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => {
            const val = e.target.value;
            setSearch(val);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
              onSearch?.(val);
            }, 300);
          }}
          placeholder="Search..."
          autoComplete="off"
          className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gray-400"
        />
      </div>
      <div className="max-h-44 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-3 py-3 text-xs text-gray-400 text-center">No results</div>
        ) : (
          filtered.map((o) => {
            const isSelected = value !== null && value !== undefined && String(o.value) === String(value);
            return (
              <button
                key={String(o.value)}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                  setSearch("");
                }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors ${
                  isSelected ? "bg-gray-50 font-semibold text-gray-900" : "text-gray-700"
                }`}
              >
                {o.label}
              </button>
            );
          })
        )}
      </div>
    </div>
  ) : null;

  const isValuePresent = value !== null && value !== undefined && value !== "" && value !== 0;

  return (
    <div className="flex-1 relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        className="w-full text-left text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 flex items-center justify-between gap-1 transition-colors hover:border-gray-300"
      >
        <span className={selected ? "text-gray-900 truncate" : "text-gray-400"}>
          {selected?.label || placeholder}
        </span>
        <div className="flex items-center gap-0.5 shrink-0">
          {clearable && isValuePresent && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(typeof value === "number" ? 0 : "");
                setSearch("");
              }}
              className="text-gray-300 hover:text-gray-500 p-0.5 rounded"
            >
              <X size={10} />
            </span>
          )}
          <ChevronDown
            size={12}
            className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>
      {typeof document !== "undefined" && createPortal(dropdown, document.body)}
    </div>
  );
}
