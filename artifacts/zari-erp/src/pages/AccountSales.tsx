import { useState, useEffect, useRef } from "react";
import {
  Search, CreditCard, X, CheckCircle2,
  Wallet, RefreshCw, ArrowRight, Filter,
  ChevronLeft, ChevronRight,
  PanelRightClose, PanelRightOpen,
  TrendingUp, DollarSign, AlertCircle, Clock,
  FileText, ReceiptText, Banknote,
} from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react";
import TopNavbar from "@/components/layout/TopNavbar";
import { useToast } from "@/hooks/use-toast";

/* ── theme ─────────────────────────────────────────── */
const G    = "#C6AF4B";
const G_DIM = "#A8943E";
const SL   = "#3B3F5C";
const CARD = "rounded-2xl bg-white border border-[#C6AF4B]/15 shadow-[0_2px_16px_rgba(198,175,75,0.12),0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_6px_28px_rgba(198,175,75,0.22),0_2px_6px_rgba(0,0,0,0.08)] transition-all duration-300";
const TH   = "px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap";
const TD   = "px-3 py-3 text-sm text-gray-800";
const INP  = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30";
const LBL  = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5";
const PAGE_SIZE = 10;

const PAYMENT_TYPES = ["Bank Transfer", "UPI", "NEFT", "RTGS", "Wire Transfer", "Cash", "Cheque", "Other"];
const REF_TYPES = [
  { value: "",                      label: "All Categories" },
  { value: "Final Invoice",         label: "Sales Invoice" },
  { value: "Advance",               label: "Advance Payment" },
  { value: "Proforma Invoice",      label: "Proforma Invoice" },
  { value: "Credit Note Adjustment",label: "Credit Note Adjustment" },
];
const STATUS_TABS = ["All", "Pending", "Partially Received", "Paid", "Overdue"];
const CURRENCIES  = ["INR", "USD", "EUR", "GBP", "AED"];

/* ── helpers ───────────────────────────────────────── */
const fmtAmt  = (v: any) =>
  `₹${parseFloat(v ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtCrLk = (v: any) => {
  const n = parseFloat(v ?? 0);
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};
const fmtDate = (d: any) => {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

function statusBadge(s: string) {
  const cfg: Record<string, string> = {
    "Paid":               "bg-emerald-100 text-emerald-700",
    "Partially Received": "bg-blue-100 text-blue-700",
    "Pending":            "bg-amber-100 text-amber-700",
    "Overdue":            "bg-red-100 text-red-700",
    "Draft":              "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${cfg[s] ?? "bg-gray-100 text-gray-600"}`}>
      {s}
    </span>
  );
}

