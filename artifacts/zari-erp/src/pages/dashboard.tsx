import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts";
import {
  Package, Palette, Users, Clock, ArrowUpRight, ArrowDownRight,
  Layers, ChevronRight, Star, Zap, Activity, TrendingUp,
  FileText, CheckCircle, AlertTriangle, Wallet, Receipt,
  LogIn, UserCheck, ScrollText, ShoppingCart, RefreshCw,
} from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/layout/AppLayout";

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

const STATUS_COLORS: Record<string, string> = {
  Draft:         "#CBD5E1",
  Issued:        G,
  "In Progress": G_LIGHT,
  Completed:     SLATE,
  Cancelled:     "#FCA5A5",
};

const statusPill: Record<string, string> = {
  Draft:         "bg-slate-100 text-slate-500",
  Issued:        "bg-amber-50 text-amber-700",
  "In Progress": "bg-orange-50 text-orange-700",
  Completed:     "bg-emerald-50 text-emerald-700",
  Cancelled:     "bg-red-50 text-red-500",
};

const avatarColors = [G, SLATE, "#8B5CF6", "#EC4899", "#10B981"];

const token = () => localStorage.getItem("zarierp_token") || "";

function GoldTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-4 py-3 text-xs bg-white"
      style={{ border: `1px solid ${G}40`, boxShadow: `0 4px 20px ${G_GLOW}` }}>
      <p className="font-bold mb-2" style={{ color: G }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-gray-500">{p.name}: <span className="font-bold text-gray-800">{p.value}</span></p>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="rounded-xl px-3 py-2 text-xs bg-white"
      style={{ border: `1px solid ${G}40`, boxShadow: `0 4px 20px ${G_GLOW}` }}>
      <span className="font-bold" style={{ color: d.payload.color }}>{d.name}: </span>
      <span className="font-black text-gray-800">{d.value}</span>
    </div>
  );
}

