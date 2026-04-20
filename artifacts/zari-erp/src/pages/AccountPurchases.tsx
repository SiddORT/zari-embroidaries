import { useState, useEffect, useCallback } from "react";
import {
  Search, CreditCard, X, CheckCircle2, Clock, AlertTriangle,
  Package, Wallet, RefreshCw, ArrowRight, Filter,
  ShoppingCart, Truck, Wrench, Receipt, ChevronLeft, ChevronRight, Building2,
} from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react";
import TopNavbar from "@/components/layout/TopNavbar";
import { useToast } from "@/hooks/use-toast";

/* ── theme ───────────────────────────────────────────── */
const G  = "#C6AF4B";
const SL = "#3B3F5C";
const CARD = "rounded-2xl bg-white border border-[#C6AF4B]/15 shadow-[0_2px_16px_rgba(198,175,75,0.10),0_1px_3px_rgba(0,0,0,0.05)]";
const TH   = "px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap";
const TD   = "px-3 py-3 text-sm text-gray-800";
const INP  = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 bg-white";
const LBL  = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1";
const BTN_G = "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold text-white transition-all shadow-sm hover:opacity-90 active:scale-95";

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
function statusBadge(status: string) {
  const map: Record<string, string> = {
    Paid: "bg-emerald-100 text-emerald-700",
    Completed: "bg-emerald-100 text-emerald-700",
    "Partially Paid": "bg-amber-100 text-amber-700",
    Unpaid: "bg-red-100 text-red-700",
    Pending: "bg-blue-100 text-blue-700",
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

/* ── SummaryCard ────────────────────────────────────── */
function SummaryCard({ icon, label, value, sub, color = G, loading }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color?: string; loading?: boolean;
}) {
  return (
    <div className={`${CARD} p-4 flex flex-col gap-3 hover:shadow-md transition-shadow`}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide leading-tight">{label}</p>
        {loading
          ? <div className="h-6 w-24 bg-gray-100 rounded animate-pulse mt-1.5" />
          : <p className="text-xl font-bold mt-0.5" style={{ color: SL }}>{value}</p>
        }
        {sub && !loading && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

/* ── PaymentModal ───────────────────────────────────── */
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
      const res = await customFetch("/api/account-purchases/record-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ref_type: row.ref_type, source_id: row.source_id,
          vendor_name: row.vendor_name, vendor_id: row.vendor_id_text,
          ...form,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Payment failed");
      toast({
        title: "Vendor payment recorded successfully",
        description: `${fmtAmt(amt)} paid to ${row.vendor_name}`,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  const pendingAmt = parseFloat(row.pending_amount ?? row.amount ?? 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#C6AF4B]/20 overflow-hidden">
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-gray-100"
          style={{ background: `linear-gradient(135deg, ${SL}06, ${G}08)` }}>
          <div>
            <h2 className="text-base font-bold" style={{ color: SL }}>Vendor Payment Entry</h2>
            <p className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">{row.vendor_name} · {row.ref_type}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {pendingAmt > 0 && (
          <div className="mx-5 mt-4 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-600 shrink-0" />
            <p className="text-sm text-amber-700">
              Pending: <strong>{fmtAmt(pendingAmt)}</strong> of {fmtAmt(row.amount)}
            </p>
          </div>
        )}

        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LBL}>Payment Amount *</label>
              <input
                type="number" min="0.01" step="0.01" required className={INP}
                placeholder={`Max ${fmtAmt(pendingAmt)}`} value={form.payment_amount}
                onChange={e => setForm(p => ({ ...p, payment_amount: e.target.value }))} />
            </div>
            <div>
              <label className={LBL}>Payment Date *</label>
              <input type="date" required className={INP} value={form.payment_date}
                onChange={e => setForm(p => ({ ...p, payment_date: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className={LBL}>Payment Type</label>
            <select className={INP} value={form.payment_type}
              onChange={e => setForm(p => ({ ...p, payment_type: e.target.value }))}>
              {PAYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className={LBL}>Transaction ID / Reference</label>
            <input className={INP} placeholder="UTR / Cheque No. / Reference"
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
              className={`${BTN_G} flex-1 justify-center`}
              style={{ background: saving ? "#aaa" : G }}>
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {saving ? "Recording…" : "Record Payment"}
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
  const PAGE_SIZE = 20;

  const [summary, setSummary]         = useState<any>(null);
  const [liabilities, setLiabilities] = useState<any[]>([]);
  const [totalRows, setTotalRows]     = useState(0);
  const [topVendors, setTopVendors]   = useState<any[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingTable, setLoadingTable]     = useState(true);
  const [paymentRow, setPaymentRow]         = useState<any>(null);

  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const p = new URLSearchParams();
      if (fromDate) p.set("from_date", fromDate);
      if (toDate)   p.set("to_date", toDate);
      const res = await customFetch(`/api/account-purchases/unified-summary?${p}`);
      setSummary(await res.json());
    } catch { /* ignore */ } finally { setLoadingSummary(false); }
  }, [fromDate, toDate]);

  const fetchLiabilities = useCallback(async (pg: number) => {
    setLoadingTable(true);
    try {
      const p = new URLSearchParams();
      if (fromDate)   p.set("from_date", fromDate);
      if (toDate)     p.set("to_date", toDate);
      if (refType)    p.set("ref_type", refType);
      if (department) p.set("department", department);
      if (statusTab !== "All") p.set("status", statusTab);
      if (search)     p.set("search", search);
      p.set("page", String(pg));
      p.set("limit", String(PAGE_SIZE));
      const res = await customFetch(`/api/account-purchases/unified-liabilities?${p}`);
      const data = await res.json();
      setLiabilities(data.data ?? []);
      setTotalRows(data.total ?? 0);
    } catch { setLiabilities([]); } finally { setLoadingTable(false); }
  }, [fromDate, toDate, refType, department, statusTab, search]);

  const fetchTopVendors = useCallback(async () => {
    try {
      const res = await customFetch("/api/account-purchases/top-vendors-pending");
      const data = await res.json();
      setTopVendors(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchSummary(); fetchTopVendors(); }, [fetchSummary, fetchTopVendors]);

  useEffect(() => {
    setPage(1);
    fetchLiabilities(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, refType, department, statusTab, search]);

  useEffect(() => { fetchLiabilities(page); }, [page, fetchLiabilities]);

  function refresh() { fetchSummary(); fetchLiabilities(page); fetchTopVendors(); }

  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));

  if (me && !hasAccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <TopNavbar />
        <div className="flex-1 flex items-center justify-center">
          <div className={`${CARD} p-10 text-center max-w-sm`}>
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} className="text-red-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-800">Access Restricted</h2>
            <p className="text-sm text-gray-500 mt-2">This page is available to Accounts and Admin users only.</p>
          </div>
        </div>
      </div>
    );
  }

  const cards = [
    { icon: <ShoppingCart size={18}/>, label: "Total PO Amount",       value: fmtAmt(summary?.poAmount),          color: "#3B82F6" },
    { icon: <Receipt size={18}/>,      label: "PR Vendor Bills",        value: fmtAmt(summary?.prBills),           sub: `Paid: ${fmtAmt(summary?.prBillsPaid)} · Pending: ${fmtAmt(summary?.prBillsPending)}`, color: "#8B5CF6" },
    { icon: <Wrench size={18}/>,       label: "Costing Outsource",      value: fmtAmt(summary?.outsourceAmount),   sub: `Paid: ${fmtAmt(summary?.outsourcePaid)} · Pending: ${fmtAmt(summary?.outsourcePending)}`, color: "#EC4899" },
    { icon: <Building2 size={18}/>,    label: "Artisan Costs",          value: fmtAmt(summary?.artisanCosts),      color: "#F59E0B" },
    { icon: <Truck size={18}/>,        label: "Shipping Charges",       value: fmtAmt(summary?.shippingCosts),     color: "#14B8A6" },
    { icon: <Package size={18}/>,      label: "Other Expenses",         value: fmtAmt(summary?.otherExpenses),     sub: `Paid: ${fmtAmt(summary?.otherPaid)}`, color: "#6B7280" },
    { icon: <CheckCircle2 size={18}/>, label: "Total Paid to Vendors",  value: fmtAmt(summary?.totalPaidVendors),  color: "#10B981" },
    { icon: <Clock size={18}/>,        label: "Pending Payables",       value: fmtAmt(summary?.pendingPayables),   color: "#EF4444" },
  ];

  return (
    <div className="min-h-screen bg-gray-50/60 flex flex-col">
      <TopNavbar />

      <div className="flex flex-1 overflow-hidden">

        {/* ── Main Column ──────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: SL }}>Accounts · Purchases</h1>
              <p className="text-sm text-gray-500 mt-0.5">Unified outgoing vendor payables across all departments</p>
            </div>
            <button onClick={refresh} className={`${BTN_G} shrink-0`} style={{ background: G }}>
              <RefreshCw size={14}/> Refresh
            </button>
          </div>

          {/* ── Global Filters ──────────────────────────── */}
          <div className={`${CARD} p-4`}>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
              <div>
                <label className={LBL}>From Date</label>
                <input type="date" className={INP} value={fromDate}
                  onChange={e => setFromDate(e.target.value)} />
              </div>
              <div>
                <label className={LBL}>To Date</label>
                <input type="date" className={INP} value={toDate}
                  onChange={e => setToDate(e.target.value)} />
              </div>
              <div>
                <label className={LBL}>Reference Type</label>
                <select className={INP} value={refType} onChange={e => setRefType(e.target.value)}>
                  {REF_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className={LBL}>Department</label>
                <select className={INP} value={department} onChange={e => setDepartment(e.target.value)}>
                  {DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div className="lg:col-span-2">
                <label className={LBL}>Search</label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    className={`${INP} pl-8`}
                    placeholder="Vendor name or reference number…"
                    value={search} onChange={e => setSearch(e.target.value)} />
                </div>
              </div>
            </div>
            {(fromDate || toDate || refType || department || search) && (
              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-400">Active:</span>
                {fromDate    && <span className="text-xs bg-[#C6AF4B]/10 text-[#A8943E] px-2 py-0.5 rounded-full">From {fromDate}</span>}
                {toDate      && <span className="text-xs bg-[#C6AF4B]/10 text-[#A8943E] px-2 py-0.5 rounded-full">To {toDate}</span>}
                {refType     && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{refType}</span>}
                {department  && <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">{department}</span>}
                {search      && <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">"{search}"</span>}
                <button
                  onClick={() => { setFromDate(""); setToDate(""); setRefType(""); setDepartment(""); setSearch(""); }}
                  className="text-xs text-red-500 hover:text-red-700 ml-auto flex items-center gap-1 transition-colors">
                  <X size={11}/> Clear All
                </button>
              </div>
            )}
          </div>

          {/* ── KPI Summary Cards ────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {cards.map(c => (
              <SummaryCard key={c.label} icon={c.icon} label={c.label} value={c.value}
                sub={(c as any).sub} color={c.color} loading={loadingSummary} />
            ))}
          </div>

          {/* ── Status Tabs + Table ──────────────────────── */}
          <div className={`${CARD} overflow-hidden`}>
            {/* Tabs */}
            <div className="flex items-center gap-0.5 px-4 pt-3 border-b border-gray-100 overflow-x-auto">
              {STATUS_TABS.map(tab => (
                <button key={tab} onClick={() => setStatusTab(tab)}
                  className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg whitespace-nowrap transition-colors border-b-2 ${
                    statusTab === tab
                      ? "border-[#C6AF4B] text-[#C6AF4B]"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}>
                  {tab}
                </button>
              ))}
              <div className="ml-auto pb-2 pr-1 shrink-0">
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                  {totalRows} records
                </span>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px]">
                <thead className="sticky top-0 bg-gray-50/95 backdrop-blur-sm border-b border-gray-100 z-10">
                  <tr>
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
                    Array.from({ length: 10 }).map((_, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        {Array.from({ length: 10 }).map((_, j) => (
                          <td key={j} className={TD}>
                            <div className="h-4 bg-gray-100 rounded animate-pulse"
                              style={{ width: `${50 + (j * 17) % 40}%` }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : liabilities.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Filter size={36} className="text-gray-200" />
                          <p className="text-sm text-gray-400">No payables found for the selected filters</p>
                          {(fromDate || toDate || refType || department || search || statusTab !== "All") && (
                            <button
                              onClick={() => { setFromDate(""); setToDate(""); setRefType(""); setDepartment(""); setSearch(""); setStatusTab("All"); }}
                              className="text-xs text-[#C6AF4B] hover:underline">
                              Clear all filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    liabilities.map((row, i) => {
                      const settled = row.status === "Paid" || row.status === "Completed";
                      return (
                        <tr key={`${row.ref_type}-${row.source_id}-${i}`}
                          className="border-b border-gray-50 hover:bg-[#C6AF4B]/[0.03] transition-colors group">
                          <td className={`${TD} text-gray-500`}>{fmtDate(row.date)}</td>
                          <td className={TD}>{refTypeBadge(row.ref_type)}</td>
                          <td className={`${TD} font-mono text-xs text-gray-600`}>{row.ref_number || "—"}</td>
                          <td className={TD}>
                            <span className="font-medium text-gray-900 group-hover:text-[#3B3F5C] transition-colors">
                              {row.vendor_name || "—"}
                            </span>
                          </td>
                          <td className={TD}>
                            <span className="text-xs text-gray-500">{row.department || "—"}</span>
                          </td>
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
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-white">
                <p className="text-xs text-gray-500">
                  Page {page} of {totalPages} · {totalRows} total records
                </p>
                <div className="flex items-center gap-1">
                  <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                    className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <ChevronLeft size={14}/>
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pg = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                    return pg <= totalPages ? (
                      <button key={pg} onClick={() => setPage(pg)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                          pg === page
                            ? "text-white shadow-sm"
                            : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                        style={pg === page ? { background: G } : {}}>
                        {pg}
                      </button>
                    ) : null;
                  })}
                  <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                    className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <ChevronRight size={14}/>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right Sidebar: Vendor Liability Panel ────── */}
        <div className="w-72 shrink-0 border-l border-gray-100 bg-white px-4 py-5 hidden lg:flex flex-col gap-4 overflow-y-auto">
          <div>
            <h3 className="text-sm font-bold" style={{ color: SL }}>Top Vendors Pending</h3>
            <p className="text-xs text-gray-400 mt-0.5">Highest outstanding vendor bills</p>
          </div>

          {topVendors.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10">
              <CheckCircle2 size={30} className="text-emerald-200" />
              <p className="text-xs text-gray-400 text-center">All vendor bills are settled</p>
            </div>
          ) : (
            <div className="space-y-2 flex-1">
              {topVendors.map((v, i) => (
                <button key={v.vendor_id ?? i}
                  className="group w-full flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-[#C6AF4B]/40 hover:bg-[#C6AF4B]/[0.03] transition-all text-left"
                  onClick={() => setSearch(v.vendor_name)}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ background: (["#EF4444","#F59E0B","#3B82F6","#8B5CF6","#14B8A6"] as string[])[i] ?? G }}>
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{v.vendor_name}</p>
                      <p className="text-xs text-gray-400">{v.bill_count} bill{v.bill_count !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <p className="text-xs font-bold text-red-600">{fmtAmt(v.total_pending)}</p>
                    <ArrowRight size={10} className="text-gray-300 group-hover:text-[#C6AF4B] transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="mt-auto">
            <div className={`${CARD} p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <Wallet size={14} style={{ color: G }} />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Outstanding</p>
              </div>
              <p className="text-xl font-bold text-red-600">
                {fmtAmt(topVendors.reduce((s, v) => s + parseFloat(v.total_pending ?? 0), 0))}
              </p>
              <p className="text-xs text-gray-400 mt-1">Across {topVendors.length} vendors</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Payment Modal ─────────────────────────────── */}
      {paymentRow && (
        <PaymentModal
          row={paymentRow}
          onClose={() => setPaymentRow(null)}
          onSuccess={refresh}
        />
      )}
    </div>
  );
}