function refTypeBadge(t: string) {
  const cfg: Record<string, string> = {
    "Final Invoice":         "bg-[#C6AF4B]/10 text-[#A8943E]",
    "Advance":               "bg-blue-50 text-blue-700",
    "Proforma Invoice":      "bg-purple-50 text-purple-700",
    "Credit Note Adjustment":"bg-rose-50 text-rose-700",
  };
  const label: Record<string, string> = {
    "Final Invoice":         "Invoice",
    "Advance":               "Advance",
    "Proforma Invoice":      "Proforma",
    "Credit Note Adjustment":"Credit Note",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${cfg[t] ?? "bg-gray-100 text-gray-600"}`}>
      {label[t] ?? t}
    </span>
  );
}

/* ══════════════════════════════════════════════════════
   PAYMENT MODAL
══════════════════════════════════════════════════════ */
function PaymentModal({ row, onClose, onSuccess }: { row: any; onClose: () => void; onSuccess: () => void }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    payment_amount:        String(parseFloat(row.pending_amount ?? 0)),
    payment_type:          "Bank Transfer",
    transaction_id:        "",
    payment_date:          today,
    currency_code:         row.currency_code ?? "INR",
    exchange_rate_snapshot:"1",
    remarks:               "",
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const pendingAmt = parseFloat(row.pending_amount ?? row.amount ?? 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(form.payment_amount);
    if (!amt || amt <= 0) {
      toast({ title: "Enter a valid payment amount", variant: "destructive" }); return;
    }
    if (amt > pendingAmt + 0.01) {
      toast({ title: `Amount exceeds pending balance of ${fmtAmt(pendingAmt)}`, variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      await customFetch<any>("/api/account-sales/record-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_id:   row.source_id,
          ref_type:    row.ref_type,
          client_name: row.client_name,
          client_id:   row.client_id,
          ...form,
        }),
      });
      toast({
        title: "Payment recorded successfully",
        description: `${fmtAmt(amt)} received from ${row.client_name}`,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err?.data?.error ?? err?.message ?? "Payment failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className={`${CARD} w-full max-w-md`} onClick={e => e.stopPropagation()}>
        <div className="h-1 rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${G}, ${G_DIM})` }} />
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: G }}>Client Payment Entry</p>
              <p className="text-base font-bold text-gray-800 mt-0.5">{row.client_name}</p>
              <p className="text-xs text-gray-400">{row.ref_number} · Pending: <span className="font-semibold text-red-600">{fmtAmt(pendingAmt)}</span></p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
              <X size={16}/>
            </button>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={LBL}>Payment Amount <span className="text-red-500">*</span></label>
                <input type="number" step="0.01" min="0.01" max={pendingAmt + 0.01} required
                  className={INP} value={form.payment_amount}
                  onChange={e => set("payment_amount", e.target.value)} />
              </div>
              <div>
                <label className={LBL}>Payment Type</label>
                <select className={INP} value={form.payment_type} onChange={e => set("payment_type", e.target.value)}>
                  {PAYMENT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={LBL}>Currency</label>
                <select className={INP} value={form.currency_code} onChange={e => set("currency_code", e.target.value)}>
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={LBL}>Payment Date</label>
                <input type="date" className={INP} value={form.payment_date} onChange={e => set("payment_date", e.target.value)} />
              </div>
              <div>
                <label className={LBL}>Exchange Rate</label>
                <input type="number" step="0.0001" min="0.0001" className={INP}
                  value={form.exchange_rate_snapshot} onChange={e => set("exchange_rate_snapshot", e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className={LBL}>Transaction ID / Reference</label>
                <input className={INP} placeholder="e.g. UTR123456789" value={form.transaction_id}
                  onChange={e => set("transaction_id", e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className={LBL}>Remarks</label>
                <textarea rows={2} className={`${INP} resize-none`} placeholder="Optional notes…"
                  value={form.remarks} onChange={e => set("remarks", e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-60 transition-all"
                style={{ background: `linear-gradient(135deg, ${G}, ${G_DIM})` }}>
                {saving ? "Saving…" : "Record Payment"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ── KPI Card ───────────────────────────────────────── */
function KpiCard({ icon, label, value, sub, accent, loading }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; accent?: string; loading?: boolean;
}) {
  return (
    <div className={`${CARD} p-4 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: accent ?? G }}>{label}</p>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${accent ?? G}18` }}>
          <span style={{ color: accent ?? G }}>{icon}</span>
        </div>
      </div>
      {loading ? (
        <div className="h-7 bg-gray-100 rounded-lg animate-pulse w-3/4" />
      ) : (
        <p className="text-2xl font-black tracking-tight" style={{ color: SL }}>{value}</p>
      )}
      {sub && !loading && <p className="text-[11px] text-gray-400">{sub}</p>}
    </div>
  );
}

/* ── Chip helper ─────────────────────────────────────── */
function Chip({ label, color }: { label: string; color: "gold" | "blue" | "purple" | "gray" }) {
  const cls = {
    gold:   "bg-[#C6AF4B]/10 text-[#A8943E]",
    blue:   "bg-blue-50 text-blue-700",
    purple: "bg-purple-50 text-purple-700",
    gray:   "bg-gray-100 text-gray-700",
  }[color];
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>;
}

/* ══════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════ */
export default function AccountSales() {
  const { data: me } = useGetMe();
  const role = (me as any)?.role ?? "";
  const hasAccess = role === "admin" || role === "accounts";

  /* ── filter state ──────────────────────────────── */
  const [fromDate,  setFromDate]  = useState("");
  const [toDate,    setToDate]    = useState("");
  const [refType,   setRefType]   = useState("");
  const [statusTab, setStatusTab] = useState("All");
  const [search,    setSearch]    = useState("");
  const [page,      setPage]      = useState(1);
  const [refNo,     setRefNo]     = useState("");

  /* ── ui state ──────────────────────────────────── */
  const [receivables,    setReceivables]    = useState<any[]>([]);
  const [totalRows,      setTotalRows]      = useState(0);
  const [topClients,     setTopClients]     = useState<any[]>([]);
  const [summary,        setSummary]        = useState<any>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingTable,   setLoadingTable]   = useState(true);
  const [paymentRow,     setPaymentRow]     = useState<any>(null);
  const [sidebarOpen,    setSidebarOpen]    = useState(true);
  const [refreshKey,     setRefreshKey]     = useState(0);
  const [pendingSearch,  setPendingSearch]  = useState("");
  const [pendingRefNo,   setPendingRefNo]   = useState("");

  const abortRef = useRef<AbortController | null>(null);

  /* ── table fetch ───────────────────────────────── */
  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoadingTable(true);
    const p = new URLSearchParams();
    if (fromDate)           p.set("from_date", fromDate);
    if (toDate)             p.set("to_date", toDate);
    if (refType)            p.set("ref_type", refType);
    if (refNo)              p.set("ref_no", refNo);
    if (statusTab !== "All") p.set("status", statusTab);
    if (search)             p.set("search", search);
    p.set("page", String(page));
    p.set("limit", String(PAGE_SIZE));

    customFetch<{ data: any[]; total: number }>(
      `/api/account-sales/unified-receivables?${p}`,
      { signal: ctrl.signal }
    )
      .then(data => {
        setReceivables(data.data ?? []);
        setTotalRows(data.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoadingTable(false));

    return () => ctrl.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, fromDate, toDate, refType, refNo, statusTab, search, refreshKey]);

  /* ── summary + top clients ─────────────────────── */
  useEffect(() => {
    const p = new URLSearchParams();
    if (fromDate) p.set("from_date", fromDate);
    if (toDate)   p.set("to_date", toDate);

    setLoadingSummary(true);
    Promise.all([
      customFetch<any>(`/api/account-sales/unified-summary?${p}`),
      customFetch<any[]>("/api/account-sales/top-clients-pending"),
    ])
      .then(([s, tc]) => { setSummary(s); setTopClients(tc ?? []); })
      .catch(() => {})
      .finally(() => setLoadingSummary(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate]);

  function resetFilters() {
    setFromDate(""); setToDate(""); setRefType("");
    setRefNo(""); setSearch(""); setStatusTab("All");
    setPendingSearch(""); setPendingRefNo("");
    setPage(1);
  }

  function changeFilter(fn: () => void) { fn(); setPage(1); }

  function refresh() {
    setRefreshKey(k => k + 1);
    const p = new URLSearchParams();
    if (fromDate) p.set("from_date", fromDate);
    if (toDate)   p.set("to_date", toDate);
    setLoadingSummary(true);
    Promise.all([
      customFetch<any>(`/api/account-sales/unified-summary?${p}`),
      customFetch<any[]>("/api/account-sales/top-clients-pending"),
    ])
      .then(([s, tc]) => { setSummary(s); setTopClients(tc ?? []); })
      .catch(() => {})
      .finally(() => setLoadingSummary(false));
  }

  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const hasFilters = !!(fromDate || toDate || refType || refNo || search);

  /* ── access gate ───────────────────────────────── */
  if (me && !hasAccess) {
    return (
      <div className="min-h-screen bg-[#f8f9fb] flex flex-col">
        <TopNavbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <AlertCircle size={40} className="mx-auto text-gray-300" />
            <p className="text-gray-500 font-medium">Access restricted to Accounts users</p>
          </div>
        </div>
      </div>
    );
  }

  /* ── KPI cards ─────────────────────────────────── */
  const kpiCards = [
    {
      label: "Total Invoice Amount",
      value: fmtCrLk(summary?.total_invoice_amount),
      icon:  <FileText size={16}/>,
      accent: G,
    },
    {
      label: "Total Received",
      value: fmtCrLk(summary?.total_received),
      icon:  <TrendingUp size={16}/>,
      sub:   `Payments: ${fmtAmt(summary?.total_payments)}`,
      accent: "#10B981",
    },
    {
      label: "Pending Receivables",
      value: fmtCrLk(summary?.total_pending),
      icon:  <Clock size={16}/>,
      accent: "#F59E0B",
    },
    {
      label: "Overdue Receivables",
      value: fmtCrLk(summary?.overdue_amount),
      icon:  <AlertCircle size={16}/>,
      accent: "#EF4444",
    },
    {
      label: "Advance Received",
      value: fmtCrLk(summary?.advance_total),
      icon:  <Banknote size={16}/>,
      accent: "#8B5CF6",
    },
    {
      label: "Net Outstanding",
      value: fmtCrLk((parseFloat(summary?.total_pending ?? 0) - parseFloat(summary?.overdue_amount ?? 0))),
      icon:  <DollarSign size={16}/>,
      sub:   `Excl. overdue`,
      accent: SL,
    },
  ];

  /* ═══════════════════════════════════════ RENDER ═══ */
  return (
    <div className="min-h-screen bg-[#f8f9fb] flex flex-col">
      <TopNavbar />

      {/* ── Gold top accent ─── */}
      <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${G}, ${G_DIM} 60%, transparent)` }} />

      {/* ── Header ─────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] mb-0.5" style={{ color: G }}>ACCOUNTS</p>
          <h1 className="text-2xl font-black tracking-tight">
            <span style={{ color: SL }}>Sales & </span>
            <span style={{ background: `linear-gradient(135deg, ${SL}, ${G})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Receivables
            </span>
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">Unified incoming client payments across all departments</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            {sidebarOpen
              ? <><PanelRightClose size={14}/> Hide</>
              : <><PanelRightOpen  size={14}/> Clients</>}
          </button>
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm hover:opacity-90 transition-all"
            style={{ background: `linear-gradient(135deg, ${G}, ${G_DIM})` }}>
            <RefreshCw size={13}/> Refresh
          </button>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ── Date Filters ─────────────────────────── */}
          <div className={`${CARD} p-4`}>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label className={LBL}>From Date</label>
                <input type="date" className={INP} value={fromDate}
                  onChange={e => changeFilter(() => setFromDate(e.target.value))} />
              </div>
              <div>
                <label className={LBL}>To Date</label>
                <input type="date" className={INP} value={toDate}
                  onChange={e => changeFilter(() => setToDate(e.target.value))} />
              </div>
            </div>
            {hasFilters && (
              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Active:</span>
                {fromDate && <Chip label={`From ${fromDate}`} color="gold" />}
                {toDate   && <Chip label={`To ${toDate}`} color="gold" />}
                {refType  && <Chip label={REF_TYPES.find(r => r.value === refType)?.label ?? refType} color="blue" />}
                {refNo    && <Chip label={`Ref: ${refNo}`} color="purple" />}
                {search   && <Chip label={`"${search}"`} color="gray" />}
                <button onClick={resetFilters}
                  className="ml-auto text-xs text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors">
                  <X size={11}/> Clear All
                </button>
              </div>
            )}
          </div>

          {/* ── KPI Cards ───────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {kpiCards.map(c => (
              <KpiCard key={c.label} icon={c.icon} label={c.label} value={c.value}
                sub={(c as any).sub} accent={c.accent} loading={loadingSummary} />
            ))}
          </div>

          {/* ── Status Tabs + Table ──────────────────── */}
          <div className={`${CARD} overflow-hidden`}>

            {/* Tabs */}
            <div className="flex items-center gap-0.5 px-4 pt-3 border-b border-gray-100 overflow-x-auto">
              {STATUS_TABS.map(tab => (
                <button key={tab}
                  onClick={() => changeFilter(() => setStatusTab(tab))}
                  className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg whitespace-nowrap transition-colors border-b-2 ${
                    statusTab === tab
                      ? "border-[#C6AF4B] text-[#C6AF4B]"
                      : "border-transparent text-gray-500 hover:text-gray-800"
                  }`}>
                  {tab}
                </button>
              ))}
              <div className="ml-auto pb-2 pr-1 shrink-0">
                <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                  {totalRows.toLocaleString()} records
                </span>
              </div>
            </div>

            {/* Inline search toolbar */}
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
              <select
                className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 h-9"
                value={refType}
                onChange={e => { setRefType(e.target.value); setPage(1); }}>
                {REF_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <input
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 w-40 h-9"
                placeholder="Reference No…"
                value={pendingRefNo}
                onChange={e => setPendingRefNo(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { setRefNo(pendingRefNo); setPage(1); } }}
              />
              <div className="relative flex-1 min-w-[160px] max-w-xs">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 h-9"
                  placeholder="Client name…"
                  value={pendingSearch}
                  onChange={e => setPendingSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { setSearch(pendingSearch); setRefNo(pendingRefNo); setPage(1); } }}
                />
              </div>
              <button
                onClick={() => { setSearch(pendingSearch); setRefNo(pendingRefNo); setPage(1); }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm hover:opacity-90 active:scale-95 transition-all shrink-0 h-9"
                style={{ background: G }}>
                Search
              </button>
              {(search || refNo || refType) && (
                <button
                  onClick={() => { setPendingSearch(""); setPendingRefNo(""); setSearch(""); setRefNo(""); setRefType(""); setPage(1); }}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:text-red-500 border border-gray-200 hover:border-red-200 bg-white transition-all shrink-0 h-9">
                  <X size={11}/> Clear
                </button>
              )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1020px]">
                <thead className="sticky top-0 bg-white border-b border-gray-100 z-10">
                  <tr>
                    <th className={`${TH} text-center w-10`}>Sr.</th>
                    <th className={TH}>Date</th>
                    <th className={TH}>Category</th>
                    <th className={TH}>Reference No.</th>
                    <th className={TH}>Client Name</th>
                    <th className={TH}>Order Ref</th>
                    <th className={`${TH} text-right`}>Amount</th>
                    <th className={`${TH} text-right`}>Received</th>
                    <th className={`${TH} text-right`}>Pending</th>
                    <th className={TH}>Currency</th>
                    <th className={TH}>Status</th>
                    <th className={TH}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingTable ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        {Array.from({ length: 12 }).map((_, j) => (
                          <td key={j} className={TD}>
                            <div className="h-3.5 bg-gray-100 rounded animate-pulse"
                              style={{ width: `${50 + (j * 13) % 40}%` }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : receivables.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Filter size={34} className="text-gray-200" />
                          <p className="text-sm text-gray-400">No receivables found for the selected filters</p>
                          {(hasFilters || statusTab !== "All") && (
                            <button onClick={resetFilters}
                              className="text-xs font-semibold hover:underline"
                              style={{ color: G }}>
                              Clear all filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    receivables.map((row, i) => {
                      const settled = row.status === "Paid";
                      const srNo = (page - 1) * PAGE_SIZE + i + 1;
                      const isOverdue = row.status === "Overdue";
                      return (
                        <tr key={`${row.source_id}-${i}`}
                          className={`border-b border-gray-50 hover:bg-[#C6AF4B]/[0.03] transition-colors group ${
                            isOverdue ? "bg-red-50/30" : ""
                          }`}>
                          <td className={`${TD} text-center text-xs font-medium text-gray-400`}>{srNo}</td>
                          <td className={`${TD} text-gray-500`}>{fmtDate(row.date)}</td>
                          <td className={TD}>{refTypeBadge(row.ref_type)}</td>
                          <td className={`${TD} font-mono text-xs text-gray-500`}>{row.ref_number || "—"}</td>
                          <td className={TD}>
                            <span className="font-semibold text-gray-900 group-hover:text-[#3B3F5C] transition-colors">
                              {row.client_name || "—"}
                            </span>
                          </td>
                          <td className={`${TD} text-xs text-gray-400`}>{row.order_ref || "—"}</td>
                          <td className={`${TD} text-right font-semibold`} style={{ color: SL }}>
                            {fmtAmt(row.amount)}
                          </td>
                          <td className={`${TD} text-right font-medium text-emerald-600`}>
                            {fmtAmt(row.received_amount)}
                          </td>
                          <td className={`${TD} text-right font-semibold ${
                            parseFloat(row.pending_amount) > 0 ? (isOverdue ? "text-red-600" : "text-amber-600") : "text-gray-400"
                          }`}>
                            {fmtAmt(row.pending_amount)}
                          </td>
                          <td className={`${TD} text-xs font-medium text-gray-500`}>{row.currency_code || "INR"}</td>
                          <td className={TD}>{statusBadge(row.status)}</td>
                          <td className={TD}>
                            {settled ? (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                                <CheckCircle2 size={12}/> Settled
                              </span>
                            ) : (
                              <button
                                onClick={() => setPaymentRow(row)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm hover:opacity-90 active:scale-95 transition-all"
                                style={{ background: G }}>
                                <CreditCard size={11}/> Receive
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  Page {page} of {totalPages} · {totalRows.toLocaleString()} records
                </p>
                <div className="flex items-center gap-1">
                  <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                    className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <ChevronLeft size={14}/>
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pg = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                    return pg <= totalPages ? (
                      <button key={pg} onClick={() => setPage(pg)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                          pg === page ? "text-white shadow-sm" : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                        style={pg === page ? { background: G } : {}}>
                        {pg}
                      </button>
                    ) : null;
                  })}
                  <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                    className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <ChevronRight size={14}/>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right Sidebar ──────────────────────────── */}
        <div className={`shrink-0 border-l border-[#C6AF4B]/15 bg-white px-4 py-5 flex-col gap-4 overflow-y-auto transition-all duration-300 ${
          sidebarOpen ? "w-72 flex" : "hidden"
        }`}>
          <div className="h-0.5 -mx-4 -mt-5 mb-1" style={{ background: `linear-gradient(90deg, ${G}, transparent)` }} />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: G }}>Top Clients Pending</p>
            <p className="text-xs text-gray-400 mt-0.5">Highest outstanding receivables</p>
          </div>

          {topClients.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 size={24} className="text-emerald-400" />
              </div>
              <p className="text-xs text-gray-400 text-center">All client receivables are settled</p>
            </div>
          ) : (
            <div className="space-y-2 flex-1">
              {topClients.map((c, i) => (
                <button key={c.client_id ?? i}
                  className="group w-full flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-[#C6AF4B]/40 hover:bg-[#C6AF4B]/[0.04] transition-all text-left"
                  onClick={() => { setSearch(c.client_name); setPage(1); }}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0"
                      style={{ background: (["#EF4444","#F59E0B","#3B82F6","#8B5CF6","#14B8A6"] as string[])[i] ?? G }}>
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{c.client_name}</p>
                      <p className="text-[10px] text-gray-400">{c.invoice_count} invoice{c.invoice_count !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <p className="text-xs font-bold text-amber-600">{fmtCrLk(c.total_pending)}</p>
                    <ArrowRight size={10} className="text-gray-300 group-hover:text-[#C6AF4B] transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="mt-auto pt-4 border-t border-gray-100">
            <div className={`${CARD} p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <Wallet size={14} style={{ color: G }} />
                <p className="text-[10px] font-black uppercase tracking-wide" style={{ color: G }}>Total Pending</p>
              </div>
              <p className="text-xl font-black text-amber-600">
                {fmtCrLk(topClients.reduce((s, c) => s + parseFloat(c.total_pending ?? 0), 0))}
              </p>
              <p className="text-[10px] text-gray-400 mt-1">Across {topClients.length} client{topClients.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>
      </div>

      {paymentRow && (
        <PaymentModal
          row={paymentRow}
          onClose={() => setPaymentRow(null)}
          onSuccess={() => setRefreshKey(k => k + 1)}
        />
      )}
    </div>
  );
}
