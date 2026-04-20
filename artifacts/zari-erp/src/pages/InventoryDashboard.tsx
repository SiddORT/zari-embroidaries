import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Package, AlertTriangle, XCircle, CheckCircle2, TrendingDown,
  ShoppingCart, RefreshCw, Boxes, ClipboardList, PackageCheck,
  TrendingUp, BookOpen, Flame,
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
    total_items: string;
    out_of_stock: string;
    low_stock: string;
    in_stock: string;
    total_stock_value: string;
  };
  reservations: {
    total_swatch_reserved: string;
    total_style_reserved: string;
    total_available: string;
  };
  procurement: {
    active_pos: string;
    active_po_items: string;
    pending_qty: string;
    total_receipts: string;
  };
  totalConsumed: number;
  topConsumed: Array<{ item_name: string; unit_type: string; department: string; total_consumed: string }>;
  stockTrend:  Array<{ period: string; added: string; consumed: string; wasted: string }>;
}

interface LowStockItem {
  id: number;
  item_name: string;
  item_code: string | null;
  current_stock: string;
  reorder_level: string;
  unit_type: string | null;
  source_type: string;
  average_price: string | null;
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

  const today = new Date().toISOString().slice(0, 10);
  const threeMonthsAgo = new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().slice(0, 10);

  const [dateFrom,   setDateFrom]   = useState(threeMonthsAgo);
  const [dateTo,     setDateTo]     = useState(today);
  const [category,   setCategory]   = useState("all");
  const [data,       setData]       = useState<DashboardData | null>(null);
  const [lowStock,   setLowStock]   = useState<LowStockItem[]>([]);
  const [loading,    setLoading]    = useState(true);
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

  const summaryCards = [
    { label: "Total Items",        value: s ? fmt(s.total_items)        : "…", icon: Boxes,        color: G,         bg: `${G}18`                  },
    { label: "In Stock",           value: s ? fmt(s.in_stock)           : "…", icon: CheckCircle2, color: "#22C55E", bg: "rgba(34,197,94,0.1)"     },
    { label: "Low Stock",          value: s ? fmt(s.low_stock)          : "…", icon: AlertTriangle,color: "#F59E0B", bg: "rgba(245,158,11,0.1)"    },
    { label: "Out of Stock",       value: s ? fmt(s.out_of_stock)       : "…", icon: XCircle,      color: "#EF4444", bg: "rgba(239,68,68,0.1)"     },
    { label: "Total Stock Value",  value: s ? fmtC(s.total_stock_value) : "…", icon: TrendingUp,   color: SLATE,     bg: "rgba(59,63,92,0.08)"     },
  ];

  const reservationCards = [
    { label: "Reserved for Swatch", value: r ? fmt(r.total_swatch_reserved) : "…", icon: BookOpen,    color: "#8B5CF6", bg: "rgba(139,92,246,0.1)" },
    { label: "Reserved for Style",  value: r ? fmt(r.total_style_reserved)  : "…", icon: ClipboardList,color: "#3B82F6", bg: "rgba(59,130,246,0.1)" },
    { label: "Available Stock",     value: r ? fmt(r.total_available)        : "…", icon: Package,     color: "#22C55E", bg: "rgba(34,197,94,0.1)"  },
  ];

  const procurementCards = [
    { label: "Active POs",          value: p ? fmt(p.active_pos)       : "…", icon: ShoppingCart, color: G,         bg: `${G}18`                  },
    { label: "Line Items in POs",   value: p ? fmt(p.active_po_items)  : "…", icon: Boxes,        color: SLATE,     bg: "rgba(59,63,92,0.08)"     },
    { label: "Pending Qty",         value: p ? fmt(p.pending_qty)      : "…", icon: TrendingDown, color: "#F59E0B", bg: "rgba(245,158,11,0.1)"    },
    { label: "Purchase Receipts",   value: p ? fmt(p.total_receipts)   : "…", icon: PackageCheck, color: "#22C55E", bg: "rgba(34,197,94,0.1)"     },
  ];

