import { useState, type ReactElement } from "react";
import { useLocation } from "wouter";
import {
  Wallet, ChevronDown, ChevronRight, Plus, Trash2, Loader2,
  ArrowDownLeft, ArrowUpRight, Search, Filter, X, CreditCard,
  CheckCircle2, Clock, AlertCircle, FileText, RefreshCw,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import TopNavbar from "../components/layout/TopNavbar";
import { useToast } from "../hooks/use-toast";
import {
  useAccountInvoices, useInvoicePaymentsList,
  useAddInvoicePayment, useDeleteInvoicePayment,
  type AccountInvoice, type InvoicePayment,
} from "../hooks/useInvoicePayments";

const G = "#C9B45C";
const card = "rounded-2xl bg-white border border-[#C6AF4B]/15 shadow-[0_2px_16px_rgba(198,175,75,0.12),0_1px_3px_rgba(0,0,0,0.06)]";

const PAYMENT_TYPES   = ["Cash", "Bank Transfer", "UPI", "Cheque", "Online Gateway", "Adjustment", "Other"] as const;
const PAYMENT_STATUSES = ["Completed", "Processing", "Failed"] as const;
const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "JPY", "CNY"];

function fmt(n: number | string | undefined | null, cur = "INR") {
  const v = parseFloat(String(n ?? 0));
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(v);
}
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
}

const STATUS_PILL: Record<string, string> = {
  "Generated":     "bg-blue-50 text-blue-700",
  "Sent":          "bg-purple-50 text-purple-700",
  "Partially Paid":"bg-amber-50 text-amber-700",
  "Paid":          "bg-emerald-50 text-emerald-700",
  "Overdue":       "bg-red-50 text-red-600",
  "Processing":    "bg-sky-50 text-sky-700",
  "Failed":        "bg-red-50 text-red-600",
  "Completed":     "bg-emerald-50 text-emerald-700",
};

const PMT_STATUS_ICON: Record<string, ReactElement> = {
  "Completed": <CheckCircle2 size={13} className="text-emerald-500" />,
  "Processing": <Clock size={13} className="text-sky-500" />,
  "Failed": <AlertCircle size={13} className="text-red-500" />,
};

