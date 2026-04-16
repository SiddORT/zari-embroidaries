import { useState, useEffect, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft, Wallet, TrendingDown, TrendingUp, Scale,
  Plus, CreditCard, Building2, Calendar, Filter,
  Trash2, X, CheckCircle, AlertCircle, FileText,
  IndianRupee, ChevronDown,
} from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/layout/AppLayout";
import { customFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

const G     = "#C6AF4B";
const G_DIM = "#A8943E";
const G_GLOW = "rgba(198,175,75,0.18)";

const card = [
  "rounded-2xl overflow-hidden bg-white",
  "border border-[#C6AF4B]/15",
  "shadow-[0_2px_16px_rgba(198,175,75,0.12),0_1px_3px_rgba(0,0,0,0.06)]",
].join(" ");

interface Vendor {
  id: number; vendorCode: string; brandName: string;
  contactName: string; email?: string; contactNo?: string;
  bankName?: string; accountNo?: string; ifscCode?: string;
}

interface LedgerEntry {
  entry_type: string;
  entry_id: string;
  entry_date: string;
  description: string;
  order_type: string;
  order_code: string | null;
  debit: string;
  credit: string;
  running_balance: number;
}

function fmt(n: string | number) {
  const val = typeof n === "string" ? parseFloat(n) : Number(n);
  return "₹" + Math.abs(val).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).filter(Boolean).join("").toUpperCase().slice(0, 2);
}

const TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  outsource:      { label: "Outsource Job",   color: G_DIM,     bg: `${G}12` },
  custom_charge:  { label: "Order Charge",    color: "#8B5CF6", bg: "rgba(139,92,246,0.1)" },
  ledger_charge:  { label: "Manual Charge",   color: "#F59E0B", bg: "rgba(245,158,11,0.1)" },
  artwork_swatch: { label: "Artwork (Swatch)",color: "#0EA5E9", bg: "rgba(14,165,233,0.1)" },
  artwork_style:  { label: "Artwork (Style)", color: "#6366F1", bg: "rgba(99,102,241,0.1)" },
  toile:          { label: "Toile Work",      color: "#EC4899", bg: "rgba(236,72,153,0.1)" },
  payment:        { label: "Payment",         color: "#10B981", bg: "rgba(16,185,129,0.1)" },
};

