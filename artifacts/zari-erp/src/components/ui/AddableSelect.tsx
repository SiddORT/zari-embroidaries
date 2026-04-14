import { useState, useRef, useEffect } from "react";
import { Check, Plus, Search } from "lucide-react";

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
  options,
  placeholder = "Search...",
  error,
  disabled,
}: AddableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function handleOpen() {
    if (disabled) return;
    setOpen(true);
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 10);
  }

  function handleSelect(opt: Option) {
    onChange(opt.value);
    setOpen(false);
    setQuery("");
  }

  function handleClear() {
    onChange("");
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      <div className="flex items-center gap-2">
        <div className="relative flex-1" ref={containerRef}>
          {/* Display / search input */}
          {open ? (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type to search…"
                className="w-full pl-8 pr-3 py-2 text-sm text-gray-900 border border-gray-900 ring-2 ring-gray-900/10 rounded-lg outline-none bg-white"
              />
            </div>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={handleOpen}
              className={`w-full flex items-center justify-between rounded-lg border bg-white px-3.5 py-2 text-sm shadow-sm outline-none transition text-left
                ${error ? "border-red-400" : "border-gray-300 hover:border-gray-400"}
                ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <span className={selected ? "text-gray-900" : "text-gray-400"}>
                {selected ? selected.label : placeholder}
              </span>
              {selected && (
                <span
                  onClick={(e) => { e.stopPropagation(); handleClear(); }}
                  className="ml-2 text-gray-400 hover:text-gray-600 text-xs leading-none cursor-pointer"
                >✕</span>
              )}
            </button>
          )}

          {/* Dropdown */}
          {open && (
            <div className="absolute z-50 mt-1.5 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
              <ul className="max-h-52 overflow-y-auto py-1">
                {filtered.length === 0 && (
                  <li className="px-4 py-2.5 text-sm text-gray-400 italic">No results</li>
                )}
                {filtered.map((opt) => (
                  <li key={opt.value}>
                    <button
                      type="button"
                      onClick={() => handleSelect(opt)}
                      className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors
                        ${value === opt.value ? "bg-gray-50 text-gray-900 font-medium" : "text-gray-700 hover:bg-gray-50"}`}
                    >
                      {value === opt.value && <Check className="h-3.5 w-3.5 text-gray-900 shrink-0" />}
                      <span className={value === opt.value ? "" : "ml-5"}>{opt.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* + button */}
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            disabled={disabled}
            title="Add new"
            className="shrink-0 flex items-center justify-center h-9 w-9 rounded-lg border border-gray-300 bg-white text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
