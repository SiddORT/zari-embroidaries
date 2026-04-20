import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package,
  Receipt, Truck, AlertCircle, Users, Building2, ArrowUpRight,
  ArrowDownRight, ChevronRight, Activity, Wallet, FileText,
} from "lucide-react";
import TopNavbar from "../components/layout/TopNavbar";

/* ── theme ─────────────────────────────────────────────── */
const G       = "#C6AF4B";
const G_LIGHT = "#D4C870";
const G_DIM   = "#A8943E";
const G_GLOW  = "rgba(198,175,75,0.18)";
const SLATE   = "#3B3F5C";

const card = [
  "rounded-2xl overflow-hidden bg-white",
  "border border-[#C6AF4B]/15",
  "shadow-[0_2px_16px_rgba(198,175,75,0.12),0_1px_3px_rgba(0,0,0,0.06)]",
  "hover:shadow-[0_6px_28px_rgba(198,175,75,0.22),0_2px_6px_rgba(0,0,0,0.08)]",
  "hover:-translate-y-0.5 transition-all duration-300",
].join(" ");

const INP = [
  "border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white",
  "focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30",
].join(" ");

const token = () => localStorage.getItem("zarierp_token") || "";

/* ── formatters ─────────────────────────────────────────── */
function fmtCrLk(n: number): string {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (n >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(2)} L`;
  if (n >= 1_000)       return `₹${(n / 1_000).toFixed(1)} K`;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}
function fmtFull(n: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}
function pct(a: number, b: number): string {
  return b === 0 ? "—" : `${((a / b) * 100).toFixed(1)}%`;
}
function yAxis(v: number): string {
  if (v >= 1_00_000) return `₹${(v / 1_00_000).toFixed(1)}L`;
  if (v >= 1_000)    return `₹${(v / 1_000).toFixed(0)}K`;
  return `₹${v}`;
}

/* ── gold-bar top stripe ────────────────────────────────── */
const GoldBar = () => (
  <div className="h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${G}, transparent)` }} />
);

