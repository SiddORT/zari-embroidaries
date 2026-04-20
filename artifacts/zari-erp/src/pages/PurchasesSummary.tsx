import { useState, useEffect, useCallback } from "react";
import {
  ShoppingCart, Receipt, Wallet, AlertCircle,
  FileText, BarChart2, CheckCircle, TrendingDown,
} from "lucide-react";
import TopNavbar from "../components/layout/TopNavbar";

const G     = "#C6AF4B";
const G_DIM = "#A8943E";
const SLATE = "#3B3F5C";

const card = [
  "rounded-2xl overflow-hidden bg-white",
  "border border-[#C6AF4B]/15",
  "shadow-[0_2px_16px_rgba(198,175,75,0.10),0_1px_3px_rgba(0,0,0,0.05)]",
  "hover:shadow-[0_6px_28px_rgba(198,175,75,0.20)] hover:-translate-y-0.5 transition-all duration-300",
].join(" ");

const INP = [
  "border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white",
  "focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30",
].join(" ");

const tok = () => localStorage.getItem("zarierp_token") || "";

function fmt(n: number) {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (n >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(2)} L`;
  if (n >= 1_000)       return `₹${(n / 1_000).toFixed(1)} K`;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

const GoldBar = () => (
  <div className="h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${G}, transparent)` }} />
);

