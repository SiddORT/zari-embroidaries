import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import {
  Package, AlertTriangle, XCircle, CheckCircle2, TrendingDown,
  ShoppingCart, RefreshCw, Boxes, ClipboardList, PackageCheck,
  TrendingUp, BookOpen, ArrowRight, Flame,
} from "lucide-react";
import { useGetMe, getGetMeQueryKey, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import TopNavbar from "@/components/layout/TopNavbar";
import { useToast } from "@/hooks/use-toast";

const G     = "#C6AF4B";
const G_DIM = "#A8943E";
const SLATE = "#3B3F5C";

const card = [
  "rounded-2xl bg-white",
  "border border-[#C6AF4B]/15",
  "shadow-[0_2px_16px_rgba(198,175,75,0.12),0_1px_3px_rgba(0,0,0,0.06)]",
].join(" ");

const fmt  = (n: number | string) => parseFloat(String(n ?? 0)).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const fmtC = (n: number | string) => "₹" + parseFloat(String(n ?? 0)).toLocaleString("en-IN", { maximumFractionDigits: 0 });

interface DashboardData {
  summary: {
    total_items:     string;
    out_of_stock:    string;
    low_stock:       string;
    in_stock:        string;
    total_stock_value: string;
    fabric_count:    string;
    material_count:  string;
    packaging_count: string;
  };
  reservations: {
    total_swatch_reserved: string;
    total_style_reserved:  string;
    total_available:       string;
  };
  procurement: {
    active_pos:      string;
    active_po_items: string;
    pending_qty:     string;
    total_receipts:  string;
  };
  totalConsumed: number;
  topConsumed: Array<{ item_name: string; unit_type: string; department: string; total_consumed: string }>;
  stockTrend:  Array<{ period: string; added: string; consumed: string; wasted: string }>;
}

interface LowStockItem {
  id:            number;
  item_name:     string;
  item_code:     string | null;
  current_stock: string;
  reorder_level: string;
  unit_type:     string | null;
  source_type:   string;
  average_price: string | null;
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="rounded-xl px-3 py-2 text-xs bg-white"
      style={{ border: `1px solid ${G}40`, boxShadow: `0 4px 20px rgba(198,175,75,0.18)` }}>
      <span className="font-bold" style={{ color: d.payload.color }}>{d.name}: </span>
      <span className="font-black text-gray-800">{d.value}</span>
    </div>
  );
}