  const trendData = (data?.stockTrend ?? []).map(t => ({
    period:   t.period,
    "Added":   parseFloat(t.added),
    "Consumed":parseFloat(t.consumed),
    "Wasted":  parseFloat(t.wasted),
  }));

  const outOfStockAlerts = lowStock.filter(i => parseFloat(i.current_stock ?? "0") <= 0);
  const lowStockAlerts   = lowStock.filter(i => {
    const cur = parseFloat(i.current_stock ?? "0");
    const rl  = parseFloat(i.reorder_level ?? "0");
    return cur > 0 && rl > 0 && cur <= rl;
  });

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <TopNavbar
        username={(user as { name?: string } | undefined)?.name ?? ""}
        role={(user as { role?: string } | undefined)?.role ?? ""}
        onLogout={handleLogout}
        isLoggingOut={logoutMutation.isPending}
      />

      <div className="py-6 px-6 max-w-screen-2xl mx-auto space-y-6">

        {/* Header */}
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

        {/* Filter Row */}
        <div className={`${card} p-4 flex flex-wrap gap-3 items-end`}>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/40 min-w-[140px]">
              <option value="all">All Categories</option>
              <option value="fabric">Fabric</option>
              <option value="material">Material</option>
              <option value="packaging">Packaging</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/40" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/40" />
          </div>
        </div>

        {/* Summary Cards */}
        <div>
          <SectionHeader eyebrow="STOCK STATUS" title="Summary" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {summaryCards.map(({ label, value, icon: Icon, color, bg }) => (
              <StatCard key={label} label={label} value={value} Icon={Icon} color={color} bg={bg} loading={loading} />
            ))}
          </div>
        </div>

        {/* Reservation + Procurement in 2 col */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Reservation Summary */}
          <div>
            <SectionHeader eyebrow="RESERVATIONS" title="Reservation Summary" />
            <div className="grid grid-cols-3 gap-4">
              {reservationCards.map(({ label, value, icon: Icon, color, bg }) => (
                <StatCard key={label} label={label} value={value} Icon={Icon} color={color} bg={bg} loading={loading} />
              ))}
            </div>
          </div>

          {/* Procurement Pipeline */}
          <div>
            <SectionHeader eyebrow="PROCUREMENT" title="Pipeline Snapshot" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {procurementCards.map(({ label, value, icon: Icon, color, bg }) => (
                <StatCard key={label} label={label} value={value} Icon={Icon} color={color} bg={bg} loading={loading} />
              ))}
            </div>
          </div>
        </div>

