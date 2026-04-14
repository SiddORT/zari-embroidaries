import { useState, useRef, useEffect } from "react";
import { COUNTRIES } from "@/data/countries";
import { ChevronDown } from "lucide-react";

interface PhoneInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  placeholder?: string;
}

function parsePhone(val: string): { dialCode: string; number: string } {
  if (!val) return { dialCode: "+91", number: "" };
  const match = val.match(/^(\+\d{1,4})\s*(.*)?$/);
  if (match) return { dialCode: match[1], number: match[2] ?? "" };
  return { dialCode: "+91", number: val };
}

export default function PhoneInput({ label, value, onChange, required, error, placeholder }: PhoneInputProps) {
  const parsed = parsePhone(value);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  const selectedCountry = COUNTRIES.find((c) => c.dialCode === parsed.dialCode) ?? COUNTRIES.find((c) => c.code === "IN")!;

  const filtered = search
    ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.dialCode.includes(search))
    : COUNTRIES;

  function selectCC(dialCode: string) {
    setOpen(false);
    setSearch("");
    onChange(dialCode + (parsed.number ? " " + parsed.number : ""));
  }

  function handleNumberChange(num: string) {
    onChange(parsed.dialCode + (num ? " " + num : ""));
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

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="flex gap-1.5" ref={wrapRef}>
        <div className="relative">
          <button
            type="button"
            onClick={() => { setOpen((o) => !o); setSearch(""); }}
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-2.5 text-sm bg-white shadow-sm transition outline-none
              ${open ? "border-gray-900 ring-2 ring-gray-900/10" : "border-gray-300 hover:border-gray-400"}`}
          >
            <span className="text-base leading-none">{selectedCountry.flag}</span>
            <span className="text-gray-700 font-mono text-xs">{parsed.dialCode}</span>
            <ChevronDown size={12} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <div className="absolute z-50 top-full mt-1 left-0 w-64 rounded-lg border border-gray-200 bg-white shadow-xl overflow-hidden">
              <div className="p-2 border-b border-gray-100">
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search country..."
                  className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-gray-400"
                />
              </div>
              <div className="max-h-52 overflow-y-auto">
                {filtered.length === 0 && (
                  <div className="px-3 py-4 text-sm text-gray-400 text-center">No results</div>
                )}
                {filtered.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => selectCC(c.dialCode)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors
                      ${c.dialCode === parsed.dialCode ? "bg-gray-50 font-medium" : ""}`}
                  >
                    <span className="text-base">{c.flag}</span>
                    <span className="flex-1 text-gray-700 truncate">{c.name}</span>
                    <span className="text-gray-400 font-mono text-xs shrink-0">{c.dialCode}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <input
          type="tel"
          value={parsed.number}
          onChange={(e) => handleNumberChange(e.target.value)}
          placeholder={placeholder ?? "Phone number"}
          className={`flex-1 rounded-lg border px-3 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition
            ${error ? "border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-200" : "border-gray-300 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"}`}
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
