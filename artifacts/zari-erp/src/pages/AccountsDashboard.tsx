import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package,
  Receipt, Truck, AlertCircle, Users, Building2,
} from "lucide-react";
import TopNavbar from "../components/layout/TopNavbar";

/* ── styles ──────────────────────────────────────────── */
const G    = "#C6AF4B";
const CARD = "rounded-2xl bg-white border border-[#C6AF4B]/15 shadow-[0_2px_16px_rgba(198,175,75,0.12),0_1px_3px_rgba(0,0,0,0.06)]";
const INP  = "border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30";
const LBL  = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1";

/* ── token ───────────────────────────────────────────── */
const token = () => localStorage.getItem("zarierp_token") || "";

/* ── currency formatter ──────────────────────────────── */
const fmt = (n: number, decimals = 0) =>
  new Intl.NumberFormat("en-IN", {
    style:    "currency",
    currency: "INR",
    maximumFractionDigits: decimals,
  }).format(n);

const pct = (a: number, b: number) =>
  b === 0 ? "—" : `${((a / b) * 100).toFixed(1)}%`;

/* ── mini stat card ──────────────────────────────────── */
interface StatCardProps {
  label:    string;
  value:    string;
  sub?:     string;
  icon:     React.ReactNode;
  accent?:  string;
  highlight?: boolean;
}
function StatCard({ label, value, sub, icon, accent = G, highlight = false }: StatCardProps) {
  return (
    <div
      className={`${CARD} p-4 flex flex-col gap-3 ${
        highlight ? "bg-gradient-to-br from-[#C6AF4B]/10 to-[#C6AF4B]/5 border-[#C6AF4B]/40" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide leading-tight">{label}</p>
        <div className="rounded-xl p-2" style={{ background: `${accent}18` }}>
          <div style={{ color: accent }}>{icon}</div>
        </div>
      </div>
      <div>
        <p className={`text-2xl font-bold ${highlight ? "text-[#C6AF4B]" : "text-gray-900"}`}>{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

/* ── section header ──────────────────────────────────── */
function SectionHead({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="h-4 w-1 rounded-full" style={{ background: G }} />
      <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">{title}</h2>
    </div>
  );
}

/* ── custom tooltip ──────────────────────────────────── */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="text-xs font-medium">
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────
   MAIN COMPONENT
────────────────────────────────────────────────────── */
export default function AccountsDashboard() {
  const [fromDate,  setFromDate]  = useState("");
  const [toDate,    setToDate]    = useState("");
  const [vendorId,  setVendorId]  = useState("");
  const [clientId,  setClientId]  = useState("");
  const [vendors,   setVendors]   = useState<{ vendorId: number; brandName: string }[]>([]);
  const [clients,   setClients]   = useState<{ id: number; brand_name: string }[]>([]);
  const [data,      setData]      = useState<any>(null);
  const [loading,   setLoading]   = useState(true);
  const [trendMode, setTrendMode] = useState<"monthly" | "weekly">("monthly");

  /* load vendors + clients once */
  useEffect(() => {
    fetch("/api/vendors/all", { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then(d => setVendors(Array.isArray(d) ? d : []))
      .catch(() => {});

    fetch("/api/clients", { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then(d => setClients(Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (fromDate)  params.set("from_date", fromDate);
    if (toDate)    params.set("to_date",   toDate);
    if (vendorId)  params.set("vendor_id", vendorId);
    if (clientId)  params.set("client_id", clientId);

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

  /* ── derived values ─────────────────────────────────── */
  const sales      = data?.sales      ?? {};
  const purchases  = data?.purchases  ?? {};
  const proc       = data?.procurement ?? {};
  const expenses   = data?.expenses   ?? {};
  const shipping   = data?.shipping   ?? {};
  const netRevenue = data?.netRevenue ?? 0;
  const trendRaw   = data?.trend      ?? [];
  const topClients = data?.topClients ?? [];
  const topVendors = data?.topVendors ?? [];

  /* build trend label */
  const trend = trendRaw.map((t: any) => ({
    ...t,
    label: trendMode === "monthly"
      ? t.month
      : t.month, /* weekly aggregation comes from backend as monthly; label as-is */
  }));

  /* ─────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavbar />

      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">

        {/* ── PAGE HEADER ─────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Accounts Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {loading ? "Refreshing…" : "Accounts dashboard loaded successfully"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchDashboard}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-[#C6AF4B]/40 text-[#C6AF4B] hover:bg-[#C6AF4B]/10 transition"
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* ── FILTER ROW ──────────────────────────────── */}
        <div className={`${CARD} p-4`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className={LBL}>From Date</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className={`${INP} w-full`} />
            </div>
            <div>
              <label className={LBL}>To Date</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className={`${INP} w-full`} />
            </div>
            <div>
              <label className={LBL}>Vendor</label>
              <select value={vendorId} onChange={e => setVendorId(e.target.value)} className={`${INP} w-full`}>
                <option value="">All Vendors</option>
                {vendors.map(v => (
                  <option key={v.vendorId} value={v.vendorId}>{v.brandName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LBL}>Client</label>
              <select value={clientId} onChange={e => setClientId(e.target.value)} className={`${INP} w-full`}>
                <option value="">All Clients</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.brand_name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#C6AF4B] border-t-transparent" />
          </div>
        )}

        {!loading && data && (
          <>
            {/* ── SALES SUMMARY ───────────────────────── */}
            <SectionHead title="Sales Summary" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                label="Total Invoiced"
                value={fmt(sales.totalInvoiced)}
                sub={`${sales.invoiceCount} invoices`}
                icon={<Receipt className="h-4 w-4" />}
              />
              <StatCard
                label="Total Received"
                value={fmt(sales.totalReceived)}
                sub={pct(sales.totalReceived, sales.totalInvoiced) + " collected"}
                icon={<TrendingUp className="h-4 w-4" />}
                accent="#10B981"
              />
              <StatCard
                label="Pending Receivables"
                value={fmt(sales.pendingReceivables)}
                sub={pct(sales.pendingReceivables, sales.totalInvoiced) + " outstanding"}
                icon={<AlertCircle className="h-4 w-4" />}
                accent="#F59E0B"
              />
            </div>

            {/* ── PURCHASE SUMMARY ─────────────────────── */}
            <SectionHead title="Purchase Summary" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                label="Total Vendor Bills"
                value={fmt(purchases.totalBills)}
                sub={`${purchases.billCount} bills`}
                icon={<ShoppingCart className="h-4 w-4" />}
              />
              <StatCard
                label="Total Paid to Vendors"
                value={fmt(purchases.totalPaidVendors)}
                sub={pct(purchases.totalPaidVendors, purchases.totalBills) + " paid"}
                icon={<DollarSign className="h-4 w-4" />}
                accent="#10B981"
              />
              <StatCard
                label="Pending Vendor Payables"
                value={fmt(purchases.pendingPayables)}
                sub={pct(purchases.pendingPayables, purchases.totalBills) + " outstanding"}
                icon={<AlertCircle className="h-4 w-4" />}
                accent="#EF4444"
              />
            </div>

            {/* ── PROCUREMENT PIPELINE ─────────────────── */}
            <SectionHead title="Procurement Pipeline" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <StatCard
                label="Total Purchase Orders"
                value={proc.poCount?.toLocaleString() ?? "0"}
                sub={`${proc.approvedPos} approved · ${proc.closedPos} closed`}
                icon={<Package className="h-4 w-4" />}
              />
              <StatCard
                label="Total Purchase Receipts"
                value={proc.prCount?.toLocaleString() ?? "0"}
                sub="goods received notes"
                icon={<Receipt className="h-4 w-4" />}
              />
            </div>

            {/* ── EXPENSES & SHIPPING ───────────────────── */}
            <SectionHead title="Other Expenses & Shipping" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <StatCard
                label="Total Other Expenses"
                value={fmt(expenses.totalExpenses)}
                sub={`Paid: ${fmt(expenses.paidExpenses)} · Unpaid: ${fmt(expenses.unpaidExpenses)}`}
                icon={<Building2 className="h-4 w-4" />}
                accent="#8B5CF6"
              />
              <div className={`${CARD} p-4 flex flex-col gap-3`}>
                <div className="flex items-start justify-between">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Shipping</p>
                  <div className="rounded-xl p-2" style={{ background: "#0EA5E918" }}>
                    <Truck className="h-4 w-4 text-[#0EA5E9]" />
                  </div>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{fmt(shipping.totalShippingCost)}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {shipping.shipmentCount} total · {shipping.deliveredCount} delivered
                  </p>
                </div>
              </div>
            </div>

            {/* ── NET REVENUE ──────────────────────────── */}
            <SectionHead title="Net Revenue" />
            <div className="grid grid-cols-1 gap-4">
              <div className={`${CARD} p-5 flex items-center justify-between bg-gradient-to-br from-[#C6AF4B]/10 to-[#C6AF4B]/5 border-[#C6AF4B]/40`}>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Net Revenue (Received − Vendor Paid − Expenses − Outsource)
                  </p>
                  <p className={`text-4xl font-bold ${netRevenue >= 0 ? "text-[#C6AF4B]" : "text-red-500"}`}>
                    {fmt(netRevenue)}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Sales received: {fmt(sales.totalReceived)} &nbsp;·&nbsp;
                    Vendor paid: {fmt(purchases.totalPaidVendors)} &nbsp;·&nbsp;
                    Expenses: {fmt(expenses.totalExpenses)} &nbsp;·&nbsp;
                    Outsource: {fmt(data.costingPaid ?? 0)}
                  </p>
                </div>
                <div className="rounded-2xl p-4" style={{ background: `${G}20` }}>
                  {netRevenue >= 0
                    ? <TrendingUp className="h-8 w-8 text-[#C6AF4B]" />
                    : <TrendingDown className="h-8 w-8 text-red-500" />}
                </div>
              </div>
            </div>

            {/* ── TREND CHART ───────────────────────────── */}
            <SectionHead title="Sales vs Purchases Trend" />
            <div className={`${CARD} p-5`}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-gray-700">Monthly comparison</p>
                <div className="flex gap-1">
                  {(["monthly", "weekly"] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setTrendMode(m)}
                      className={`px-3 py-1 text-xs rounded-lg font-medium transition ${
                        trendMode === m
                          ? "text-white"
                          : "text-gray-500 hover:bg-gray-100"
                      }`}
                      style={trendMode === m ? { background: G } : {}}
                    >
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              {trend.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                  No data for selected period
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={trend} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={v =>
                        v >= 1_00_000
                          ? `₹${(v / 1_00_000).toFixed(1)}L`
                          : `₹${(v / 1000).toFixed(0)}K`
                      }
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend />
                    <Bar dataKey="sales"     name="Sales"     fill={G}         radius={[4, 4, 0, 0]} />
                    <Bar dataKey="purchases" name="Purchases" fill="#94A3B8"    radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* ── OUTSTANDING SNAPSHOT ─────────────────── */}
            <SectionHead title="Outstanding Snapshot" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-8">

              {/* Top 5 Clients */}
              <div className={`${CARD} p-4`}>
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-4 w-4 text-[#C6AF4B]" />
                  <h3 className="text-sm font-bold text-gray-700">Top 5 Clients — Pending</h3>
                </div>
                {topClients.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">No pending receivables</p>
                ) : (
                  <div className="space-y-2">
                    {topClients.map((c: any, i: number) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{c.clientName}</p>
                          <p className="text-xs text-gray-400">{c.invoiceCount} invoice{c.invoiceCount !== 1 ? "s" : ""}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-amber-600">{fmt(c.pendingAmount)}</p>
                          <p className="text-xs text-gray-400">{pct(c.pendingAmount, c.totalInvoiced)} of {fmt(c.totalInvoiced)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Top 5 Vendors */}
              <div className={`${CARD} p-4`}>
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="h-4 w-4 text-[#C6AF4B]" />
                  <h3 className="text-sm font-bold text-gray-700">Top 5 Vendors — Pending</h3>
                </div>
                {topVendors.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">No pending payables</p>
                ) : (
                  <div className="space-y-2">
                    {topVendors.map((v: any, i: number) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{v.vendorName}</p>
                          <p className="text-xs text-gray-400">{v.billCount} bill{v.billCount !== 1 ? "s" : ""}</p>
                        </div>
                        <p className="text-sm font-bold text-red-500">{fmt(v.pendingAmount)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </>
        )}
      </div>
    </div>
  );
}
