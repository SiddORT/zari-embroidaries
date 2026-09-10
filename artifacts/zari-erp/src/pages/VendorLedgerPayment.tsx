import { useState, useEffect, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, CreditCard, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/layout/AppLayout";
import { customFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/contexts/CurrencyContext";
import { SmallSearchSelect, type SmallSearchSelectOption } from "@/components/ui/SearchableSelect";
import { useTDSMasterList, type TDSMasterRecord } from "@/hooks/useTDSMaster";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";

// ── Constants ─────────────────────────────────────────────────────────────
const G     = "#C6AF4B";
const G_DIM = "#A8943E";

// ── Interfaces ────────────────────────────────────────────────────────────
interface Vendor {
  id: number;
  vendorCode: string;
  brandName: string;
  contactName: string;
  email?: string;
  contactNo?: string;
}

interface LedgerEntry {
  entry_type: string;
  entry_id: string;
  entry_date: string;
  description: string;
  order_type: string;
  order_code: string | null;
  total_amount: string;
  debit: string;
  credit: string;
  running_balance: number;
}

interface StoredSelection {
  entries: LedgerEntry[];
  vendor: Vendor;
  timestamp: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────
function rowKey(e: LedgerEntry) {
  return `${e.entry_type}::${e.entry_id}`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Wrapper to give each dropdown its own filtered options ──
function SearchableTdsSelect({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  clearable,
}: {
  options: SmallSearchSelectOption[];
  value?: string | number | null;
  onChange: (val: any) => void;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
}) {
  const [filteredOptions, setFilteredOptions] = useState(options);
  const [searchTerm, setSearchTerm] = useState("");

  // When the full options change (e.g., loaded from API), update our filtered list if no search
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredOptions(options);
    }
  }, [options]);

  const handleSearch = (search: string) => {
    setSearchTerm(search);
    if (!search.trim()) {
      setFilteredOptions(options);
    } else {
      const lower = search.toLowerCase();
      setFilteredOptions(
        options.filter((opt) => opt.label.toLowerCase().includes(lower))
      );
    }
  };

  return (
    <SmallSearchSelect
      options={filteredOptions}
      value={value}
      onChange={onChange}
      onSearch={handleSearch}
      placeholder={placeholder}
      disabled={disabled}
      clearable={clearable}
    />
  );
}

// ── Payment Page ──────────────────────────────────────────────────────────
export default function VendorLedgerPayment() {
  const { fmt, currency: dc } = useCurrency();
  const [, setLocation] = useLocation();
  const params = useParams<{ vendorId: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const token = localStorage.getItem("zarierp_token");
  const [tdsSearch, setTdsSearch] = useState("");

  // ── 1. Current user ──────────────────────────────────────────────────
  const { data: user, isLoading: userLoading, isError } = useGetMe({
    query: {
      enabled: !!token,
      queryKey: getGetMeQueryKey(),
      retry: false,
    },
  });

  // ── 2. TDS masters (React Query hook) ──────────────────────────────
  const {
    data: tdsData,
    isLoading: tdsLoading,
    error: tdsError,
    } = useTDSMasterList({
    search: tdsSearch,
    status: "active",
    page: 1,
    limit: 100,
  });

  const tdsOptions = useMemo<SmallSearchSelectOption[]>(() => {
    if (!tdsData) return [];
    return tdsData.data.map((item: TDSMasterRecord) => ({
      value: item.id,
      label: `${item.serviceName} (${item.sectionCode}) - ${item.ratePercent}%`,
    }));
  }, [tdsData]);

  useEffect(() => {
    if (tdsError) {
      toast({
        title: "Could not load TDS options",
        description: String(tdsError),
        variant: "destructive",
      });
    }
  }, [tdsError, toast]);

  // ── 3. Selection from sessionStorage ──────────────────────────────
  const [selection, setSelection] = useState<StoredSelection | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("paymentSelection");
    if (!stored) {
      toast({
        title: "No items selected",
        description: "Please select items to pay from the ledger.",
        variant: "destructive",
      });
      setLocation("/accounts/ledgers");
      return;
    }

    try {
      const data: StoredSelection = JSON.parse(stored);
      if (Date.now() - data.timestamp > 5 * 60 * 1000) {
        sessionStorage.removeItem("paymentSelection");
        toast({ title: "Selection expired", variant: "destructive" });
        setLocation("/accounts/ledgers");
        return;
      }
      setSelection(data);

      const total = data.entries.reduce((sum, e) => sum + parseFloat(e.debit || "0"), 0);
      setPayForm((f) => ({
        ...f,
        amount: total.toFixed(2),
        orderType: deriveOrderType(data.entries),
        notes: `Payment against ${data.entries.length} item(s): ` +
          data.entries.map((e) => e.description).join(", "),
      }));
    } catch (e) {
      sessionStorage.removeItem("paymentSelection");
      toast({ title: "Invalid selection data", variant: "destructive" });
      setLocation("/accounts/ledgers");
    }
  }, [setLocation, toast]);

  // ── 4. State ──────────────────────────────────────────────────────────
  const [entryTds, setEntryTds] = useState<Record<string, number | string>>({});
  const [payForm, setPayForm] = useState({
    amount: "",
    paymentDate: "",
    paymentMode: "Bank Transfer",
    referenceNo: "",
    orderType: "general" as "general" | "style" | "swatch",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // ── 5. Helpers ──────────────────────────────────────────────────────
  const deriveOrderType = (entries: LedgerEntry[]): "general" | "style" | "swatch" => {
    const types = Array.from(new Set(entries.map((e) => e.order_type).filter(Boolean)));
    if (types.length === 1 && (types[0] === "style" || types[0] === "swatch")) {
      return types[0] as "style" | "swatch";
    }
    return "general";
  };

  const selectedTotal = useMemo(() => {
    if (!selection) return 0;
    return selection.entries.reduce((sum, e) => sum + parseFloat(e.debit || "0"), 0);
  }, [selection]);

  // ── 6. Handlers ──────────────────────────────────────────────────────
  const handleTdsChange = (entryKey: string, tdsId: number | string) => {
    setEntryTds((prev) => ({ ...prev, [entryKey]: tdsId }));
  };

  const handlePay = async () => {
    if (!selection) return;

    const amt = parseFloat(payForm.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast({ title: "Enter a payment amount greater than 0", variant: "destructive" });
      return;
    }
    if (!payForm.paymentMode) {
      toast({ title: "Payment mode is required", variant: "destructive" });
      return;
    }

    const maxAllowed = parseFloat(selectedTotal.toFixed(2));
    if (amt > maxAllowed + 0.001) {
      toast({
        title: `Amount cannot exceed ${fmt(maxAllowed)}`,
        description: "Limited to the total of selected items",
        variant: "destructive",
      });
      return;
    }

    const sorted = [...selection.entries].sort(
      (a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
    );

    const allocations: {
      entryType: string;
      entryId: string;
      amount: number;
      debit: number;
      tdsMasterId: number | null;
    }[] = [];

    let remaining = amt;
    for (const entry of sorted) {
      const debit = parseFloat(entry.debit);
      if (debit <= 0) continue;
      const alloc = Math.min(remaining, debit);
      if (alloc > 0.005) {
        const key = rowKey(entry);
        const tdsId = entryTds[key] ? Number(entryTds[key]) : null;
        allocations.push({
          entryType: entry.entry_type,
          entryId: entry.entry_id,
          amount: parseFloat(alloc.toFixed(2)),
          debit: parseFloat(entry.debit),
          tdsMasterId: tdsId,
        });
        remaining -= alloc;
      }
      if (remaining < 0.005) break;
    }

    if (remaining > 0.005) {
      toast({ title: "Allocation error: remaining amount left", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      await customFetch(`/api/vendor-ledger/${selection.vendor.id}/pay`, {
        method: "POST",
        body: JSON.stringify({
          ...payForm,
          vendorId: selection.vendor.id,
          vendorName: selection.vendor.brandName,
          allocations,
        }),
      });

      toast({ title: "Payment recorded successfully" });
      sessionStorage.removeItem("paymentSelection");
      setLocation(`/accounts/ledgers/${selection.vendor.id}?paymentSuccess=true`);
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to record payment", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // ── 7. Redirect unauthenticated ─────────────────────────────────────
  useEffect(() => {
    if (!token || isError) {
      localStorage.removeItem("zarierp_token");
      setLocation("/login");
    }
  }, [token, isError, setLocation]);

  // ── 8. Render ──────────────────────────────────────────────────────────
  if (userLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fb]">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: G_DIM }} />
      </div>
    );
  }

  if (!selection) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fb]">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: G_DIM }} />
      </div>
    );
  }

  const { vendor, entries } = selection;

  return (
    <AppLayout
      username={user.username}
      role={user.role}
      onLogout={() => {
        localStorage.removeItem("zarierp_token");
        queryClient.clear();
        setLocation("/login");
      }}
      isLoggingOut={false}
    >
      <div className="max-w-5xl mx-auto py-8 px-4">
        {/* Back button */}
        <button
          onClick={() => setLocation(`/accounts/ledgers/${vendor.id}`)}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-slate-500 mb-4 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Ledger
        </button>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-cyan-900">
              Record Payment
            </h1>
            <p className="text-sm text-gray-500">
              To <span className="font-semibold">{vendor.brandName}</span> ·{" "}
              {entries.length} item{entries.length > 1 ? "s" : ""} selected
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Total Payable</p>
            <p className="text-2xl font-black" style={{ color: G_DIM }}>
              {fmt(selectedTotal)}
            </p>
          </div>
        </div>

        {/* ── List of selected entries (SCROLLABLE) ── */}
        <div className="bg-white rounded-2xl border border-[#C6AF4B]/15 shadow-sm overflow-hidden mb-6">
          <div className="h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${G}, transparent)` }} />
          <div className="p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
              Select TDS for each item
            </p>
            {/* 👇 Scrollable container with max height */}
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {entries.map((entry) => {
                const key = rowKey(entry);
                return (
                  <div
                    key={key}
                    className="flex flex-wrap items-center gap-4 p-3 rounded-xl border border-gray-100 hover:bg-gray-50/50 transition"
                  >
                    <div className="flex-1 min-w-[150px]">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {entry.description}
                      </p>
                      <p className="text-xs text-gray-400">
                        {fmtDate(entry.entry_date)} · {fmt(entry.debit)}
                      </p>
                    </div>
                    <div className="w-64 min-w-[180px]">
                      <SearchableTdsSelect
                        options={tdsOptions}
                        value={entryTds[key] || null}
                        onChange={(val) => handleTdsChange(key, val)}
                        placeholder="Select TDS"
                        clearable
                        disabled={tdsLoading}
                        />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Payment Form ── */}
        <div className="bg-white rounded-2xl border border-[#C6AF4B]/15 shadow-sm overflow-hidden">
          <div className="h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${G}, transparent)` }} />
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Amount */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
                  Amount <span className="text-red-500 ml-0.5">*</span>
                  <span className="ml-2 normal-case tracking-normal text-gray-400">
                    max {fmt(selectedTotal)}
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                    {dc.symbol}
                  </span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={selectedTotal || undefined}
                    value={payForm.amount}
                    onKeyDown={(e) => {
                      if (["-", "+", "e", "E"].includes(e.key)) e.preventDefault();
                    }}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "") {
                        setPayForm((f) => ({ ...f, amount: "" }));
                        return;
                      }
                      const n = parseFloat(v);
                      if (!Number.isFinite(n) || n < 0) return;
                      setPayForm((f) => ({ ...f, amount: v }));
                    }}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm text-cyan-900 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30"
                  />
                </div>
                {payForm.amount &&
                  parseFloat(payForm.amount) > parseFloat(selectedTotal.toFixed(2)) && (
                    <p className="text-[10px] text-red-600 mt-1">
                      Exceeds selected total
                    </p>
                  )}
              </div>

              {/* Payment Date */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
                  Payment Date
                </label>
                <input
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={payForm.paymentDate}
                  onChange={(e) =>
                    setPayForm((f) => ({ ...f, paymentDate: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-cyan-900 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30"
                />
              </div>

              {/* Payment Mode */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
                  Payment Mode <span className="text-red-500 ml-0.5">*</span>
                </label>
                <select
                  value={payForm.paymentMode}
                  onChange={(e) =>
                    setPayForm((f) => ({ ...f, paymentMode: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-cyan-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30"
                >
                  <option>Bank Transfer</option>
                  <option>Cash</option>
                  <option>Cheque</option>
                  <option>UPI</option>
                  <option>RTGS</option>
                  <option>NEFT</option>
                  <option>DD</option>
                </select>
              </div>

              {/* Reference No. */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
                  Reference No.
                </label>
                <input
                  type="text"
                  value={payForm.referenceNo}
                  onChange={(e) =>
                    setPayForm((f) => ({ ...f, referenceNo: e.target.value }))
                  }
                  placeholder="UTR / Cheque no."
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-cyan-900 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30"
                />
              </div>

              {/* Order Type */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
                  Order Type
                </label>
                <select
                  value={payForm.orderType}
                  onChange={(e) =>
                    setPayForm((f) => ({
                      ...f,
                      orderType: e.target.value as "general" | "style" | "swatch",
                    }))
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-cyan-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30"
                >
                  <option value="general">General</option>
                  <option value="style">Style Order</option>
                  <option value="swatch">Swatch Order</option>
                </select>
              </div>

              {/* Notes */}
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
                  Notes
                </label>
                <textarea
                  value={payForm.notes}
                  onChange={(e) =>
                    setPayForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  rows={4}
                  placeholder="Optional notes…"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-cyan-900 resize-none focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setLocation(`/accounts/ledgers/${vendor.id}`)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePay}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: G_DIM }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" /> Record Payment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}