function KpiCard({
  label, value, sub, Icon, accent = G,
}: {
  label: string; value: string; sub: string; Icon: React.ElementType; accent?: string;
}) {
  return (
    <div className={card}>
      <GoldBar />
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <p className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: G }}>{label}</p>
          <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${accent}18`, border: `1px solid ${accent}35` }}>
            <Icon className="h-4 w-4" style={{ color: accent }} />
          </div>
        </div>
        <p className="text-[2rem] font-black leading-none tracking-tight text-gray-900">{value}</p>
        <p className="text-[11px] mt-1 text-gray-400">{sub}</p>
      </div>
    </div>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 mt-8 mb-4">
      <div className="h-px flex-1" style={{ background: `${G}30` }} />
      <span className="text-[9px] font-black uppercase tracking-[0.25em]" style={{ color: G }}>{text}</span>
      <div className="h-px flex-1" style={{ background: `${G}30` }} />
    </div>
  );
}

export default function PurchasesSummary() {
  const [fromDate, setFromDate] = useState("");
  const [toDate,   setToDate]   = useState("");
  const [vendorId, setVendorId] = useState("");
  const [vendors,  setVendors]  = useState<{ vendorId: number; brandName: string }[]>([]);
  const [data,     setData]     = useState<any>(null);
  const [loading,  setLoading]  = useState(true);
  const [toast,    setToast]    = useState(false);

  useEffect(() => {
    fetch("/api/vendors/all", { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.json())
      .then(d => setVendors(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (fromDate) p.set("from_date", fromDate);
    if (toDate)   p.set("to_date",   toDate);
    if (vendorId) p.set("vendor_id", vendorId);
    try {
      const r = await fetch(`/api/accounts/purchases-summary?${p}`, {
        headers: { Authorization: `Bearer ${tok()}` },
      });
      const j = await r.json();
      setData(j);
      setToast(true);
      setTimeout(() => setToast(false), 3000);
    } catch {}
    finally { setLoading(false); }
  }, [fromDate, toDate, vendorId]);

  useEffect(() => { load(); }, [load]);

  const d = data ?? {};

  return (
    <div className="min-h-screen bg-[#F8F7F4]">
      <TopNavbar />

      {/* toast */}
      {toast && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium text-emerald-800 bg-emerald-50 border border-emerald-200">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          Financial summary loaded successfully
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.25em] mb-1" style={{ color: G }}>Accounts</p>
            <h1 className="text-2xl font-black text-gray-900">Purchases Summary</h1>
            <p className="text-sm text-gray-400 mt-0.5">Purchase orders, vendor bills and payables overview</p>
          </div>
          <div className="h-10 w-10 rounded-2xl flex items-center justify-center"
            style={{ background: `${G}18`, border: `1px solid ${G}35` }}>
            <TrendingDown className="h-5 w-5" style={{ color: G_DIM }} />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-end mb-8 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">From</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className={INP} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">To</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className={INP} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Vendor</label>
            <select value={vendorId} onChange={e => setVendorId(e.target.value)} className={`${INP} min-w-[180px]`}>
              <option value="">All Vendors</option>
              {vendors.map(v => <option key={v.vendorId} value={v.vendorId}>{v.brandName}</option>)}
            </select>
          </div>
          {(fromDate || toDate || vendorId) && (
            <button
              onClick={() => { setFromDate(""); setToDate(""); setVendorId(""); }}
              className="text-xs text-gray-400 hover:text-gray-700 underline self-end pb-2"
            >Clear</button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-48">
            <div className="h-8 w-8 rounded-full border-2 animate-spin" style={{ borderColor: `${G} transparent ${G} transparent` }} />
          </div>
        ) : (
          <>
            {/* Primary KPIs */}
            <SectionLabel text="Purchase Overview" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Total Purchase Orders" value={String(d.poCount ?? 0)}          sub={`${d.poApproved ?? 0} approved · ${d.poPending ?? 0} pending`} Icon={ShoppingCart} />
              <KpiCard label="Total Vendor Bills"    value={fmt(d.totalBills ?? 0)}          sub={`${d.billCount ?? 0} receipts`}                               Icon={Receipt}      accent="#8b5cf6" />
              <KpiCard label="Total Paid to Vendors" value={fmt(d.totalPaid ?? 0)}           sub="Vendor payments made"                                         Icon={Wallet}       accent="#10b981" />
              <KpiCard label="Pending Payables"      value={fmt(d.pendingPayables ?? 0)}     sub="Yet to be paid"                                               Icon={AlertCircle}  accent="#f59e0b" />
            </div>

            {/* Expenses */}
            <SectionLabel text="Expense Panel" />
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <KpiCard label="Other Expenses Total" value={fmt(d.totalExpenses ?? 0)}  sub={`${d.expenseCount ?? 0} expense entries`} Icon={FileText} accent="#ef4444" />
              <KpiCard label="Expenses Paid"        value={fmt(d.paidExpenses ?? 0)}   sub="Settled expense amount"                   Icon={Wallet}   accent="#10b981" />
              <KpiCard label="Expenses Pending"     value={fmt(Math.max(0, (d.totalExpenses ?? 0) - (d.paidExpenses ?? 0)))}
                sub="Unsettled expenses" Icon={AlertCircle} accent="#f59e0b" />
            </div>

            {/* Revenue Snapshot */}
            <SectionLabel text="Revenue Snapshot" />
            <div className="rounded-2xl overflow-hidden border-2 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              style={{ background: `linear-gradient(135deg, ${SLATE}F5, ${SLATE}E8)`, borderColor: G }}>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.25em] mb-1" style={{ color: G }}>Total Cost Exposure</p>
                <p className="text-4xl font-black text-white">{fmt((d.totalBills ?? 0) + (d.totalExpenses ?? 0))}</p>
                <p className="text-xs mt-1" style={{ color: `${G}BB` }}>Vendor bills + other expenses combined</p>
              </div>
              <div className="flex flex-col gap-2 text-sm shrink-0">
                <div className="flex items-center gap-2 text-white/70">
                  <span className="text-purple-400">▼</span>
                  <span>Vendor Bills: <strong className="text-white">{fmt(d.totalBills ?? 0)}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-white/70">
                  <span className="text-red-400">▼</span>
                  <span>Other Expenses: <strong className="text-white">{fmt(d.totalExpenses ?? 0)}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-white/70">
                  <span style={{ color: G }}>✓</span>
                  <span>Total Paid: <strong className="text-white">{fmt(d.totalPaid ?? 0)}</strong></span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
