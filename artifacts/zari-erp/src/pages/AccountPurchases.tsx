import { useState, useEffect, useRef } from "react";
import {
  Search, CreditCard, X, CheckCircle2, Clock, AlertTriangle,
  Package, Wallet, RefreshCw, ArrowRight, Filter,
  ShoppingCart, Truck, Wrench, Receipt, ChevronLeft, ChevronRight, Building2,
  PanelRightClose, PanelRightOpen,
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

const PAYMENT_TYPES = ["Bank Transfer", "UPI", "NEFT", "RTGS", "Cash", "Cheque", "Other"];
const REF_TYPES = [
  { value: "", label: "All Types" },
  { value: "Purchase Receipt", label: "Purchase Receipt" },
  { value: "Costing Outsource", label: "Costing Outsource" },
  { value: "Artisan", label: "Artisan" },
  { value: "Shipping", label: "Shipping" },
  { value: "Other Expense", label: "Other Expense" },
];
const DEPARTMENTS = [
  { value: "", label: "All Departments" },
  { value: "Purchase Receipt Vendor Bills", label: "Purchase Receipt Vendor Bills" },
  { value: "Costing Outsource", label: "Costing Outsource" },
  { value: "Artisan Labor", label: "Artisan Labor" },
  { value: "Shipping Vendor", label: "Shipping Vendor" },
];
const STATUS_TABS = ["All", "Unpaid", "Partially Paid", "Paid", "Pending"];

/* ── helpers ─────────────────────────────────────────── */
function fmtDate(s: string | null) {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return s; }
}
function fmtAmt(n: number | string | null) {
  const v = parseFloat(String(n ?? 0));
  return isNaN(v) ? "₹0.00" : `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtCrLk(n: number | string | null) {
  const v = parseFloat(String(n ?? 0));
  if (isNaN(v)) return "₹0";
  if (v >= 1_00_00_000) return `₹${(v / 1_00_00_000).toFixed(2)} Cr`;
  if (v >= 1_00_000)    return `₹${(v / 1_00_000).toFixed(2)} L`;
  if (v >= 1_000)       return `₹${(v / 1_000).toFixed(1)} K`;
  return fmtAmt(v);
}
function statusBadge(status: string) {
  const map: Record<string, string> = {
    Paid:             "bg-emerald-100 text-emerald-700",
    Completed:        "bg-emerald-100 text-emerald-700",
    "Partially Paid": "bg-amber-100 text-amber-700",
    Unpaid:           "bg-red-100 text-red-700",
    Pending:          "bg-blue-100 text-blue-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${map[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status}
    </span>
  );
}
function refTypeBadge(rt: string) {
  const map: Record<string, string> = {
    "Purchase Receipt": "bg-blue-50 text-blue-700",
    "Costing Outsource": "bg-purple-50 text-purple-700",
    "Artisan": "bg-orange-50 text-orange-700",
    "Shipping": "bg-teal-50 text-teal-700",
    "Other Expense": "bg-gray-100 text-gray-700",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${map[rt] ?? "bg-gray-100 text-gray-600"}`}>
      {rt}
    </span>
  );
}