function InventoryDonut({ title, subtitle, data, loading }: {
  title: string; subtitle: string;
  data: { name: string; value: number; color: string }[];
  loading: boolean;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className={`${card} p-5`}>
      <p className="text-[9px] font-black uppercase tracking-[0.18em] mb-0.5" style={{ color: G }}>{title}</p>
      <p className="text-sm font-bold text-gray-800 mb-4">{subtitle}</p>

      {loading ? (
        <div className="flex flex-col items-center gap-3">
          <div className="h-[120px] w-[120px] rounded-full bg-gray-100 animate-pulse" />
          <div className="w-full space-y-2">
            {Array(3).fill(0).map((_, i) => <div key={i} className="h-4 rounded bg-gray-100 animate-pulse" />)}
          </div>
        </div>
      ) : total === 0 ? (
        <div className="flex items-center justify-center h-32 text-gray-400 text-sm">No data</div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="flex justify-center">
            <div className="relative">
              <PieChart width={120} height={120}>
                <Pie data={data} cx={55} cy={55} innerRadius={36} outerRadius={54}
                  dataKey="value" strokeWidth={2} stroke="#ffffff"
                  animationBegin={200} animationDuration={800}>
                  {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <ReTooltip content={<PieTooltip />} />
              </PieChart>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-black text-gray-900">{total}</span>
                <span className="text-[8px] uppercase tracking-widest font-bold" style={{ color: G }}>Total</span>
              </div>
            </div>
          </div>
          <div className="w-full space-y-2">
            {data.map((seg) => (
              <div key={seg.name} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: seg.color }} />
                <span className="text-[11px] text-gray-600 flex-1 truncate">{seg.name}</span>
                <div className="w-12 h-1.5 rounded-full overflow-hidden bg-gray-100">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${total > 0 ? (seg.value / total) * 100 : 0}%`, background: seg.color }} />
                </div>
                <span className="text-[11px] font-bold text-gray-800 w-5 text-right">{seg.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function InventoryDashboard() {
  const [, navigate]  = useLocation();
  const { toast }     = useToast();
  const queryClient   = useQueryClient();
  const token         = localStorage.getItem("zarierp_token");

  const { data: user, isLoading: userLoading, isError } = useGetMe({
    query: { enabled: !!token, queryKey: getGetMeQueryKey(), retry: false },
  });
  const logoutMutation = useLogout();

  const today          = new Date().toISOString().slice(0, 10);
  const threeMonthsAgo = new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().slice(0, 10);

  const [dateFrom,    setDateFrom]    = useState(threeMonthsAgo);
  const [dateTo,      setDateTo]      = useState(today);
  const [category,    setCategory]    = useState("all");
  const [data,        setData]        = useState<DashboardData | null>(null);
  const [lowStock,    setLowStock]    = useState<LowStockItem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  useEffect(() => { if (isError) navigate("/login"); }, [isError, navigate]);

  const fetchDashboard = useCallback(() => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams({ dateFrom, dateTo, category });
    Promise.all([
      customFetch<DashboardData>(`/api/inventory/dashboard?${params}`),
      customFetch<{ data: LowStockItem[] }>("/api/inventory/low-stock-alerts"),
    ])
      .then(([d, ls]) => {
        setData(d);
        setLowStock(ls.data ?? []);
        setLastFetched(new Date());
      })
      .catch(() => toast({ title: "Failed to load dashboard", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [token, dateFrom, dateTo, category, toast]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => { localStorage.removeItem("zarierp_token"); queryClient.clear(); navigate("/login"); },
      onError:   () => { localStorage.removeItem("zarierp_token"); queryClient.clear(); navigate("/login"); },
    });
  };

  if (userLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fb]">
        <div className="h-8 w-8 rounded-full border-2 animate-spin" style={{ borderColor: G, borderTopColor: "transparent" }} />
      </div>
    );
  }

  const s = data?.summary;
  const r = data?.reservations;
  const p = data?.procurement;

  const outOfStockCount = parseInt(String(s?.out_of_stock ?? "0"), 10);
  const lowStockCount   = parseInt(String(s?.low_stock    ?? "0"), 10);

  const summaryCards = [
    { label: "Total Items",       value: s ? fmt(s.total_items)        : "…", icon: Boxes,        color: G,         bg: `${G}18`               },
    { label: "In Stock",          value: s ? fmt(s.in_stock)           : "…", icon: CheckCircle2, color: "#22C55E", bg: "rgba(34,197,94,0.1)"  },
    { label: "Low Stock",         value: s ? fmt(s.low_stock)          : "…", icon: AlertTriangle,color: "#F59E0B", bg: "rgba(245,158,11,0.1)" },
    { label: "Out of Stock",      value: s ? fmt(s.out_of_stock)       : "…", icon: XCircle,      color: "#EF4444", bg: "rgba(239,68,68,0.1)"  },
    { label: "Total Stock Value", value: s ? fmtC(s.total_stock_value) : "…", icon: TrendingUp,   color: SLATE,     bg: "rgba(59,63,92,0.08)"  },
  ];

  const procurementCards = [
    { label: "Active POs",        value: p ? fmt(p.active_pos)      : "…", icon: ShoppingCart, color: G,         bg: `${G}18`               },
    { label: "Line Items in POs", value: p ? fmt(p.active_po_items) : "…", icon: Boxes,        color: SLATE,     bg: "rgba(59,63,92,0.08)"  },
    { label: "Pending Qty",       value: p ? fmt(p.pending_qty)     : "…", icon: TrendingDown, color: "#F59E0B", bg: "rgba(245,158,11,0.1)" },
    { label: "Receipts",          value: p ? fmt(p.total_receipts)  : "…", icon: PackageCheck, color: "#22C55E", bg: "rgba(34,197,94,0.1)"  },
  ];

  const trendData = (data?.stockTrend ?? []).map(t => ({
    period:    t.period,
    "Added":   parseFloat(t.added),
    "Consumed":parseFloat(t.consumed),
    "Wasted":  parseFloat(t.wasted),
  }));

  const statusDonut = [
    { name: "In Stock",     value: parseInt(String(s?.in_stock    ?? "0"), 10), color: "#22C55E" },
    { name: "Low Stock",    value: parseInt(String(s?.low_stock   ?? "0"), 10), color: "#F59E0B" },
    { name: "Out of Stock", value: parseInt(String(s?.out_of_stock ?? "0"), 10), color: "#EF4444" },
  ].filter(d => d.value > 0);

  const categoryDonut = [
    { name: "Fabric",    value: parseInt(String(s?.fabric_count    ?? "0"), 10), color: G           },
    { name: "Material",  value: parseInt(String(s?.material_count  ?? "0"), 10), color: SLATE        },
    { name: "Packaging", value: parseInt(String(s?.packaging_count ?? "0"), 10), color: "#8B5CF6"   },
  ].filter(d => d.value > 0);

  const swatchReserved = parseFloat(String(r?.total_swatch_reserved ?? "0"));
  const styleReserved  = parseFloat(String(r?.total_style_reserved  ?? "0"));
  const availableStock = parseFloat(String(r?.total_available       ?? "0"));
  const totalBase      = swatchReserved + styleReserved + availableStock;
  const swatchPct      = totalBase > 0 ? (swatchReserved / totalBase) * 100 : 0;
  const stylePct       = totalBase > 0 ? (styleReserved  / totalBase) * 100 : 0;
  const availPct       = totalBase > 0 ? (availableStock / totalBase) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <TopNavbar
        username={(user as { name?: string } | undefined)?.name ?? ""}
        role={(user as { role?: string } | undefined)?.role ?? ""}
        onLogout={handleLogout}
        isLoggingOut={logoutMutation.isPending}
      />

      <div className="py-6 px-6 max-w-screen-2xl mx-auto space-y-6">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="h-px w-6 rounded-full" style={{ background: `linear-gradient(90deg, ${G}, transparent)` }} />
              <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: G }}>INVENTORY · DASHBOARD</p>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Inventory Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">Live stock status, reservations, procurement &amp; consumption</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {lastFetched && (
              <span className="text-xs text-gray-400">Updated {lastFetched.toLocaleTimeString("en-IN")}</span>
            )}
            <button onClick={fetchDashboard} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
              style={{ background: `linear-gradient(135deg, ${G}, ${G_DIM})` }}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>

        {/* ── Filter Row ─────────────────────────────────────── */}
        <div className={`${card} p-4 flex flex-wrap gap-4 items-end`}>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/40 min-w-[140px]">
              <option value="all">All Categories</option>
              <option value="fabric">Fabric</option>
              <option value="material">Material</option>
              <option value="packaging">Packaging</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/40" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/40" />
          </div>
        </div>

        {/* ── Summary Cards ──────────────────────────────────── */}
        <div>
          <SectionHeader eyebrow="STOCK STATUS" title="Summary" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {summaryCards.map(({ label, value, icon: Icon, color, bg }) => (
              <StatCard key={label} label={label} value={value} Icon={Icon} color={color} bg={bg} loading={loading} />
            ))}
          </div>
        </div>

        {/* ── Procurement Pipeline ────────────────────────────── */}
        <div>
          <SectionHeader eyebrow="PROCUREMENT" title="Pipeline Snapshot" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {procurementCards.map(({ label, value, icon: Icon, color, bg }) => (
              <StatCard key={label} label={label} value={value} Icon={Icon} color={color} bg={bg} loading={loading} />
            ))}
          </div>
        </div>

        {/* ── Doughnut Charts + Reservation Card ─────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <InventoryDonut
            title="STOCK STATUS SPLIT"
            subtitle="In Stock vs Low vs Out"
            data={statusDonut}
            loading={loading}
          />
          <InventoryDonut
            title="CATEGORY SPLIT"
            subtitle="Fabric · Material · Packaging"
            data={categoryDonut}
            loading={loading}
          />

          {/* Reservation Card */}
          <div className={`${card} p-5 flex flex-col`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: G }}>RESERVATIONS</p>
                <p className="text-sm font-bold text-gray-800 mt-0.5">Stock Reserved</p>
              </div>
              <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${G}18` }}>
                <BookOpen className="h-4 w-4" style={{ color: G }} />
              </div>
            </div>

            {loading ? (
              <div className="space-y-3 flex-1">
                {Array(3).fill(0).map((_, i) => <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />)}
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 flex-1">
                <ReservationRow label="Swatch Reserved" value={fmt(swatchReserved)} pct={swatchPct} barColor="#8B5CF6" bgColor="rgba(139,92,246,0.07)" borderColor="rgba(139,92,246,0.18)" textColor="#7C3AED" />
                <ReservationRow label="Style Reserved"  value={fmt(styleReserved)}  pct={stylePct}  barColor="#3B82F6" bgColor="rgba(59,130,246,0.07)"  borderColor="rgba(59,130,246,0.18)"  textColor="#2563EB" />
                <ReservationRow label="Available"       value={fmt(availableStock)}  pct={availPct}  barColor="#22C55E" bgColor="rgba(34,197,94,0.07)"   borderColor="rgba(34,197,94,0.18)"   textColor="#16A34A" />
              </div>
            )}
          </div>
        </div>

        {/* ── Quick Actions + Consumption (side by side) ──────── */}
        {(outOfStockCount > 0 || lowStockCount > 0 || !loading) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Quick Actions */}
            <div>
              <SectionHeader eyebrow="QUICK ACTIONS" title="Stock Alerts" />
              <div className="flex flex-col gap-3">
                {outOfStockCount > 0 && (
                  <div className={`${card} p-4 flex items-center justify-between gap-4`}
                    style={{ borderColor: "rgba(239,68,68,0.3)" }}>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-red-50">
                        <XCircle className="h-5 w-5 text-red-500" />
                      </div>
                      <div>
                        <p className="text-xl font-bold text-gray-900">{outOfStockCount} <span className="text-sm font-semibold text-red-500">items out of stock</span></p>
                        <p className="text-xs text-gray-500">Needs immediate attention</p>
                      </div>
                    </div>
                    <button onClick={() => navigate("/inventory/low-stock-alerts")}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white flex-shrink-0 transition-all"
                      style={{ background: "linear-gradient(135deg,#EF4444,#DC2626)" }}>
                      View <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                {lowStockCount > 0 && (
                  <div className={`${card} p-4 flex items-center justify-between gap-4`}
                    style={{ borderColor: "rgba(245,158,11,0.3)" }}>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-amber-50">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-xl font-bold text-gray-900">{lowStockCount} <span className="text-sm font-semibold text-amber-500">items below reorder</span></p>
                        <p className="text-xs text-gray-500">Replenishment advised</p>
                      </div>
                    </div>
                    <button onClick={() => navigate("/procurement/purchase-orders/new")}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white flex-shrink-0 transition-all"
                      style={{ background: `linear-gradient(135deg,${G},${G_DIM})` }}>
                      Create PO <ShoppingCart className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                {outOfStockCount === 0 && lowStockCount === 0 && !loading && (
                  <div className={`${card} p-5 flex items-center gap-3`}>
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-green-50">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800">All stock levels healthy</p>
                      <p className="text-xs text-gray-400 mt-0.5">No items below reorder level</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Consumption — total number */}
            <div>
              <SectionHeader eyebrow="CONSUMPTION" title="Period Summary" />
              <div className={`${card} p-4 flex items-center gap-4 h-[calc(100%-2rem)]`}>
                <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-red-50">
                  <Flame className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{loading ? "…" : fmt(data?.totalConsumed ?? 0)}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Total units consumed · {dateFrom} → {dateTo}</p>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ── Trend Chart (left) + Top 5 Consumed (right) ────── */}
        <div>
          <SectionHeader eyebrow="TREND & CONSUMPTION" title="Stock Movement · Top Consumed" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Trend Chart */}
            <div className={`${card} p-5`}>
              <p className="text-[9px] font-black uppercase tracking-[0.15em] mb-4" style={{ color: G }}>WEEKLY STOCK MOVEMENT</p>
              {loading ? (
                <div className="h-52 rounded-xl bg-gray-100 animate-pulse" />
              ) : trendData.length === 0 ? (
                <div className="flex items-center justify-center h-52 text-gray-400 text-sm">
                  No stock movement data for selected period
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={trendData} barCategoryGap="30%" barGap={3}>
                    <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#9CA3AF", fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#D1D5DB" }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <ReTooltip
                      contentStyle={{ borderRadius: "12px", border: "1px solid #E5E7EB", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: 12 }}
                      cursor={{ fill: `${G}08`, radius: 6 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    <Bar dataKey="Added"    fill={G}       radius={[5,5,0,0]} animationBegin={200} animationDuration={700} />
                    <Bar dataKey="Consumed" fill={SLATE}   radius={[5,5,0,0]} animationBegin={300} animationDuration={700} />
                    <Bar dataKey="Wasted"   fill="#F87171" radius={[5,5,0,0]} animationBegin={400} animationDuration={700} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Top 5 Consumed */}
            <div className={`${card} p-5`}>
              <p className="text-[9px] font-black uppercase tracking-[0.15em] mb-4" style={{ color: G }}>TOP 5 CONSUMED ITEMS</p>
              {loading ? (
                <div className="space-y-3">{Array(5).fill(0).map((_, i) => <div key={i} className="h-8 rounded-lg bg-gray-100 animate-pulse" />)}</div>
              ) : (data?.topConsumed ?? []).length === 0 ? (
                <div className="flex items-center justify-center h-52 text-gray-400 text-sm">No consumption data for this period</div>
              ) : (
                <div className="space-y-3.5">
                  {(data?.topConsumed ?? []).map((item, i) => {
                    const max = parseFloat((data?.topConsumed ?? [])[0]?.total_consumed ?? "1");
                    const pct = max > 0 ? (parseFloat(item.total_consumed) / max) * 100 : 0;
                    return (
                      <div key={i} className="flex items-center gap-2.5">
                        <span className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                          style={{ background: i === 0 ? G : i === 1 ? G_DIM : "#9CA3AF" }}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-xs font-medium text-gray-800 truncate">{item.item_name}</span>
                            <span className="text-xs font-semibold text-gray-600 flex-shrink-0">{fmt(item.total_consumed)} <span className="text-gray-400">{item.unit_type ?? ""}</span></span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${pct}%`, background: i === 0 ? G : i === 1 ? G_DIM : "#9CA3AF" }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

function ReservationRow({ label, value, pct, barColor, bgColor, borderColor, textColor }: {
  label: string; value: string; pct: number;
  barColor: string; bgColor: string; borderColor: string; textColor: string;
}) {
  return (
    <div className="rounded-xl p-3" style={{ background: bgColor, border: `1px solid ${borderColor}` }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: textColor }}>{label}</span>
        <span className="text-base font-bold text-gray-900">{value}</span>
      </div>
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: `${barColor}20` }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(pct, 100)}%`, background: barColor }} />
      </div>
      <p className="text-[10px] mt-1" style={{ color: barColor }}>{pct.toFixed(1)}% of total</p>
    </div>
  );
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="h-px w-5 rounded-full" style={{ background: `linear-gradient(90deg, ${G}, transparent)` }} />
      <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: G }}>{eyebrow}</p>
      <div className="h-px flex-1 bg-gray-100" />
      <p className="text-sm font-semibold text-gray-700">{title}</p>
    </div>
  );
}

function StatCard({ label, value, Icon, color, bg, loading }: {
  label: string; value: string; Icon: React.ElementType; color: string; bg: string; loading: boolean;
}) {
  return (
    <div className={`${card} p-4 flex items-start gap-3`}>
      <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-gray-900 truncate">{loading ? "…" : value}</p>
        <p className="text-xs text-gray-500 mt-0.5 leading-tight">{label}</p>
      </div>
    </div>
  );
}