/* ─── Auth helper ─────────────────────────────────────────────────────────── */
function useMe() {
  return useQuery<any>({
    queryKey: ["me"],
    queryFn: async () => {
      const token = localStorage.getItem("zarierp_token");
      const r = await fetch("/api/auth/me", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      return r.json();
    },
  });
}

/* ─── Payment Modal ───────────────────────────────────────────────────────── */
function PaymentModal({ invoice, onClose }: { invoice: AccountInvoice; onClose: () => void }) {
  const { toast } = useToast();
  const addPmt = useAddInvoicePayment();
  const direction = invoice.invoice_direction === "Vendor" ? "Paid" : "Received";

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    payment_type:          "Bank Transfer",
    payment_amount:        String(parseFloat(String(invoice.pending_amount ?? 0)).toFixed(2)),
    currency_code:         invoice.currency_code || "INR",
    exchange_rate_snapshot: String(invoice.exchange_rate_snapshot ?? 1),
    transaction_reference: "",
    payment_status:        "Completed",
    payment_date:          today,
    remarks:               "",
  });

  const baseAmt = parseFloat(form.payment_amount || "0") * parseFloat(form.exchange_rate_snapshot || "1");

  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.payment_amount || parseFloat(form.payment_amount) <= 0)
      return toast({ title: "Invalid amount", variant: "destructive" });

    try {
      await addPmt.mutateAsync({ invoice_id: invoice.id, ...form,
        payment_amount: parseFloat(form.payment_amount),
        exchange_rate_snapshot: parseFloat(form.exchange_rate_snapshot),
      });
      toast({ title: direction === "Received" ? "Payment received" : "Payment recorded" });
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6AF4B] focus:ring-2 focus:ring-[#C6AF4B]/20 bg-white";
  const labelCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={onClose}>
      <div className={`${card} w-full max-w-lg`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              {direction === "Received"
                ? <ArrowDownLeft size={16} className="text-emerald-500" />
                : <ArrowUpRight size={16} className="text-amber-600" />}
              Record {direction === "Received" ? "Payment Received" : "Payment Made"}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {invoice.invoice_no} · {invoice.party_name || invoice.vendor_name} · Pending: {invoice.currency_code} {fmt(invoice.pending_amount)}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Row 1: Amount + Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Payment Amount *</label>
              <input type="number" min="0.01" step="0.01" required value={form.payment_amount}
                onChange={e => set("payment_amount", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Currency</label>
              <select value={form.currency_code} onChange={e => set("currency_code", e.target.value)} className={inputCls}>
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Exchange Rate (shown only if currency != INR) */}
          {form.currency_code !== "INR" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Exchange Rate (1 {form.currency_code} = ? INR)</label>
                <input type="number" min="0.0001" step="0.0001" value={form.exchange_rate_snapshot}
                  onChange={e => set("exchange_rate_snapshot", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>INR Equivalent</label>
                <div className={`${inputCls} bg-gray-50 text-gray-500 cursor-default`}>₹ {fmt(baseAmt)}</div>
              </div>
            </div>
          )}

          {/* Row 2: Payment Type + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Payment Type *</label>
              <select value={form.payment_type} onChange={e => set("payment_type", e.target.value)} className={inputCls}>
                {PAYMENT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Payment Date *</label>
              <input type="date" required value={form.payment_date}
                onChange={e => set("payment_date", e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Transaction Reference */}
          <div>
            <label className={labelCls}>Transaction Reference</label>
            <input type="text" placeholder="UTR / Cheque No. / Receipt No."
              value={form.transaction_reference} onChange={e => set("transaction_reference", e.target.value)} className={inputCls} />
          </div>

          {/* Status + Remarks */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Payment Status</label>
              <select value={form.payment_status} onChange={e => set("payment_status", e.target.value)} className={inputCls}>
                {PAYMENT_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Remarks</label>
              <input type="text" placeholder="Optional notes" value={form.remarks}
                onChange={e => set("remarks", e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Summary strip */}
          <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-xs flex items-center justify-between">
            <span className="text-gray-500">After this payment, pending will be:</span>
            <span className={`font-bold ${Math.max(0, parseFloat(String(invoice.pending_amount)) - parseFloat(form.payment_amount || "0")) <= 0 ? "text-emerald-600" : "text-amber-600"}`}>
              {invoice.currency_code} {fmt(Math.max(0, parseFloat(String(invoice.pending_amount)) - parseFloat(form.payment_amount || "0")))}
            </span>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={addPmt.isPending}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ backgroundColor: G }}>
              {addPmt.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {addPmt.isPending ? "Saving…" : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Payments History Row ─────────────────────────────────────────────────── */
function PaymentsHistory({ invoiceId }: { invoiceId: number }) {
  const { data, isLoading } = useInvoicePaymentsList(invoiceId);
  const deletePmt = useDeleteInvoicePayment();
  const { toast } = useToast();

  async function handleDelete(p: InvoicePayment) {
    if (!confirm(`Delete payment of ${p.currency_code} ${fmt(p.payment_amount)} on ${fmtDate(p.payment_date)}?`)) return;
    try {
      await deletePmt.mutateAsync(p.payment_id);
      toast({ title: "Payment deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  if (isLoading) return (
    <div className="px-6 py-4 flex items-center gap-2 text-xs text-gray-400">
      <Loader2 size={12} className="animate-spin" /> Loading payments…
    </div>
  );

  const payments = data?.data ?? [];
  if (!payments.length) return (
    <div className="px-6 py-5 text-center text-sm text-gray-400">
      No payments recorded yet.
    </div>
  );

  return (
    <div className="px-6 pb-4">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-400 border-b border-gray-100">
            <th className="py-2 text-left font-semibold uppercase tracking-wide">#</th>
            <th className="py-2 text-left font-semibold uppercase tracking-wide">Date</th>
            <th className="py-2 text-left font-semibold uppercase tracking-wide">Type</th>
            <th className="py-2 text-right font-semibold uppercase tracking-wide">Amount</th>
            <th className="py-2 text-right font-semibold uppercase tracking-wide">INR</th>
            <th className="py-2 text-left font-semibold uppercase tracking-wide">Reference</th>
            <th className="py-2 text-left font-semibold uppercase tracking-wide">Status</th>
            <th className="py-2 text-left font-semibold uppercase tracking-wide">Remarks</th>
            <th className="py-2 text-left font-semibold uppercase tracking-wide">By</th>
            <th className="py-2 w-8"></th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p, i) => (
            <tr key={p.payment_id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
              <td className="py-2 text-gray-400">{i + 1}</td>
              <td className="py-2 text-gray-700">{fmtDate(p.payment_date)}</td>
              <td className="py-2 text-gray-700">{p.payment_type}</td>
              <td className="py-2 text-right font-medium text-gray-900 tabular-nums">
                {p.currency_code} {fmt(p.payment_amount)}
              </td>
              <td className="py-2 text-right text-gray-600 tabular-nums">₹{fmt(p.base_currency_amount)}</td>
              <td className="py-2 text-gray-500 max-w-[120px] truncate" title={p.transaction_reference}>
                {p.transaction_reference || "—"}
              </td>
              <td className="py-2">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${STATUS_PILL[p.payment_status] ?? "bg-gray-100 text-gray-500"}`}>
                  {PMT_STATUS_ICON[p.payment_status]}
                  {p.payment_status}
                </span>
              </td>
              <td className="py-2 text-gray-400 max-w-[100px] truncate" title={p.remarks}>{p.remarks || "—"}</td>
              <td className="py-2 text-gray-400 max-w-[90px] truncate" title={p.created_by}>{p.created_by || "—"}</td>
              <td className="py-2">
                <button onClick={() => handleDelete(p)} disabled={deletePmt.isPending}
                  className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 size={12} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Invoice Row ──────────────────────────────────────────────────────────── */
function InvoiceRow({
  inv, index, expanded, onToggle, onPay,
}: { inv: AccountInvoice; index: number; expanded: boolean; onToggle: () => void; onPay: () => void }) {
  const direction = inv.invoice_direction;
  const pct = inv.total_amount > 0 ? Math.min(100, (inv.received_amount / inv.total_amount) * 100) : 0;

  return (
    <>
      <tr className={`border-b border-gray-100 transition-colors ${expanded ? "bg-[#FDFBF2]" : "hover:bg-amber-50/20"}`}>
        <td className="px-4 py-3 text-gray-400 text-xs font-medium">{index + 1}</td>
        <td className="px-4 py-3">
          <button onClick={onToggle} className="flex items-center gap-1.5 text-left group">
            {expanded
              ? <ChevronDown size={14} className="text-gray-400 shrink-0" />
              : <ChevronRight size={14} className="text-gray-400 shrink-0 group-hover:text-gray-600" />}
            <span className="font-mono font-bold text-sm" style={{ color: G }}>{inv.invoice_no}</span>
          </button>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            {direction === "Client"
              ? <ArrowDownLeft size={13} className="text-emerald-500 shrink-0" />
              : <ArrowUpRight size={13} className="text-amber-500 shrink-0" />}
            <span className="text-sm text-gray-700 font-medium truncate max-w-[160px]">
              {direction === "Vendor" ? inv.vendor_name || inv.party_name : inv.party_name}
            </span>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${direction === "Client" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
            {direction === "Client" ? "Receivable" : "Payable"}
          </span>
        </td>
        <td className="px-4 py-3 text-right tabular-nums text-sm font-medium text-gray-900">
          {inv.currency_code} {fmt(inv.total_amount)}
        </td>
        <td className="px-4 py-3 text-right tabular-nums text-sm text-emerald-600 font-medium">
          {fmt(inv.received_amount)}
        </td>
        <td className="px-4 py-3 text-right tabular-nums text-sm font-bold text-red-500">
          {fmt(inv.pending_amount)}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden min-w-[60px]">
              <div className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: pct >= 100 ? "#10b981" : pct > 0 ? G : "#d1d5db" }} />
            </div>
            <span className="text-[10px] text-gray-400 tabular-nums w-9 text-right">{Math.round(pct)}%</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_PILL[inv.invoice_status] ?? "bg-gray-100 text-gray-500"}`}>
            {inv.invoice_status}
          </span>
        </td>
        <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(inv.invoice_date)}</td>
        <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(inv.due_date)}</td>
        <td className="px-4 py-3 text-xs text-gray-400 text-center">
          {inv.payment_count > 0 ? (
            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: G }}>
              {inv.payment_count}
            </span>
          ) : "—"}
        </td>
        <td className="px-4 py-3">
          {inv.invoice_status !== "Paid" && inv.invoice_status !== "Cancelled" && (
            <button onClick={onPay}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90"
              style={{ backgroundColor: G }}>
              <Plus size={11} /> Pay
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-[#FDFBF2] border-b border-[#C6AF4B]/10">
          <td colSpan={13} className="p-0">
            <PaymentsHistory invoiceId={inv.id} />
          </td>
        </tr>
      )}
    </>
  );
}

/* ─── Summary Card ─────────────────────────────────────────────────────────── */
function SummaryCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: React.ReactNode }) {
  return (
    <div className={`${card} px-5 py-4 flex items-center gap-4`}>
      <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}18` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-gray-900 tabular-nums mt-0.5">{value}</p>
      </div>
    </div>
  );
}

/* ─── Main Accounts Page ───────────────────────────────────────────────────── */
export default function Accounts() {
  const [, setLocation] = useLocation();
  const { data: meData } = useMe();
  const { toast } = useToast();

  const [direction, setDirection] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [payModal, setPayModal] = useState<AccountInvoice | null>(null);

  const { data, isLoading, refetch } = useAccountInvoices({ direction, status, search, page });
  const invoices = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 30));

  const totalPending    = invoices.reduce((s, i) => s + parseFloat(String(i.pending_amount ?? 0)), 0);
  const totalReceivable = invoices.filter(i => i.invoice_direction === "Client").reduce((s, i) => s + parseFloat(String(i.pending_amount ?? 0)), 0);
  const totalPayable    = invoices.filter(i => i.invoice_direction === "Vendor").reduce((s, i) => s + parseFloat(String(i.pending_amount ?? 0)), 0);
  const paidCount       = invoices.filter(i => i.invoice_status === "Paid").length;

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  function handleLogout() {
    localStorage.removeItem("zarierp_token");
    setLocation("/login");
  }

  const TABLE_HEADERS = ["#", "Invoice", "Party", "Type", "Total", "Received", "Pending", "Progress", "Status", "Date", "Due", "Pmts", "Action"];

  return (
    <div className="min-h-screen" style={{ background: "#F8F6F0" }}>
      <TopNavbar
        username={(meData as any)?.name ?? (meData as any)?.username ?? ""}
        role={(meData as any)?.role ?? ""}
        onLogout={handleLogout}
        isLoggingOut={false}
      />

      <div className="py-6 px-6 max-w-screen-2xl mx-auto space-y-5">

        {/* Page header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Wallet size={22} style={{ color: G }} /> Accounts
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">Invoice payment tracking — client receivables &amp; vendor payables</p>
          </div>
          <button onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors shadow-sm">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard label="Total Outstanding" value={`₹${fmt(totalPending)}`} color="#ef4444" icon={<Wallet size={18} />} />
          <SummaryCard label="Receivable (Clients)" value={`₹${fmt(totalReceivable)}`} color="#10b981" icon={<ArrowDownLeft size={18} />} />
          <SummaryCard label="Payable (Vendors)" value={`₹${fmt(totalPayable)}`} color="#f59e0b" icon={<ArrowUpRight size={18} />} />
          <SummaryCard label={`Fully Paid (${paidCount})`} value={`of ${invoices.length} shown`} color={G} icon={<CheckCircle2 size={18} />} />
        </div>

        {/* Filter bar */}
        <div className={`${card} px-4 py-3`}>
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 min-w-[220px]">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchInput} onChange={e => setSearchInput(e.target.value)}
                  placeholder="Search invoice no. or party…"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-[#C6AF4B] focus:ring-2 focus:ring-[#C6AF4B]/20"
                />
              </div>
              <button type="submit" className="px-3 py-2 rounded-xl text-white text-sm font-medium flex items-center gap-1" style={{ backgroundColor: G }}>
                <Search size={13} />
              </button>
              {search && (
                <button type="button" onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}
                  className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                  <X size={14} />
                </button>
              )}
            </form>

            {/* Direction filter */}
            <div className="flex items-center gap-1">
              {[["all","All"],["Client","Receivable"],["Vendor","Payable"]].map(([v, l]) => (
                <button key={v} onClick={() => { setDirection(v); setPage(1); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${direction === v ? "text-white shadow-sm" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                  style={direction === v ? { backgroundColor: G } : {}}>
                  {l}
                </button>
              ))}
            </div>

            {/* Status filter */}
            <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:border-[#C6AF4B]">
              <option value="all">All Statuses</option>
              {["Generated","Sent","Partially Paid","Overdue","Paid"].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className={card}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F8F6F0] border-b border-[#C6AF4B]/15">
                <tr>
                  {TABLE_HEADERS.map(h => (
                    <th key={h} className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap ${["Total","Received","Pending"].includes(h) ? "text-right" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      {Array.from({ length: 13 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-4 py-16 text-center">
                      <FileText size={40} className="mx-auto text-gray-200 mb-3" />
                      <p className="text-sm font-medium text-gray-400">No invoices found</p>
                      <p className="text-xs text-gray-300 mt-1">Invoices with status Draft &amp; Cancelled are excluded</p>
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv, i) => (
                    <InvoiceRow
                      key={inv.id}
                      inv={inv}
                      index={i}
                      expanded={expandedId === inv.id}
                      onToggle={() => setExpandedId(prev => prev === inv.id ? null : inv.id)}
                      onPay={() => setPayModal(inv)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > 30 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <span className="text-xs text-gray-400">{total} invoices total</span>
              <div className="flex items-center gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                  Previous
                </button>
                <span className="text-xs text-gray-500">{page} / {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {payModal && <PaymentModal invoice={payModal} onClose={() => setPayModal(null)} />}
    </div>
  );
}