/* ── KPI Card ──────────────────────────────────────── */
function KpiCard({ icon, label, value, sub, accent = G, loading }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; accent?: string; loading?: boolean;
}) {
  return (
    <div className={`${CARD} p-4 flex flex-col gap-2.5`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: accent }}>{label}</p>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accent}18` }}>
          <span style={{ color: accent }}>{icon}</span>
        </div>
      </div>
      {loading
        ? <div className="h-7 w-28 bg-gray-100 rounded-lg animate-pulse" />
        : <p className="text-[1.6rem] font-black leading-none tracking-tight" style={{ color: SL }}>{value}</p>
      }
      {sub && !loading && <p className="text-[11px] text-gray-400 leading-snug">{sub}</p>}
    </div>
  );
}

/* ── PaymentModal ────────────────────────────────────── */
function PaymentModal({ row, onClose, onSuccess }: {
  row: any; onClose: () => void; onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    payment_amount: "",
    payment_type: "Bank Transfer",
    transaction_reference: "",
    payment_date: new Date().toISOString().slice(0, 10),
    remarks: "",
  });
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(form.payment_amount);
    if (!amt || amt <= 0) {
      toast({ title: "Enter a valid payment amount", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      await customFetch<any>("/api/account-purchases/record-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ref_type: row.ref_type, source_id: row.source_id,
          vendor_name: row.vendor_name, vendor_id: row.vendor_id_text,
          ...form,
        }),
      });
      toast({
        title: "Payment recorded successfully",
        description: `${fmtAmt(amt)} paid to ${row.vendor_name}`,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err?.data?.error ?? err?.message ?? "Payment failed";
      toast({ title: "Payment Error", description: msg, variant: "destructive" });
    } finally { setSaving(false); }
  }

  const pendingAmt = parseFloat(row.pending_amount ?? row.amount ?? 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#C6AF4B]/20 overflow-hidden">
        <div className="h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${G}, transparent)` }} />
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold" style={{ color: SL }}>Record Vendor Payment</h2>
            <p className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">{row.vendor_name} · {row.ref_type}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {pendingAmt > 0 && (
          <div className="mx-5 mt-4 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-600 shrink-0" />
            <p className="text-sm text-amber-700">
              Pending: <strong>{fmtAmt(pendingAmt)}</strong> of {fmtAmt(row.amount)}
            </p>
          </div>
        )}

        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LBL}>Amount *</label>
              <input
                type="number" min="0.01" step="0.01" required className={INP}
                placeholder={`Max ${fmtAmt(pendingAmt)}`} value={form.payment_amount}
                onChange={e => setForm(p => ({ ...p, payment_amount: e.target.value }))} />
            </div>
            <div>
              <label className={LBL}>Date *</label>
              <input type="date" required className={INP} value={form.payment_date}
                onChange={e => setForm(p => ({ ...p, payment_date: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className={LBL}>Payment Mode</label>
            <select className={INP} value={form.payment_type}
              onChange={e => setForm(p => ({ ...p, payment_type: e.target.value }))}>
              {PAYMENT_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={LBL}>Transaction Reference / UTR</label>
            <input className={INP} placeholder="UTR / Cheque No."
              value={form.transaction_reference}
              onChange={e => setForm(p => ({ ...p, transaction_reference: e.target.value }))} />
          </div>
          <div>
            <label className={LBL}>Remarks</label>
            <textarea rows={2} className={INP} placeholder="Optional notes"
              value={form.remarks}
              onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
              style={{ background: G }}>
              {saving ? "Saving…" : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════ */
export default function AccountPurchases() {
  const { data: me } = useGetMe();
  const role = (me as any)?.role ?? "";
  const hasAccess = role === "admin" || role === "accounts";

  const [fromDate, setFromDate]     = useState("");
  const [toDate, setToDate]         = useState("");
  const [refType, setRefType]       = useState("");
  const [department, setDepartment] = useState("");
  const [statusTab, setStatusTab]   = useState("All");
  const [search, setSearch]         = useState("");
  const [page, setPage]             = useState(1);

  const [summary, setSummary]         = useState<any>(null);
  const [liabilities, setLiabilities] = useState<any[]>([]);
  const [totalRows, setTotalRows]     = useState(0);
  const [topVendors, setTopVendors]   = useState<any[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingTable, setLoadingTable]     = useState(true);
  const [paymentRow, setPaymentRow]         = useState<any>(null);
  const [sidebarOpen, setSidebarOpen]       = useState(true);
  const [refreshKey, setRefreshKey]         = useState(0);
  const [pendingSearch, setPendingSearch]   = useState("");

  const abortRef = useRef<AbortController | null>(null);

  /* ── single source-of-truth fetch for table ───── */
  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoadingTable(true);
    const p = new URLSearchParams();
    if (fromDate)           p.set("from_date", fromDate);
    if (toDate)             p.set("to_date", toDate);
    if (refType)            p.set("ref_type", refType);
    if (department)         p.set("department", department);
    if (statusTab !== "All") p.set("status", statusTab);
    if (search)             p.set("search", search);
    p.set("page", String(page));
    p.set("limit", String(PAGE_SIZE));

    customFetch<{ data: any[]; total: number }>(
      `/api/account-purchases/unified-liabilities?${p}`,
      { signal: ctrl.signal }
    )
      .then(data => {
        if (ctrl.signal.aborted) return;
        setLiabilities(data.data ?? []);
        setTotalRows(data.total ?? 0);
        setLoadingTable(false);
      })
      .catch((err: any) => {
        if (ctrl.signal.aborted || err?.name === "AbortError") return;
        setLiabilities([]);
        setLoadingTable(false);
      });

    return () => ctrl.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, fromDate, toDate, refType, department, statusTab, search, refreshKey]);

  /* ── summary + top vendors ─────────────────────── */
  useEffect(() => {
    const p = new URLSearchParams();
    if (fromDate) p.set("from_date", fromDate);
    if (toDate)   p.set("to_date", toDate);
    setLoadingSummary(true);

    customFetch<any>(`/api/account-purchases/unified-summary?${p}`)
      .then(d => { setSummary(d); setLoadingSummary(false); })
      .catch(() => setLoadingSummary(false));

    customFetch<any[]>("/api/account-purchases/top-vendors-pending")
      .then(d => setTopVendors(Array.isArray(d) ? d : []))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate]);

  function resetFilters() {
    setFromDate(""); setToDate(""); setRefType("");
    setDepartment(""); setSearch(""); setStatusTab("All");
    setPage(1);
  }

  function changeFilter(fn: () => void) { fn(); setPage(1); }

  function refresh() {
    const p = new URLSearchParams();
    if (fromDate) p.set("from_date", fromDate);
    if (toDate)   p.set("to_date", toDate);
    setLoadingSummary(true);

    customFetch<any>(`/api/account-purchases/unified-summary?${p}`)
      .then(d => { setSummary(d); setLoadingSummary(false); })
      .catch(() => setLoadingSummary(false));

    customFetch<any[]>("/api/account-purchases/top-vendors-pending")
      .then(d => setTopVendors(Array.isArray(d) ? d : []))
      .catch(() => {});

    setRefreshKey(k => k + 1);
  }

  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const hasFilters = !!(fromDate || toDate || refType || department || search);

  if (me && !hasAccess) {
    return (
      <div className="min-h-screen bg-[#f8f9fb] flex flex-col">
        <TopNavbar />
        <div className="flex-1 flex items-center justify-center">
          <div className={`${CARD} p-10 text-center max-w-sm`}>
            <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={28} className="text-red-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-800">Access Restricted</h2>
            <p className="text-sm text-gray-500 mt-2">This page is for Accounts and Admin users only.</p>
          </div>
        </div>
      </div>
    );
  }

  const kpiCards = [
    { icon: <ShoppingCart size={16}/>, label: "Total PO Amount",      value: fmtCrLk(summary?.poAmount),        accent: "#3B82F6" },
    { icon: <Receipt size={16}/>,      label: "PR Vendor Bills",       value: fmtCrLk(summary?.prBills),         accent: "#8B5CF6",
      sub: `Paid: ${fmtCrLk(summary?.prBillsPaid)} · Pending: ${fmtCrLk(summary?.prBillsPending)}` },
    { icon: <Wrench size={16}/>,       label: "Costing Outsource",     value: fmtCrLk(summary?.outsourceAmount), accent: "#EC4899",
      sub: `Paid: ${fmtCrLk(summary?.outsourcePaid)} · Pending: ${fmtCrLk(summary?.outsourcePending)}` },
    { icon: <Building2 size={16}/>,    label: "Artisan Costs",         value: fmtCrLk(summary?.artisanCosts),    accent: "#F59E0B" },
    { icon: <Truck size={16}/>,        label: "Shipping Charges",      value: fmtCrLk(summary?.shippingCosts),   accent: "#14B8A6" },
    { icon: <Package size={16}/>,      label: "Other Expenses",        value: fmtCrLk(summary?.otherExpenses),   accent: "#6B7280",
      sub: `Paid: ${fmtCrLk(summary?.otherPaid)}` },
    { icon: <CheckCircle2 size={16}/>, label: "Total Paid to Vendors", value: fmtCrLk(summary?.totalPaidVendors), accent: "#10B981" },
    { icon: <Clock size={16}/>,        label: "Pending Payables",      value: fmtCrLk(summary?.pendingPayables), accent: "#EF4444" },
  ];

  return (
    <div className="min-h-screen bg-[#f8f9fb] flex flex-col">
      <TopNavbar />

      <div className="flex flex-1 overflow-hidden">

        {/* ── Main Column ──────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* Gold top bar */}
          <div className="h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${G}, transparent)` }} />

          <div className="px-6 py-5 space-y-5">

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-px w-6 rounded-full" style={{ background: `linear-gradient(90deg, ${G}, transparent)` }} />
                  <p className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: G }}>Accounts</p>
                </div>
                <h1 className="text-2xl font-black" style={{
                  background: `linear-gradient(135deg, ${SL}, ${G_DIM})`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}>Purchases & Payables</h1>
                <p className="text-sm text-gray-400 mt-0.5">Unified outgoing vendor payables across all departments</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setSidebarOpen(o => !o)}
                  title={sidebarOpen ? "Hide vendors panel" : "Show vendors panel"}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 transition-all">
                  {sidebarOpen ? <PanelRightClose size={15}/> : <PanelRightOpen size={15}/>}
                  <span className="hidden sm:inline">{sidebarOpen ? "Hide" : "Vendors"}</span>
                </button>
                <button onClick={refresh}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold text-white shadow-sm hover:opacity-90 active:scale-95 transition-all"
                  style={{ background: G }}>
                  <RefreshCw size={13}/> Refresh
                </button>
              </div>
            </div>

            {/* ── Filters ─────────────────────────────────── */}
            <div className={`${CARD} p-4`}>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
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
                <div>
                  <label className={LBL}>Reference Type</label>
                  <select className={INP} value={refType}
                    onChange={e => changeFilter(() => setRefType(e.target.value))}>
                    {REF_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LBL}>Department</label>
                  <select className={INP} value={department}
                    onChange={e => changeFilter(() => setDepartment(e.target.value))}>
                    {DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
              </div>

              {hasFilters && (
                <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Active:</span>
                  {fromDate   && <Chip label={`From ${fromDate}`} color="gold" />}
                  {toDate     && <Chip label={`To ${toDate}`} color="gold" />}
                  {refType    && <Chip label={refType} color="blue" />}
                  {department && <Chip label={department} color="purple" />}
                  {search     && <Chip label={`"${search}"`} color="gray" />}
                  <button onClick={resetFilters}
                    className="ml-auto text-xs text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors">
                    <X size={11}/> Clear All
                  </button>
                </div>
              )}
            </div>

            {/* ── KPI Cards ────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {kpiCards.map(c => (
                <KpiCard key={c.label} icon={c.icon} label={c.label} value={c.value}
                  sub={(c as any).sub} accent={c.accent} loading={loadingSummary} />
              ))}
            </div>

            {/* ── Status Tabs + Table ──────────────────────── */}
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

              {/* Table Search Bar */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50/50">
                <div className="relative flex-1 max-w-sm">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30"
                    placeholder="Vendor name or reference no…"
                    value={pendingSearch}
                    onChange={e => setPendingSearch(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { setSearch(pendingSearch); setPage(1); } }}
                  />
                </div>
                <button
                  onClick={() => { setSearch(pendingSearch); setPage(1); }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm hover:opacity-90 active:scale-95 transition-all shrink-0"
                  style={{ background: G }}>
                  Search
                </button>
                {search && (
                  <button
                    onClick={() => { setPendingSearch(""); setSearch(""); setPage(1); }}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:text-red-500 border border-gray-200 hover:border-red-200 bg-white transition-all shrink-0">
                    <X size={11}/> Clear
                  </button>
                )}
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px]">
                  <thead className="sticky top-0 bg-white border-b border-gray-100 z-10">
                    <tr>
                      <th className={`${TH} text-center w-10`}>Sr.</th>
                      <th className={TH}>Date</th>
                      <th className={TH}>Reference Type</th>
                      <th className={TH}>Reference No.</th>
                      <th className={TH}>Vendor Name</th>
                      <th className={TH}>Department</th>
                      <th className={`${TH} text-right`}>Amount</th>
                      <th className={`${TH} text-right`}>Paid</th>
                      <th className={`${TH} text-right`}>Pending</th>
                      <th className={TH}>Status</th>
                      <th className={TH}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingTable ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          {Array.from({ length: 11 }).map((_, j) => (
                            <td key={j} className={TD}>
                              <div className="h-3.5 bg-gray-100 rounded animate-pulse"
                                style={{ width: `${50 + (j * 13) % 40}%` }} />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : liabilities.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-16 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <Filter size={34} className="text-gray-200" />
                            <p className="text-sm text-gray-400">No payables found for the selected filters</p>
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
                      liabilities.map((row, i) => {
                        const settled = row.status === "Paid" || row.status === "Completed";
                        const srNo = (page - 1) * PAGE_SIZE + i + 1;
                        return (
                          <tr key={`${row.ref_type}-${row.source_id}-${i}`}
                            className="border-b border-gray-50 hover:bg-[#C6AF4B]/[0.03] transition-colors group">
                            <td className={`${TD} text-center text-xs font-medium text-gray-400`}>{srNo}</td>
                            <td className={`${TD} text-gray-500`}>{fmtDate(row.date)}</td>
                            <td className={TD}>{refTypeBadge(row.ref_type)}</td>
                            <td className={`${TD} font-mono text-xs text-gray-500`}>{row.ref_number || "—"}</td>
                            <td className={TD}>
                              <span className="font-semibold text-gray-900 group-hover:text-[#3B3F5C] transition-colors">
                                {row.vendor_name || "—"}
                              </span>
                            </td>
                            <td className={`${TD} text-xs text-gray-500`}>{row.department || "—"}</td>
                            <td className={`${TD} text-right font-semibold`} style={{ color: SL }}>
                              {fmtAmt(row.amount)}
                            </td>
                            <td className={`${TD} text-right font-medium text-emerald-600`}>
                              {fmtAmt(row.paid_amount)}
                            </td>
                            <td className={`${TD} text-right font-semibold ${
                              parseFloat(row.pending_amount) > 0 ? "text-red-600" : "text-gray-400"
                            }`}>
                              {fmtAmt(row.pending_amount)}
                            </td>
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
                                  <CreditCard size={11}/> Pay
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
        </div>

        {/* ── Right Sidebar ─────────────────────────────── */}
        <div className={`shrink-0 border-l border-[#C6AF4B]/15 bg-white px-4 py-5 flex-col gap-4 overflow-y-auto transition-all duration-300 ${
          sidebarOpen ? "w-72 flex" : "hidden"
        }`}>
          <div className="h-0.5 -mx-4 -mt-5 mb-1" style={{ background: `linear-gradient(90deg, ${G}, transparent)` }} />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: G }}>Top Vendors Pending</p>
            <p className="text-xs text-gray-400 mt-0.5">Highest outstanding vendor bills</p>
          </div>

          {topVendors.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 size={24} className="text-emerald-400" />
              </div>
              <p className="text-xs text-gray-400 text-center">All vendor bills are settled</p>
            </div>
          ) : (
            <div className="space-y-2 flex-1">
              {topVendors.map((v, i) => (
                <button key={v.vendor_id ?? i}
                  className="group w-full flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-[#C6AF4B]/40 hover:bg-[#C6AF4B]/[0.04] transition-all text-left"
                  onClick={() => { setSearch(v.vendor_name); setPage(1); }}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0"
                      style={{ background: (["#EF4444","#F59E0B","#3B82F6","#8B5CF6","#14B8A6"] as string[])[i] ?? G }}>
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{v.vendor_name}</p>
                      <p className="text-[10px] text-gray-400">{v.bill_count} bill{v.bill_count !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <p className="text-xs font-bold text-red-600">{fmtCrLk(v.total_pending)}</p>
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
                <p className="text-[10px] font-black uppercase tracking-wide" style={{ color: G }}>Total Outstanding</p>
              </div>
              <p className="text-xl font-black text-red-600">
                {fmtCrLk(topVendors.reduce((s, v) => s + parseFloat(v.total_pending ?? 0), 0))}
              </p>
              <p className="text-[10px] text-gray-400 mt-1">Across {topVendors.length} vendor{topVendors.length !== 1 ? "s" : ""}</p>
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

/* ── Chip helper ──────────────────────────────────── */
function Chip({ label, color }: { label: string; color: "gold" | "blue" | "purple" | "gray" }) {
  const cls = {
    gold:   "bg-[#C6AF4B]/10 text-[#A8943E]",
    blue:   "bg-blue-50 text-blue-700",
    purple: "bg-purple-50 text-purple-700",
    gray:   "bg-gray-100 text-gray-700",
  }[color];
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>;
}