function StatusDonut({ title, subtitle, data }: { title: string; subtitle: string; data: { name: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex-1 min-w-0">
      <p className="text-[8px] font-black uppercase tracking-[0.15em] mb-0.5" style={{ color: G }}>{title}</p>
      <p className="text-xs font-bold text-gray-700 mb-3">{subtitle}</p>
      <div className="flex justify-center mb-3">
        <div className="relative">
          <PieChart width={120} height={120}>
            <Pie data={data} cx={55} cy={55} innerRadius={36} outerRadius={54}
              dataKey="value" strokeWidth={2} stroke="#ffffff" animationBegin={200} animationDuration={800}>
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
      <div className="space-y-1.5">
        {data.map((s) => (
          <div key={s.name} className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-[10px] text-gray-500 flex-1 truncate">{s.name}</span>
            <div className="w-10 h-1 rounded-full overflow-hidden bg-gray-100">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${total > 0 ? (s.value / total) * 100 : 0}%`, background: s.color }} />
            </div>
            <span className="text-[10px] font-bold text-gray-700 w-4 text-right">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── helpers ──────────────────────────────────────────────── */
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-gray-100 animate-pulse rounded-xl ${className}`} />;
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const authToken = localStorage.getItem("zarierp_token");

  const { data: user, isLoading: userLoading, isError } = useGetMe({
    query: { enabled: !!authToken, queryKey: getGetMeQueryKey(), retry: false },
  });

  const logoutMutation = useLogout();

  const [overview, setOverview] = useState<any>(null);
  const [ovLoading, setOvLoading] = useState(true);
  const [ovError, setOvError]   = useState(false);

  useEffect(() => {
    if (!authToken || isError) {
      localStorage.removeItem("zarierp_token");
      setLocation("/login");
    }
  }, [authToken, isError, setLocation]);

  const fetchOverview = () => {
    const t = token();
    if (!t) { setLocation("/login"); return; }
    setOvLoading(true);
    setOvError(false);
    fetch("/api/dashboard/overview", { headers: { Authorization: `Bearer ${t}` } })
      .then(async r => {
        if (r.status === 401) {
          localStorage.removeItem("zarierp_token");
          setLocation("/login");
          return;
        }
        if (!r.ok) { setOvError(true); setOvLoading(false); return; }
        const d = await r.json();
        setOverview(d);
        setOvLoading(false);
      })
      .catch(() => { setOvError(true); setOvLoading(false); });
  };

  useEffect(() => {
    if (!authToken) return;
    fetchOverview();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => { localStorage.removeItem("zarierp_token"); queryClient.clear(); setLocation("/login"); },
      onError:   () => { localStorage.removeItem("zarierp_token"); queryClient.clear(); setLocation("/login"); },
    });
  };

  if (userLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fb]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 animate-spin" style={{ borderColor: G, borderTopColor: "transparent" }} />
          <p className="text-sm text-gray-400">Loading workspace…</p>
        </div>
      </div>
    );
  }

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const ov = overview;

  /* ── KPI cards ──────────────────────────────────────────── */
  const kpi = ov?.kpi;
  const styleUp  = kpi ? (kpi.styleOrders.pctChange  !== null ? parseFloat(kpi.styleOrders.pctChange)  >= 0 : true) : true;
  const swatchUp = kpi ? (kpi.swatchOrders.pctChange !== null ? parseFloat(kpi.swatchOrders.pctChange) >= 0 : true) : true;

  const kpiCards = [
    {
      label: "STYLE ORDERS",
      value: kpi ? String(kpi.styleOrders.active) : "—",
      sub:   ovLoading ? "Fetching data…" : kpi ? `${kpi.styleOrders.thisMonth} issued this month` : "—",
      change: ovLoading ? null : kpi?.styleOrders.pctChange ? `${parseFloat(kpi.styleOrders.pctChange) > 0 ? "+" : ""}${kpi.styleOrders.pctChange}% vs last month` : null,
      up: styleUp, icon: Layers, delay: "0ms", path: "/style-orders",
    },
    {
      label: "SWATCH ORDERS",
      value: kpi ? String(kpi.swatchOrders.active) : "—",
      sub:   ovLoading ? "Fetching data…" : kpi ? `${kpi.swatchOrders.thisMonth} issued this month` : "—",
      change: ovLoading ? null : kpi?.swatchOrders.pctChange ? `${parseFloat(kpi.swatchOrders.pctChange) > 0 ? "+" : ""}${kpi.swatchOrders.pctChange}% vs last month` : null,
      up: swatchUp, icon: Package, delay: "80ms", path: "/swatch-orders",
    },
    {
      label: "ARTWORKS",
      value: kpi ? String(kpi.artworks.total) : "—",
      sub:   ovLoading ? "Fetching data…" : "Across all orders",
      change: null, up: true, icon: Palette, delay: "160ms", path: "/swatch-orders",
    },
    {
      label: "ACTIVE CLIENTS",
      value: kpi ? String(kpi.activeClients.total) : "—",
      sub:   ovLoading ? "Fetching data…" : "In current pipeline",
      change: null, up: true, icon: Users, delay: "240ms", path: "/masters/clients",
    },
  ];

  /* ── status donuts ──────────────────────────────────────── */
  const styleStatusData = (ov?.styleStatuses ?? []).map((r: any) => ({
    name: r.status, value: r.count, color: STATUS_COLORS[r.status] ?? "#CBD5E1",
  }));
  const swatchStatusData = (ov?.swatchStatuses ?? []).map((r: any) => ({
    name: r.status, value: r.count, color: STATUS_COLORS[r.status] ?? "#CBD5E1",
  }));

  /* ── invoice stats ──────────────────────────────────────── */
  const iv = ov?.invoiceStats;
  const invoiceStats = [
    { status: "Generated", Icon: FileText,     count: iv?.generated.count ?? 0, amount: iv?.generated.amount ?? "₹0", color: "#3B82F6", bg: "rgba(59,130,246,0.08)"  },
    { status: "Pending",   Icon: Clock,         count: iv?.pending.count   ?? 0, amount: iv?.pending.amount   ?? "₹0", color: G,         bg: `${G}12`                 },
    { status: "Completed", Icon: CheckCircle,   count: iv?.completed.count ?? 0, amount: iv?.completed.amount ?? "₹0", color: "#10B981", bg: "rgba(16,185,129,0.08)"  },
    { status: "Overdue",   Icon: AlertTriangle, count: iv?.overdue.count   ?? 0, amount: iv?.overdue.amount   ?? "₹0", color: "#EF4444", bg: "rgba(239,68,68,0.08)"   },
  ];

  /* ── artwork pipeline ───────────────────────────────────── */
  const artworkRows = ov?.artworkPipeline ?? [];
  const artworkTotal = artworkRows.reduce((s: number, r: any) => s + r.count, 0) || 1;
  const artworkStats = artworkRows.map((r: any) => ({
    label: r.status,
    count: r.count,
    pct:   Math.round((r.count / artworkTotal) * 100),
  }));

  /* ── heatmap ────────────────────────────────────────────── */
  const heatmap = ov?.heatmap ?? [
    { priority: "Urgent", values: [0,0,0,0,0] },
    { priority: "High",   values: [0,0,0,0,0] },
    { priority: "Medium", values: [0,0,0,0,0] },
    { priority: "Low",    values: [0,0,0,0,0] },
  ];
  const dotColors: Record<string, string> = { Urgent: "#EF4444", High: G, Medium: "#60A5FA", Low: "#9CA3AF" };

  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .fade-up { animation: fadeUp 0.45s ease both; }
        .fade-in { animation: fadeIn 0.6s ease both; }
        .gold-bar-track { background: rgba(198,175,75,0.10); }
        .gold-bar-fill {
          background: linear-gradient(90deg, #A8943E, #C6AF4B, #D4C870);
          background-size: 200%;
          animation: shimmer 2.5s linear infinite;
        }
      `}</style>

      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full opacity-[0.04]"
          style={{ background: `radial-gradient(circle, ${G} 0%, transparent 65%)` }} />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full opacity-[0.03]"
          style={{ background: `radial-gradient(circle, ${G} 0%, transparent 65%)` }} />
      </div>

      <div className="relative z-10 space-y-5 pb-10">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="fade-up flex items-end justify-between" style={{ animationDelay: "0ms" }}>
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="h-px w-8 rounded-full" style={{ background: `linear-gradient(90deg, ${G}, transparent)` }} />
              <p className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: G }}>ZARI ERP · OVERVIEW</p>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Welcome back, <span style={{ color: G_DIM }}>{user.username}</span>.
            </h1>
            <div className="flex items-center gap-3 mt-0.5">
              <p className="text-xs text-gray-400 flex items-center gap-1.5">
                <Clock className="h-3 w-3" style={{ color: G }} /> {today}
              </p>
              <button onClick={fetchOverview} disabled={ovLoading}
                className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg transition-all disabled:opacity-40"
                style={{ color: G_DIM, background: `${G}15`, border: `1px solid ${G}25` }}>
                <RefreshCw className={`h-2.5 w-2.5 ${ovLoading ? "animate-spin" : ""}`} />
                {ovLoading ? "Loading…" : ovError ? "Retry" : "Refresh"}
              </button>
            </div>
          </div>
          {/* Last Login Card */}
          <div className={`${card} fade-up px-4 py-3 flex items-center gap-3`} style={{ animationDelay: "100ms" }}>
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${G}15`, border: `1px solid ${G}30` }}>
              <LogIn className="h-4 w-4" style={{ color: G_DIM }} />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest mb-0.5" style={{ color: G }}>LAST LOGIN</p>
              <p className="text-xs font-bold text-gray-800">{user.username}</p>
              <p className="text-[10px] text-gray-400">Today</p>
            </div>
            {user.role === "admin" && (
              <div className="ml-4 pl-4 border-l border-gray-100">
                <div className="flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5" style={{ color: G }} />
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-widest text-gray-400">ACTIVE ORDERS</p>
                    <p className="text-base font-black" style={{ color: G_DIM }}>
                      {kpi ? kpi.styleOrders.active + kpi.swatchOrders.active : "…"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── KPI Cards ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((c) => (
            <button key={c.label} onClick={() => setLocation(c.path)}
              className={`${card} fade-up text-left w-full`} style={{ animationDelay: c.delay }}>
              <div className="h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${G}, transparent)` }} />
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: G }}>{c.label}</p>
                  <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${G}15`, border: `1px solid ${G}30` }}>
                    <c.icon className="h-4 w-4" style={{ color: G_DIM }} />
                  </div>
                </div>
                {ovLoading
                  ? <Skeleton className="h-10 w-16 mb-2" />
                  : <p className="text-[2.6rem] font-black leading-none tracking-tight text-gray-900">{c.value}</p>}
                <p className="text-[11px] mt-1 mb-3 text-gray-400">{c.sub}</p>
                {c.change !== null && (
                  <div className={`flex items-center gap-1 text-[11px] font-bold ${c.up ? "text-emerald-600" : "text-red-500"}`}>
                    {c.up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                    {c.change}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* ── Charts Row ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Trend Bar Chart */}
          <div className={`${card} fade-up lg:col-span-2 p-6`} style={{ animationDelay: "320ms" }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] mb-1" style={{ color: G }}>ORDER TREND</p>
                <h3 className="text-sm font-bold text-gray-800">Monthly Orders — Last 6 Months</h3>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-xs">
                  <div className="h-2 w-2 rounded-full bg-slate-400" />
                  <span className="text-gray-500 font-medium">Style</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="h-2 w-2 rounded-full" style={{ background: G }} />
                  <span className="text-gray-500 font-medium">Swatch</span>
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full"
                  style={{ color: G_DIM, background: `${G}12`, border: `1px solid ${G}30` }}>6 Months</span>
              </div>
            </div>
            {ovLoading ? (
              <Skeleton className="h-48" />
            ) : (
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={ov?.trend ?? []} barCategoryGap="28%" barGap={3}>
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9CA3AF", fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#D1D5DB" }} axisLine={false} tickLine={false} />
                  <ReTooltip content={<GoldTooltip />} cursor={{ fill: `${G}08`, radius: 6 }} />
                  <Bar dataKey="styleQty"  name="Style Orders"  fill={SLATE} radius={[5,5,0,0]} animationBegin={300} animationDuration={800} />
                  <Bar dataKey="swatchQty" name="Swatch Orders" fill={G}     radius={[5,5,0,0]} animationBegin={400} animationDuration={800} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Two Status Donuts */}
          <div className={`${card} fade-up p-5`} style={{ animationDelay: "400ms" }}>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] mb-0.5" style={{ color: G }}>STATUS TRACKER</p>
            <h3 className="text-sm font-bold text-gray-800 mb-4">Current Pipeline</h3>
            {ovLoading ? (
              <Skeleton className="h-40" />
            ) : (
              <div className="flex gap-4">
                <StatusDonut title="STYLE ORDERS"  subtitle="Style pipeline"  data={styleStatusData}  />
                <div className="w-px bg-gray-100 self-stretch" />
                <StatusDonut title="SWATCH ORDERS" subtitle="Swatch pipeline" data={swatchStatusData} />
              </div>
            )}
          </div>
        </div>

        {/* ── Content Row ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Recent Style Orders */}
          <div className={`${card} fade-up lg:col-span-1 p-6`} style={{ animationDelay: "480ms" }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] mb-0.5" style={{ color: G }}>RECENT STYLE ORDERS</p>
                <h3 className="text-sm font-bold text-gray-800">Latest 5</h3>
              </div>
              <button onClick={() => setLocation("/style-orders")}
                className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest transition-colors"
                style={{ color: G }}>
                View All <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            {ovLoading ? (
              <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : (
              <>
                <div className="grid grid-cols-[auto_1fr_auto] gap-x-3 pb-2 mb-1 border-b border-gray-100">
                  {["Order", "Client / Status", "Date"].map((h) => (
                    <span key={h} className="text-[9px] font-black uppercase tracking-widest text-gray-400">{h}</span>
                  ))}
                </div>
                {(ov?.recentOrders ?? []).map((order: any, idx: number) => (
                  <button key={order.code} onClick={() => setLocation("/style-orders")}
                    className="w-full grid grid-cols-[auto_1fr_auto] gap-x-3 py-2.5 text-left rounded-xl px-1 -mx-1 transition-all duration-200 hover:bg-amber-50/60 items-center"
                    style={{ borderBottom: idx < (ov?.recentOrders?.length ?? 0) - 1 ? "1px solid #F3F4F6" : "none" }}>
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ background: order.priority === "Urgent" ? "#EF4444" : order.priority === "High" ? G : order.priority === "Medium" ? "#60A5FA" : "#9CA3AF" }} />
                      <span className="text-xs font-bold font-mono text-gray-800">{order.code}</span>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-600 truncate font-medium">{order.client}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${statusPill[order.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {order.status}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap">{order.date}</span>
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Invoice Status Panel */}
          <div className={`${card} fade-up p-6`} style={{ animationDelay: "540ms" }}>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] mb-0.5" style={{ color: G }}>INVOICE STATUS</p>
            <h3 className="text-sm font-bold text-gray-800 mb-4">Billing Overview</h3>
            {ovLoading ? (
              <div className="space-y-3">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
            ) : (
              <>
                <div className="space-y-3">
                  {invoiceStats.map(({ status, Icon, count, amount, color, bg }) => (
                    <div key={status}
                      className="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:scale-[1.01] cursor-pointer"
                      style={{ background: bg, border: `1px solid ${color}20` }}>
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: `${color}18` }}>
                        <Icon className="h-4 w-4" style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color }}>{status}</p>
                        <p className="text-[11px] font-medium text-gray-500">{amount}</p>
                      </div>
                      <span className="text-xl font-black" style={{ color }}>{count}</span>
                    </div>
                  ))}
                </div>
                {(iv?.overdue.count ?? 0) > 0 && (
                  <div className="mt-3 p-2.5 rounded-xl text-[10px] font-bold flex items-center gap-2"
                    style={{ background: "rgba(239,68,68,0.06)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.15)" }}>
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    {iv.overdue.count} invoice{iv.overdue.count !== 1 ? "s" : ""} overdue — action required
                  </div>
                )}
              </>
            )}
          </div>

          {/* Activity Timeline */}
          <div className={`${card} fade-up p-6 flex flex-col`} style={{ animationDelay: "600ms" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] mb-0.5" style={{ color: G }}>ACTIVITY FEED</p>
                <h3 className="text-sm font-bold text-gray-800">Recent Actions</h3>
              </div>
            </div>
            <div className="relative flex-1 overflow-hidden">
              <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-100" />
              <div className="space-y-0">
                {ovLoading
                  ? Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-10 mb-2" />)
                  : (ov?.activityFeed ?? []).map((item: any, idx: number) => (
                    <button key={idx}
                      onClick={() => setLocation(item.refPath)}
                      className="fade-in w-full flex gap-3 py-2.5 pr-1 text-left rounded-xl hover:bg-amber-50/50 transition-colors pl-1 -ml-1 group"
                      style={{ animationDelay: `${600 + idx * 60}ms` }}>
                      <div className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0 z-10 ring-2 ring-white"
                        style={{ background: avatarColors[idx % avatarColors.length] }}>
                        {item.initials}
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p className="text-[10px] font-semibold text-gray-700 truncate">
                          <span className="font-black text-gray-900">{item.user}</span> {item.action}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ background: `${G}12`, color: G_DIM }}>{item.ref}</span>
                          <span className="text-[9px] text-gray-400">{item.time}</span>
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
            <button onClick={() => setLocation("/style-orders")}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all duration-200 hover:bg-amber-50"
              style={{ border: `1px solid ${G}30`, color: G_DIM }}>
              <ScrollText className="h-3.5 w-3.5" /> View All Logs
            </button>
          </div>
        </div>

        {/* ── Bottom Panels ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Vendor Payment Pending */}
          <div className={`${card} fade-up p-5`} style={{ animationDelay: "660ms" }}>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] mb-0.5" style={{ color: G }}>VENDOR PAYMENTS</p>
            <h3 className="text-sm font-bold text-gray-800 mb-4">Pending Clearance</h3>
            <div className="flex items-center gap-4 mb-4">
              <div className="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: `${G}15`, border: `1px solid ${G}30` }}>
                <Wallet className="h-6 w-6" style={{ color: G_DIM }} />
              </div>
              <div>
                {ovLoading
                  ? <Skeleton className="h-8 w-28 mb-1" />
                  : <p className="text-2xl font-black text-gray-900">{ov?.vendorPending?.formatted ?? "₹0"}</p>}
                <p className="text-[10px] text-gray-400 font-medium">Total pending amount</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: "rgba(198,175,75,0.07)", border: `1px solid ${G}20` }}>
              <Receipt className="h-4 w-4 shrink-0" style={{ color: G_DIM }} />
              <div className="flex-1">
                <p className="text-[10px] font-black text-gray-700">Open Purchase Receipts</p>
                <p className="text-[10px] text-gray-400">Awaiting vendor confirmation</p>
              </div>
              <span className="text-lg font-black" style={{ color: G }}>
                {ovLoading ? "…" : (ov?.openPrCount ?? 0)}
              </span>
            </div>
            <button onClick={() => setLocation("/inventory/purchase-receipts")}
              className="mt-3 w-full py-2 rounded-xl text-[10px] font-bold transition-all hover:opacity-80"
              style={{ background: `${G}15`, color: G_DIM, border: `1px solid ${G}25` }}>
              View Pending PRs →
            </button>
          </div>

          {/* Artwork Pipeline */}
          <div className={`${card} fade-up p-5`} style={{ animationDelay: "720ms" }}>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] mb-0.5" style={{ color: G }}>ARTWORK PIPELINE</p>
            <h3 className="text-sm font-bold text-gray-800 mb-4">Current Status</h3>
            {ovLoading ? (
              <div className="space-y-3">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
            ) : artworkStats.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No artwork data</p>
            ) : (
              <div className="space-y-4">
                {artworkStats.map((a: any, i: number) => (
                  <div key={a.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-gray-500">{a.label}</span>
                      <span className="text-xs font-black" style={{ color: G_DIM }}>{a.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full gold-bar-track overflow-hidden">
                      <div className="h-full rounded-full gold-bar-fill"
                        style={{ width: `${a.pct}%`, animationDelay: `${i * 200}ms` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className={`${card} fade-up p-5`} style={{ animationDelay: "780ms" }}>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] mb-0.5" style={{ color: G }}>QUICK ACTIONS</p>
            <h3 className="text-sm font-bold text-gray-800 mb-4">Jump Right In</h3>
            <div className="space-y-1.5">
              {[
                { label: "New Style Order",      icon: Star,         path: "/style-orders"         },
                { label: "New Swatch Order",     icon: Zap,          path: "/swatch-orders"        },
                { label: "All Style Orders",     icon: Activity,     path: "/style-orders"         },
                { label: "Client Masters",       icon: Users,        path: "/masters/clients"      },
                { label: "Accounts Dashboard",   icon: ShoppingCart, path: "/accounts/dashboard"   },
              ].map((action) => (
                <button key={action.label} onClick={() => setLocation(action.path)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200 text-left group hover:bg-amber-50"
                  style={{ border: "1px solid transparent" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = `${G}30`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent"; }}>
                  <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${G}15`, border: `1px solid ${G}25` }}>
                    <action.icon className="h-3.5 w-3.5" style={{ color: G_DIM }} />
                  </div>
                  <span className="text-sm font-medium text-gray-600 flex-1 group-hover:text-gray-900 transition-colors">
                    {action.label}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-amber-500 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Priority × Status Heatmap ────────────────────────────── */}
        <div className={`${card} fade-up p-6`} style={{ animationDelay: "840ms" }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.18em] mb-0.5" style={{ color: G }}>ORDER METRICS</p>
              <h3 className="text-sm font-bold text-gray-800">Style Orders by Priority &amp; Status</h3>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" style={{ color: G }} />
              <span className="text-xs font-bold" style={{ color: G }}>Live</span>
            </div>
          </div>
          {ovLoading ? (
            <Skeleton className="h-32" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left pb-3 w-28">
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Priority</span>
                    </th>
                    {["Draft", "Issued", "In Progress", "Completed", "Cancelled"].map(s => (
                      <th key={s} className="pb-3 text-center px-1">
                        <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">{s}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmap.map((row: any) => {
                    const rowMax = Math.max(...row.values, 1);
                    return (
                      <tr key={row.priority}>
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: dotColors[row.priority] ?? "#9CA3AF" }} />
                            <span className="font-bold text-gray-600">{row.priority}</span>
                          </div>
                        </td>
                        {row.values.map((v: number, i: number) => {
                          const isMax   = v === rowMax && v > 0;
                          const isHigh  = v > rowMax * 0.6 && !isMax;
                          const isEmpty = v === 0;
                          return (
                            <td key={i} className="py-2 text-center px-1">
                              <span className="inline-flex items-center justify-center h-8 w-8 rounded-xl font-black text-sm mx-auto transition-all hover:scale-110"
                                style={{
                                  background: isEmpty ? "#F9FAFB" : isMax ? G : isHigh ? `${G}28` : `${G}12`,
                                  color:      isEmpty ? "#D1D5DB" : isMax ? "#fff"   : isHigh ? G_DIM : "#B8A240",
                                  border: isMax ? "none" : `1px solid ${G}22`,
                                }}>
                                {isEmpty ? "–" : v}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </AppLayout>
  );
}