        {/* Consumption Summary */}
        <div>
          <SectionHeader eyebrow="CONSUMPTION" title={`Total Consumed in Period`} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Total consumed card */}
            <div className={`${card} p-5 flex items-center gap-4`}>
              <div className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(239,68,68,0.1)" }}>
                <Flame className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">{loading ? "…" : fmt(data?.totalConsumed ?? 0)}</p>
                <p className="text-sm text-gray-500 mt-0.5">Total Units Consumed ({dateFrom} → {dateTo})</p>
              </div>
            </div>

            {/* Top Consumed Items */}
            <div className={`${card} p-5`}>
              <p className="text-xs font-black uppercase tracking-[0.15em] mb-3" style={{ color: G }}>Top 5 Most Consumed</p>
              {loading ? (
                <div className="space-y-2">{Array(5).fill(0).map((_, i) => <div key={i} className="h-7 rounded-lg bg-gray-100 animate-pulse" />)}</div>
              ) : (data?.topConsumed ?? []).length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">No consumption data for this period</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                      <th className="pb-2 font-medium">Item</th>
                      <th className="pb-2 font-medium text-right">Consumed</th>
                      <th className="pb-2 font-medium text-right">Dept</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.topConsumed ?? []).map((item, i) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0">
                        <td className="py-1.5 font-medium text-gray-800 truncate max-w-[180px]">{item.item_name}</td>
                        <td className="py-1.5 text-right text-gray-600">{fmt(item.total_consumed)} {item.unit_type ?? ""}</td>
                        <td className="py-1.5 text-right text-gray-400 text-xs">{item.department ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Low Stock Alert Panel */}
        {!loading && (outOfStockAlerts.length > 0 || lowStockAlerts.length > 0) && (
          <div>
            <SectionHeader eyebrow="ALERTS" title="Low Stock Alert Panel" />
            <div className={`${card} overflow-hidden`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/60">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Current Stock</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Reorder Level</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Suggested PO Qty</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...outOfStockAlerts, ...lowStockAlerts].map(item => {
                      const isOut     = parseFloat(item.current_stock ?? "0") <= 0;
                      const rl        = parseFloat(item.reorder_level ?? "0");
                      const cur       = parseFloat(item.current_stock ?? "0");
                      const suggested = Math.max(rl * 2 - cur, rl);
                      return (
                        <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-800">{item.item_name}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 capitalize">
                              {item.source_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(item.current_stock)} {item.unit_type ?? ""}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{fmt(item.reorder_level)}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{fmt(suggested)}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                              isOut ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                            }`}>
                              {isOut ? <><XCircle className="h-3 w-3" /> Out of Stock</> : <><AlertTriangle className="h-3 w-3" /> Low Stock</>}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => navigate(`/procurement/purchase-orders/new?itemId=${item.id}&itemName=${encodeURIComponent(item.item_name)}&itemCategory=${item.source_type}&targetPrice=${encodeURIComponent(item.average_price ?? "")}`)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all"
                              style={{ background: `linear-gradient(135deg, ${G}, ${G_DIM})` }}>
                              <ShoppingCart className="h-3.5 w-3.5" /> Create PO
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Stock Movement Trend Chart */}
        <div>
          <SectionHeader eyebrow="TREND" title="Stock Movement Trend (Weekly)" />
          <div className={`${card} p-5`}>
            {loading ? (
              <div className="h-56 rounded-xl bg-gray-100 animate-pulse" />
            ) : trendData.length === 0 ? (
              <div className="flex items-center justify-center h-56 text-gray-400 text-sm">
                No stock movement data for selected period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={trendData} barCategoryGap="30%" barGap={3}>
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#9CA3AF", fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#D1D5DB" }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                  <ReTooltip
                    contentStyle={{ borderRadius: "12px", border: "1px solid #E5E7EB", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: 12 }}
                    cursor={{ fill: `${G}08`, radius: 6 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                  <Bar dataKey="Added"    fill={G}          radius={[5,5,0,0]} animationBegin={200} animationDuration={700} />
                  <Bar dataKey="Consumed" fill={SLATE}      radius={[5,5,0,0]} animationBegin={300} animationDuration={700} />
                  <Bar dataKey="Wasted"   fill="#F87171"    radius={[5,5,0,0]} animationBegin={400} animationDuration={700} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Moving Items Panel */}
        {!loading && (data?.topConsumed ?? []).length > 0 && (
          <div>
            <SectionHeader eyebrow="TOP MOVERS" title="Top 5 Most Consumed Items" />
            <div className={`${card} overflow-hidden`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/60">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item Name</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Consumed Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Department</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.topConsumed ?? []).map((item, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors last:border-0">
                        <td className="px-4 py-3 font-medium text-gray-800">
                          <div className="flex items-center gap-2">
                            <span className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                              style={{ background: i === 0 ? G : i === 1 ? G_DIM : "#9CA3AF" }}>
                              {i + 1}
                            </span>
                            {item.item_name}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(item.total_consumed)} <span className="text-xs font-normal text-gray-400">{item.unit_type ?? ""}</span></td>
                        <td className="px-4 py-3 text-gray-500">{item.department ?? <span className="text-gray-300">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
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