export default function VendorLedgerDetail() {
  const [, setLocation] = useLocation();
  const params = useParams<{ vendorId: string }>();
  const vendorId = parseInt(params.vendorId);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const token = localStorage.getItem("zarierp_token");

  const { data: user, isLoading: userLoading, isError } = useGetMe({
    query: { enabled: !!token, queryKey: getGetMeQueryKey(), retry: false },
  });
  const logoutMutation = useLogout();

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [orderTypeFilter, setOrderTypeFilter] = useState("all");
  const [entryTypeFilter, setEntryTypeFilter] = useState("all");

  const [payModal, setPayModal] = useState(false);
  const [chargeModal, setChargeModal] = useState(false);

  const [payForm, setPayForm] = useState({ amount: "", paymentMode: "Bank Transfer", referenceNo: "", notes: "", paymentDate: "", orderType: "general" });
  const [chargeForm, setChargeForm] = useState({ description: "", amount: "", notes: "", orderType: "general", chargeDate: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token || isError) { localStorage.removeItem("zarierp_token"); setLocation("/login"); }
  }, [token, isError, setLocation]);

  const loadData = useCallback(() => {
    if (!token || !vendorId) return;
    setLoading(true);
    const params: Record<string, string> = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (orderTypeFilter !== "all") params.orderType = orderTypeFilter;

    const qs = new URLSearchParams(params).toString();
    Promise.all([
      customFetch(`/api/vendor-ledger/${vendorId}/info`) as Promise<Vendor>,
      customFetch(`/api/vendor-ledger/${vendorId}/entries${qs ? "?" + qs : ""}`) as Promise<LedgerEntry[]>,
    ]).then(([v, e]) => { setVendor(v); setEntries(e); })
      .catch(() => toast({ title: "Failed to load ledger", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [token, vendorId, startDate, endDate, orderTypeFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => { localStorage.removeItem("zarierp_token"); queryClient.clear(); setLocation("/login"); },
      onError:   () => { localStorage.removeItem("zarierp_token"); queryClient.clear(); setLocation("/login"); },
    });
  };

  const filteredEntries = entryTypeFilter === "all"
    ? entries
    : entryTypeFilter === "debits"  ? entries.filter(e => parseFloat(e.debit)  > 0)
    : entryTypeFilter === "credits" ? entries.filter(e => parseFloat(e.credit) > 0)
    : entries.filter(e => e.entry_type === entryTypeFilter);

  const totalDebit  = entries.reduce((s, e) => s + parseFloat(e.debit  || "0"), 0);
  const totalCredit = entries.reduce((s, e) => s + parseFloat(e.credit || "0"), 0);
  const balance     = totalDebit - totalCredit;

  const handlePay = async () => {
    if (!payForm.amount || !payForm.paymentMode) {
      toast({ title: "Amount and payment mode are required", variant: "destructive" }); return;
    }
    setSubmitting(true);
    try {
      await customFetch(`/api/vendor-ledger/${vendorId}/pay`, {
        method: "POST",
        body: JSON.stringify({ ...payForm, vendorId, vendorName: vendor?.brandName }),
      });
      toast({ title: "Payment recorded successfully" });
      setPayModal(false);
      setPayForm({ amount: "", paymentMode: "Bank Transfer", referenceNo: "", notes: "", paymentDate: "", orderType: "general" });
      loadData();
    } catch {
      toast({ title: "Failed to record payment", variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  const handleCharge = async () => {
    if (!chargeForm.description || !chargeForm.amount) {
      toast({ title: "Description and amount are required", variant: "destructive" }); return;
    }
    setSubmitting(true);
    try {
      await customFetch(`/api/vendor-ledger/${vendorId}/charge`, {
        method: "POST",
        body: JSON.stringify({ ...chargeForm, vendorId, vendorName: vendor?.brandName }),
      });
      toast({ title: "Charge added successfully" });
      setChargeModal(false);
      setChargeForm({ description: "", amount: "", notes: "", orderType: "general", chargeDate: "" });
      loadData();
    } catch {
      toast({ title: "Failed to add charge", variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (entry: LedgerEntry) => {
    if (!["payment", "ledger_charge"].includes(entry.entry_type)) {
      toast({ title: "Cannot delete order-linked entries", variant: "destructive" }); return;
    }
    const path = entry.entry_type === "payment"
      ? `/api/vendor-ledger/payments/${entry.entry_id}`
      : `/api/vendor-ledger/charges/${entry.entry_id}`;
    try {
      await customFetch(path, { method: "DELETE" });
      toast({ title: "Entry deleted" });
      loadData();
    } catch {
      toast({ title: "Failed to delete entry", variant: "destructive" });
    }
  };

  if (userLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fb]">
        <div className="h-8 w-8 rounded-full border-2 animate-spin" style={{ borderColor: G, borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.4s ease both; }
        .modal-overlay { position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:50;display:flex;align-items:center;justify-content:center;padding:16px; }
      `}</style>

      <div className="space-y-5 pb-10">

        {/* Back + Header */}
        <div className="fade-up flex items-start justify-between">
          <div>
            <button onClick={() => setLocation("/accounts/ledgers")}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-700 mb-3 transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Vendor Ledgers
            </button>
            <div className="flex items-center gap-2 mb-1">
              <div className="h-px w-8 rounded-full" style={{ background: `linear-gradient(90deg, ${G}, transparent)` }} />
              <p className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: G }}>ACCOUNTS · VENDOR LEDGER</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0"
                style={{ background: G_DIM }}>
                {vendor ? initials(vendor.brandName) : "?"}
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                  {vendor?.brandName ?? "Loading…"}
                </h1>
                <p className="text-xs text-gray-400 font-mono">{vendor?.vendorCode} · {vendor?.contactName}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setChargeModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-80"
              style={{ background: `${G}15`, color: G_DIM, border: `1px solid ${G}30` }}>
              <Plus className="h-4 w-4" /> Add Charge
            </button>
            <button onClick={() => setPayModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-80"
              style={{ background: G_DIM }}>
              <CreditCard className="h-4 w-4" /> Record Payment
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 fade-up" style={{ animationDelay: "60ms" }}>
          {[
            { label: "TOTAL DEBITS",  value: fmt(totalDebit),  icon: TrendingDown, color: G_DIM,     bg: `${G}12` },
            { label: "TOTAL PAID",    value: fmt(totalCredit), icon: TrendingUp,   color: "#10B981", bg: "rgba(16,185,129,0.08)" },
            { label: "BALANCE DUE",   value: fmt(balance),     icon: Scale,        color: balance > 0 ? "#EF4444" : "#10B981", bg: balance > 0 ? "rgba(239,68,68,0.07)" : "rgba(16,185,129,0.07)" },
          ].map(k => (
            <div key={k.label} className={card}>
              <div className="p-5 flex items-center gap-4">
                <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: k.bg }}>
                  <k.icon className="h-5 w-5" style={{ color: k.color }} />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-0.5">{k.label}</p>
                  <p className="text-xl font-black" style={{ color: k.color }}>{k.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="fade-up flex flex-wrap items-center gap-3" style={{ animationDelay: "100ms" }}>
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
            <Filter className="h-3.5 w-3.5" /> Filters:
          </div>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30" />
          <span className="text-gray-400 text-xs">to</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30" />
          <select value={orderTypeFilter} onChange={e => setOrderTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30">
            <option value="all">All Order Types</option>
            <option value="style">Style Orders</option>
            <option value="swatch">Swatch Orders</option>
            <option value="general">General</option>
          </select>
          <select value={entryTypeFilter} onChange={e => setEntryTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30">
            <option value="all">All Entry Types</option>
            <option value="debits">Debits Only</option>
            <option value="credits">Credits Only</option>
            <option value="outsource">Outsource Jobs</option>
            <option value="artwork_swatch">Artwork — Swatch</option>
            <option value="artwork_style">Artwork — Style</option>
            <option value="toile">Toile Work</option>
            <option value="custom_charge">Order Charges</option>
            <option value="ledger_charge">Manual Charges</option>
            <option value="payment">Payments</option>
          </select>
          {(startDate || endDate || orderTypeFilter !== "all" || entryTypeFilter !== "all") && (
            <button onClick={() => { setStartDate(""); setEndDate(""); setOrderTypeFilter("all"); setEntryTypeFilter("all"); }}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors">
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>

        {/* Ledger Table */}
        <div className={`${card} fade-up overflow-visible`} style={{ animationDelay: "140ms" }}>
          <div className="h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${G}, transparent)` }} />

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 rounded-full border-2 animate-spin" style={{ borderColor: G, borderTopColor: "transparent" }} />
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="py-16 text-center">
              <FileText className="h-10 w-10 mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-medium text-gray-400">No ledger entries found</p>
              <p className="text-xs text-gray-300 mt-1">Try adjusting the filters or add a payment/charge above</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-3.5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Date</span>
                    </th>
                    <th className="text-left px-3 py-3.5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Type</span>
                    </th>
                    <th className="text-left px-3 py-3.5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Description</span>
                    </th>
                    <th className="text-left px-3 py-3.5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Order Ref</span>
                    </th>
                    <th className="text-right px-3 py-3.5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Debit</span>
                    </th>
                    <th className="text-right px-3 py-3.5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Credit</span>
                    </th>
                    <th className="text-right px-3 py-3.5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Balance</span>
                    </th>
                    <th className="px-3 py-3.5 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry, idx) => {
                    const isDebit    = parseFloat(entry.debit) > 0;
                    const isCredit   = parseFloat(entry.credit) > 0;
                    const typeInfo   = TYPE_LABELS[entry.entry_type] ?? { label: entry.entry_type, color: G, bg: `${G}10` };
                    const isDeletable = ["payment", "ledger_charge"].includes(entry.entry_type);

                    return (
                      <tr key={`${entry.entry_type}-${entry.entry_id}`}
                        className="border-b border-gray-50 hover:bg-amber-50/40 transition-colors">
                        <td className="px-5 py-3 whitespace-nowrap text-gray-500">{fmtDate(entry.entry_date)}</td>
                        <td className="px-3 py-3">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider"
                            style={{ color: typeInfo.color, background: typeInfo.bg }}>
                            {typeInfo.label}
                          </span>
                        </td>
                        <td className="px-3 py-3 max-w-xs truncate text-gray-700 font-medium">{entry.description}</td>
                        <td className="px-3 py-3">
                          {entry.order_code
                            ? <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${G}10`, color: G_DIM }}>{entry.order_code}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-3 text-right font-bold" style={{ color: isDebit ? G_DIM : undefined }}>
                          {isDebit ? fmt(entry.debit) : <span className="text-gray-200">—</span>}
                        </td>
                        <td className="px-3 py-3 text-right font-bold" style={{ color: isCredit ? "#10B981" : undefined }}>
                          {isCredit ? fmt(entry.credit) : <span className="text-gray-200">—</span>}
                        </td>
                        <td className="px-3 py-3 text-right font-black"
                          style={{ color: entry.running_balance > 0 ? "#EF4444" : "#10B981" }}>
                          {fmt(entry.running_balance)}
                          <span className="text-[9px] font-normal ml-1" style={{ color: entry.running_balance > 0 ? "#FCA5A5" : "#6EE7B7" }}>
                            {entry.running_balance > 0 ? "DR" : "CR"}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {isDeletable && (
                            <button onClick={() => handleDelete(entry)}
                              className="h-6 w-6 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-100 bg-gray-50/50">
                    <td colSpan={4} className="px-5 py-3">
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                        {filteredEntries.length} entries
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-black" style={{ color: G_DIM }}>{fmt(totalDebit)}</td>
                    <td className="px-3 py-3 text-right font-black text-emerald-700">{fmt(totalCredit)}</td>
                    <td className="px-3 py-3 text-right font-black" style={{ color: balance > 0 ? "#EF4444" : "#10B981" }}>
                      {fmt(balance)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Vendor Bank Info */}
        {vendor && (vendor.bankName || vendor.accountNo) && (
          <div className={`${card} p-5 fade-up`} style={{ animationDelay: "200ms" }}>
            <p className="text-[9px] font-black uppercase tracking-widest mb-3" style={{ color: G }}>BANK DETAILS</p>
            <div className="flex flex-wrap gap-6 text-xs">
              {vendor.bankName  && <div><p className="text-gray-400 mb-0.5">Bank</p><p className="font-bold text-gray-700">{vendor.bankName}</p></div>}
              {vendor.accountNo && <div><p className="text-gray-400 mb-0.5">Account</p><p className="font-bold font-mono text-gray-700">{vendor.accountNo}</p></div>}
              {vendor.ifscCode  && <div><p className="text-gray-400 mb-0.5">IFSC</p><p className="font-bold font-mono text-gray-700">{vendor.ifscCode}</p></div>}
            </div>
          </div>
        )}
      </div>

      {/* ── Record Payment Modal ─── */}
      {payModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPayModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${G}, transparent)` }} />
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Record Payment</h2>
                  <p className="text-xs text-gray-400 mt-0.5">to {vendor?.brandName}</p>
                </div>
                <button onClick={() => setPayModal(false)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Amount *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                      <input type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                        placeholder="0.00" className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Payment Date</label>
                    <input type="date" value={payForm.paymentDate} onChange={e => setPayForm(f => ({ ...f, paymentDate: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Payment Mode *</label>
                  <select value={payForm.paymentMode} onChange={e => setPayForm(f => ({ ...f, paymentMode: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30">
                    <option>Bank Transfer</option>
                    <option>Cash</option>
                    <option>Cheque</option>
                    <option>UPI</option>
                    <option>RTGS</option>
                    <option>NEFT</option>
                    <option>DD</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Reference No.</label>
                    <input type="text" value={payForm.referenceNo} onChange={e => setPayForm(f => ({ ...f, referenceNo: e.target.value }))}
                      placeholder="UTR / Cheque no." className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Order Type</label>
                    <select value={payForm.orderType} onChange={e => setPayForm(f => ({ ...f, orderType: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30">
                      <option value="general">General</option>
                      <option value="style">Style Order</option>
                      <option value="swatch">Swatch Order</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Notes</label>
                  <textarea value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                    rows={2} placeholder="Optional notes…"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30" />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setPayModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button onClick={handlePay} disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-80 disabled:opacity-50"
                  style={{ background: G_DIM }}>
                  {submitting ? "Saving…" : "Record Payment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Custom Charge Modal ─── */}
      {chargeModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setChargeModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${G}, transparent)` }} />
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Add Custom Charge</h2>
                  <p className="text-xs text-gray-400 mt-0.5">for {vendor?.brandName}</p>
                </div>
                <button onClick={() => setChargeModal(false)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Description *</label>
                  <input type="text" value={chargeForm.description} onChange={e => setChargeForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="e.g. Transportation charges, Late delivery penalty…"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Amount *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                      <input type="number" value={chargeForm.amount} onChange={e => setChargeForm(f => ({ ...f, amount: e.target.value }))}
                        placeholder="0.00" className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Charge Date</label>
                    <input type="date" value={chargeForm.chargeDate} onChange={e => setChargeForm(f => ({ ...f, chargeDate: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Order Type</label>
                  <select value={chargeForm.orderType} onChange={e => setChargeForm(f => ({ ...f, orderType: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30">
                    <option value="general">General</option>
                    <option value="style">Style Order</option>
                    <option value="swatch">Swatch Order</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Notes</label>
                  <textarea value={chargeForm.notes} onChange={e => setChargeForm(f => ({ ...f, notes: e.target.value }))}
                    rows={2} placeholder="Optional notes…"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30" />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setChargeModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button onClick={handleCharge} disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-80 disabled:opacity-50"
                  style={{ background: G_DIM }}>
                  {submitting ? "Saving…" : "Add Charge"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