/* ── tooltip ────────────────────────────────────────────── */
function GoldTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-4 py-3 text-xs bg-white"
      style={{ border: `1px solid ${G}40`, boxShadow: `0 4px 20px ${G_GLOW}` }}>
      <p className="font-bold mb-2" style={{ color: G }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-gray-500">
          {p.name}: <span className="font-bold text-gray-800">{fmtFull(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

/* ── KPI card ───────────────────────────────────────────── */
interface KpiProps {
  label:    string;
  value:    string;
  sub:      string;
  change?:  string;
  up?:      boolean;
  Icon:     React.ElementType;
  delay?:   string;
  accent?:  string;
}
function KpiCard({ label, value, sub, change, up = true, Icon, delay = "0ms", accent = G }: KpiProps) {
  return (
    <div className={`${card} fade-up`} style={{ animationDelay: delay }}>
      <GoldBar />
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <p className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: G }}>{label}</p>
          <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${accent}18`, border: `1px solid ${accent}35` }}>
            <Icon className="h-4 w-4" style={{ color: accent === G ? G_DIM : accent }} />
          </div>
        </div>
        <p className="text-[2.2rem] font-black leading-none tracking-tight text-gray-900">{value}</p>
        <p className="text-[11px] mt-1 mb-3 text-gray-400">{sub}</p>
        {change !== undefined && (
          <div className={`flex items-center gap-1 text-[11px] font-bold ${up ? "text-emerald-600" : "text-red-500"}`}>
            {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {change}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── section header ─────────────────────────────────────── */
function Section({ eyebrow, title, delay = "0ms" }: { eyebrow: string; title: string; delay?: string }) {
  return (
    <div className="fade-up mt-1" style={{ animationDelay: delay }}>
      <p className="text-[9px] font-black uppercase tracking-[0.25em] mb-0.5" style={{ color: G }}>{eyebrow}</p>
      <h2 className="text-sm font-bold text-gray-800">{title}</h2>
    </div>
  );
}

/* ── main ───────────────────────────────────────────────── */
export default function AccountsDashboard() {
  const [fromDate,  setFromDate]  = useState("");
  const [toDate,    setToDate]    = useState("");
  const [vendorId,  setVendorId]  = useState("");
  const [clientId,  setClientId]  = useState("");
  const [vendors,   setVendors]   = useState<{ vendorId: number; brandName: string }[]>([]);
  const [clients,   setClients]   = useState<{ id: number; brandName: string }[]>([]);
  const [data,      setData]      = useState<any>(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    fetch("/api/vendors/all", { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json()).then(d => setVendors(Array.isArray(d) ? d : [])).catch(() => {});

    fetch("/api/clients/all", { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json()).then(d => setClients(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (fromDate) params.set("from_date", fromDate);
    if (toDate)   params.set("to_date",   toDate);
    if (vendorId) params.set("vendor_id", vendorId);
    if (clientId) params.set("client_id", clientId);
    try {
      const r = await fetch(`/api/accounts/dashboard?${params}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!r.ok) throw new Error(await r.text());
      setData(await r.json());
    } catch (e) {
      console.error("Dashboard fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, vendorId, clientId]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  /* derived */
  const sales      = data?.sales      ?? {};
  const purchases  = data?.purchases  ?? {};
  const proc       = data?.procurement ?? {};
  const expenses   = data?.expenses   ?? {};
  const shipping   = data?.shipping   ?? {};
  const netRevenue = data?.netRevenue ?? 0;
  const trend      = data?.trend      ?? [];
  const topClients = data?.topClients ?? [];
  const topVendors = data?.topVendors ?? [];

  const pendRecvPct  = pct(sales.pendingReceivables ?? 0, sales.totalInvoiced ?? 0);
  const pendPayPct   = pct(purchases.pendingPayables ?? 0, purchases.totalBills ?? 0);

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <TopNavbar />

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        .fade-up { animation: fadeUp 0.45s ease both; }
        .gold-shimmer {
          background: linear-gradient(90deg, #A8943E, #C6AF4B, #D4C870);
          background-size: 200%;
          animation: shimmer 2.5s linear infinite;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>

      {/* background glows */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full opacity-[0.04]"
          style={{ background: `radial-gradient(circle, ${G} 0%, transparent 65%)` }} />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full opacity-[0.03]"
          style={{ background: `radial-gradient(circle, ${G} 0%, transparent 65%)` }} />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 py-6 space-y-5 pb-12">

        {/* ── PAGE HEADER ──────────────────────────────────────── */}
        <div className="fade-up flex items-end justify-between" style={{ animationDelay: "0ms" }}>
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="h-px w-8 rounded-full" style={{ background: `linear-gradient(90deg, ${G}, transparent)` }} />
              <p className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: G }}>
                ZARI ERP · ACCOUNTS
              </p>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Accounts Dashboard</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {loading ? "Refreshing live data…" : "All figures in INR · Real-time"}
            </p>
          </div>
          <button
            onClick={fetchDashboard}
            className="fade-up flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
            style={{
              color: G_DIM,
              background: `${G}12`,
              border: `1px solid ${G}35`,
              animationDelay: "80ms",
            }}
          >
            <Activity className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        {/* ── FILTER ROW ──────────────────────────────────────── */}
        <div className={`${card} fade-up`} style={{ animationDelay: "60ms" }}>
          <GoldBar />
          <div className="p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] mb-3" style={{ color: G }}>
              FILTERS — apply to entire dashboard
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">From Date</label>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className={`${INP} w-full`} />
              </div>
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">To Date</label>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className={`${INP} w-full`} />
              </div>
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Vendor</label>
                <select value={vendorId} onChange={e => setVendorId(e.target.value)} className={`${INP} w-full`}>
                  <option value="">All Vendors</option>
                  {vendors.map(v => (
                    <option key={v.vendorId} value={v.vendorId}>{v.brandName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Client</label>
                <select value={clientId} onChange={e => setClientId(e.target.value)} className={`${INP} w-full`}>
                  <option value="">All Clients</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.brandName}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ── LOADING ─────────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="h-9 w-9 rounded-full border-2 animate-spin"
                style={{ borderColor: G, borderTopColor: "transparent" }} />
              <p className="text-sm text-gray-400">Loading live data…</p>
            </div>
          </div>
        )}

        {!loading && data && (
          <>
            {/* ── SALES SUMMARY ──────────────────────────────── */}
            <Section eyebrow="SALES SUMMARY" title="Invoice & Collection Overview" delay="100ms" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KpiCard
                label="Total Invoiced"
                value={fmtCrLk(sales.totalInvoiced ?? 0)}
                sub={`${sales.invoiceCount ?? 0} invoices raised`}
                Icon={FileText}
                delay="120ms"
              />
              <KpiCard
                label="Total Received"
                value={fmtCrLk(sales.totalReceived ?? 0)}
                sub={`${pct(sales.totalReceived, sales.totalInvoiced)} of invoiced`}
                change={`${pct(sales.totalReceived, sales.totalInvoiced)} collected`}
                up={true}
                Icon={TrendingUp}
                accent="#10B981"
                delay="200ms"
              />
              <KpiCard
                label="Pending Receivables"
                value={fmtCrLk(sales.pendingReceivables ?? 0)}
                sub={`${pendRecvPct} outstanding`}
                change={`${pendRecvPct} uncollected`}
                up={false}
                Icon={AlertCircle}
                accent="#F59E0B"
                delay="280ms"
              />
            </div>

            {/* ── PURCHASE SUMMARY ────────────────────────────── */}
            <Section eyebrow="PURCHASE SUMMARY" title="Vendor Bills & Payments" delay="300ms" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KpiCard
                label="Total Vendor Bills"
                value={fmtCrLk(purchases.totalBills ?? 0)}
                sub={`${purchases.billCount ?? 0} bills recorded`}
                Icon={ShoppingCart}
                delay="320ms"
              />
              <KpiCard
                label="Paid to Vendors"
                value={fmtCrLk(purchases.totalPaidVendors ?? 0)}
                sub={`${pct(purchases.totalPaidVendors, purchases.totalBills)} of bills paid`}
                change={`${pct(purchases.totalPaidVendors, purchases.totalBills)} settled`}
                up={true}
                Icon={DollarSign}
                accent="#10B981"
                delay="400ms"
              />
              <KpiCard
                label="Pending Payables"
                value={fmtCrLk(purchases.pendingPayables ?? 0)}
                sub={`${pendPayPct} still due`}
                change={`${pendPayPct} pending`}
                up={false}
                Icon={AlertCircle}
                accent="#EF4444"
                delay="480ms"
              />
            </div>

            {/* ── PROCUREMENT + EXPENSES + SHIPPING ──────────── */}
            <Section eyebrow="OPERATIONS SNAPSHOT" title="Procurement, Expenses & Shipping" delay="500ms" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard
                label="Purchase Orders"
                value={String(proc.poCount ?? 0)}
                sub={`${proc.approvedPos ?? 0} approved · ${proc.closedPos ?? 0} closed`}
                Icon={Package}
                delay="520ms"
              />
              <KpiCard
                label="Purchase Receipts"
                value={String(proc.prCount ?? 0)}
                sub="goods received notes"
                Icon={Receipt}
                delay="580ms"
              />
              <KpiCard
                label="Other Expenses"
                value={fmtCrLk(expenses.totalExpenses ?? 0)}
                sub={`Paid ${fmtCrLk(expenses.paidExpenses ?? 0)} · Unpaid ${fmtCrLk(expenses.unpaidExpenses ?? 0)}`}
                Icon={Building2}
                accent="#8B5CF6"
                delay="640ms"
              />
              <KpiCard
                label="Shipping Cost"
                value={fmtCrLk(shipping.totalShippingCost ?? 0)}
                sub={`${shipping.shipmentCount ?? 0} shipments · ${shipping.deliveredCount ?? 0} delivered`}
                Icon={Truck}
                accent="#0EA5E9"
                delay="700ms"
              />
            </div>

            {/* ── NET REVENUE ─────────────────────────────────── */}
            <Section eyebrow="NET REVENUE" title="Overall Financial Position" delay="720ms" />
            <div className="fade-up" style={{ animationDelay: "740ms" }}>
              <div className={`${card}`}>
                <div className="h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${G}, transparent)` }} />
                <div className="p-6 flex items-center justify-between gap-6">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.25em] mb-2" style={{ color: G }}>
                      NET REVENUE = Received − Vendor Paid − Expenses − Outsource
                    </p>
                    <p
                      className="font-black leading-none tracking-tight"
                      style={{
                        fontSize: "3rem",
                        color: netRevenue >= 0 ? G_DIM : "#EF4444",
                      }}
                    >
                      {fmtCrLk(Math.abs(netRevenue))}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      {netRevenue >= 0 ? "▲ Profit" : "▼ Loss"} &nbsp;·&nbsp;
                      Full: {fmtFull(netRevenue)}
                    </p>
                    <div className="flex flex-wrap gap-4 mt-4 text-[11px] text-gray-400">
                      <span>Received <strong className="text-gray-800">{fmtCrLk(sales.totalReceived ?? 0)}</strong></span>
                      <span className="text-gray-300">−</span>
                      <span>Vendor Paid <strong className="text-gray-800">{fmtCrLk(purchases.totalPaidVendors ?? 0)}</strong></span>
                      <span className="text-gray-300">−</span>
                      <span>Expenses <strong className="text-gray-800">{fmtCrLk(expenses.totalExpenses ?? 0)}</strong></span>
                      <span className="text-gray-300">−</span>
                      <span>Outsource <strong className="text-gray-800">{fmtCrLk(data.costingPaid ?? 0)}</strong></span>
                    </div>
                  </div>
                  <div className="shrink-0 h-20 w-20 rounded-2xl flex items-center justify-center"
                    style={{ background: netRevenue >= 0 ? `${G}15` : "#FEE2E2", border: `1px solid ${netRevenue >= 0 ? `${G}30` : "#FCA5A5"}` }}>
                    {netRevenue >= 0
                      ? <TrendingUp  className="h-10 w-10" style={{ color: G_DIM }} />
                      : <TrendingDown className="h-10 w-10 text-red-400" />}
                  </div>
                </div>
              </div>
            </div>

            {/* ── TREND CHART ─────────────────────────────────── */}
            <Section eyebrow="FINANCIAL TREND" title="Sales vs Purchases — Monthly" delay="800ms" />
            <div className={`${card} fade-up p-6`} style={{ animationDelay: "820ms" }}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] mb-1" style={{ color: G }}>
                    SALES VS PURCHASES
                  </p>
                  <h3 className="text-sm font-bold text-gray-800">Monthly comparison</h3>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="h-2 w-2 rounded-full" style={{ background: G }} />
                    <span className="text-gray-500 font-medium">Sales</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="h-2 w-2 rounded-full" style={{ background: SLATE }} />
                    <span className="text-gray-500 font-medium">Purchases</span>
                  </div>
                </div>
              </div>
              {trend.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                  No data for selected period
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={trend} barCategoryGap="28%" barGap={3}>
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9CA3AF", fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#D1D5DB" }} axisLine={false} tickLine={false} tickFormatter={yAxis} />
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <ReTooltip content={<GoldTooltip />} cursor={{ fill: `${G}08`, radius: 6 }} />
                    <Bar dataKey="sales"     name="Sales"     fill={G}     radius={[5,5,0,0]} animationBegin={300} animationDuration={800} />
                    <Bar dataKey="purchases" name="Purchases" fill={SLATE} radius={[5,5,0,0]} animationBegin={400} animationDuration={800} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* ── OUTSTANDING SNAPSHOT ────────────────────────── */}
            <Section eyebrow="OUTSTANDING SNAPSHOT" title="Top Pending Clients & Vendors" delay="900ms" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* Top 5 Clients */}
              <div className={`${card} fade-up`} style={{ animationDelay: "920ms" }}>
                <GoldBar />
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.18em] mb-0.5" style={{ color: G }}>CLIENTS</p>
                      <h3 className="text-sm font-bold text-gray-800">Top 5 Pending Receivables</h3>
                    </div>
                    <div className="h-8 w-8 rounded-xl flex items-center justify-center"
                      style={{ background: `${G}15`, border: `1px solid ${G}30` }}>
                      <Users className="h-4 w-4" style={{ color: G_DIM }} />
                    </div>
                  </div>
                  {topClients.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 text-sm">
                      No pending receivables
                    </div>
                  ) : (
                    <div className="space-y-0">
                      <div className="grid grid-cols-[1fr_auto] pb-1.5 mb-1 border-b border-gray-100">
                        {["Client", "Pending"].map(h => (
                          <span key={h} className="text-[9px] font-black uppercase tracking-widest text-gray-400">{h}</span>
                        ))}
                      </div>
                      {topClients.map((c: any, i: number) => (
                        <div key={i}
                          className="grid grid-cols-[1fr_auto] py-2.5 items-center hover:bg-amber-50/60 rounded-xl px-1 -mx-1 transition-colors"
                          style={{ borderBottom: i < topClients.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                          <div>
                            <p className="text-xs font-bold text-gray-800">{c.clientName}</p>
                            <p className="text-[10px] text-gray-400">{c.invoiceCount} invoice{c.invoiceCount !== 1 ? "s" : ""} · total {fmtCrLk(c.totalInvoiced)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black" style={{ color: "#F59E0B" }}>{fmtCrLk(c.pendingAmount)}</p>
                            <p className="text-[9px] text-gray-400">{pct(c.pendingAmount, c.totalInvoiced)} due</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Top 5 Vendors */}
              <div className={`${card} fade-up`} style={{ animationDelay: "980ms" }}>
                <GoldBar />
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.18em] mb-0.5" style={{ color: G }}>VENDORS</p>
                      <h3 className="text-sm font-bold text-gray-800">Top 5 Pending Payables</h3>
                    </div>
                    <div className="h-8 w-8 rounded-xl flex items-center justify-center"
                      style={{ background: `${G}15`, border: `1px solid ${G}30` }}>
                      <Building2 className="h-4 w-4" style={{ color: G_DIM }} />
                    </div>
                  </div>
                  {topVendors.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 text-sm">
                      No pending payables
                    </div>
                  ) : (
                    <div className="space-y-0">
                      <div className="grid grid-cols-[1fr_auto] pb-1.5 mb-1 border-b border-gray-100">
                        {["Vendor", "Pending"].map(h => (
                          <span key={h} className="text-[9px] font-black uppercase tracking-widest text-gray-400">{h}</span>
                        ))}
                      </div>
                      {topVendors.map((v: any, i: number) => (
                        <div key={i}
                          className="grid grid-cols-[1fr_auto] py-2.5 items-center hover:bg-amber-50/60 rounded-xl px-1 -mx-1 transition-colors"
                          style={{ borderBottom: i < topVendors.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                          <div>
                            <p className="text-xs font-bold text-gray-800">{v.vendorName}</p>
                            <p className="text-[10px] text-gray-400">{v.billCount} bill{v.billCount !== 1 ? "s" : ""}</p>
                          </div>
                          <p className="text-sm font-black text-red-500">{fmtCrLk(v.pendingAmount)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </>
        )}
      </div>
    </div>
  );
}
