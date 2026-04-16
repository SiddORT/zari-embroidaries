import { useEffect } from "react";
import { useLocation } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts";
import {
  Package, Palette, Users, Clock, ArrowUpRight, ArrowDownRight,
  Layers, ChevronRight, Star, Zap, Activity, TrendingUp,
} from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/layout/AppLayout";

// ── Brand Palette ─────────────────────────────────────────────────
const G       = "#C6AF4B";   // primary gold
const G_LIGHT = "#D4C870";   // lighter gold
const G_DIM   = "#A8943E";   // darker gold
const G_GLOW  = "rgba(198,175,75,0.18)";
const DARK1   = "#0E0E14";
const DARK2   = "#141420";
const DARK3   = "#1C1C2A";

// ── Data ──────────────────────────────────────────────────────────
const trendData = [
  { month: "Nov", styleQty: 18, swatchQty: 42 },
  { month: "Dec", styleQty: 24, swatchQty: 55 },
  { month: "Jan", styleQty: 31, swatchQty: 61 },
  { month: "Feb", styleQty: 27, swatchQty: 48 },
  { month: "Mar", styleQty: 38, swatchQty: 72 },
  { month: "Apr", styleQty: 44, swatchQty: 81 },
];

const statusData = [
  { name: "Draft",       value: 12, color: "#3A3A55" },
  { name: "Issued",      value: 18, color: G },
  { name: "In Progress", value: 28, color: G_LIGHT },
  { name: "Completed",   value: 34, color: "#E8E0C0" },
  { name: "Cancelled",   value: 4,  color: "#C44A5A" },
];

const recentOrders = [
  { code: "ZST-2601", client: "House of Amore",  status: "In Progress", date: "15 Apr", priority: "High" },
  { code: "ZST-2600", client: "Vera Couture",     status: "Issued",      date: "14 Apr", priority: "Medium" },
  { code: "ZST-2599", client: "Nila Threads",     status: "Completed",   date: "13 Apr", priority: "Low" },
  { code: "ZST-2598", client: "Meera Bespoke",    status: "Draft",       date: "12 Apr", priority: "Urgent" },
  { code: "ZST-2597", client: "Elara Fashion",    status: "In Progress", date: "11 Apr", priority: "High" },
];

const artworkStats = [
  { label: "Pending Toile",  count: 7,  pct: 23 },
  { label: "Pattern Ready",  count: 12, pct: 40 },
  { label: "Client Review",  count: 5,  pct: 17 },
  { label: "Approved",       count: 23, pct: 77 },
];

const statusPill: Record<string, string> = {
  Draft:         "bg-white/10 text-white/50",
  Issued:        "bg-[#C6AF4B]/20 text-[#C6AF4B]",
  "In Progress": "bg-[#D4C870]/20 text-[#D4C870]",
  Completed:     "bg-white/15 text-white/80",
  Cancelled:     "bg-red-900/30 text-red-400",
};

const priorityDot: Record<string, string> = {
  Low:    "bg-white/30",
  Medium: "bg-blue-400",
  High:   "#C6AF4B",
  Urgent: "bg-red-500",
};

// ── Card base class ───────────────────────────────────────────────
const card = [
  "rounded-2xl overflow-hidden",
  "bg-gradient-to-br from-[#111118] to-[#1A1A26]",
  "border border-[#C6AF4B]/20",
  `shadow-[0_4px_24px_rgba(198,175,75,0.10),0_1px_4px_rgba(0,0,0,0.35)]`,
  "hover:shadow-[0_8px_36px_rgba(198,175,75,0.20),0_2px_8px_rgba(0,0,0,0.4)]",
  "hover:-translate-y-0.5 transition-all duration-300",
].join(" ");

// ── Custom tooltip ────────────────────────────────────────────────
function GoldTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-4 py-3 text-xs" style={{ background: DARK1, border: `1px solid ${G}30`, boxShadow: `0 4px 20px ${G_GLOW}` }}>
      <p className="font-bold mb-2" style={{ color: G }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-white/70">{p.name}: <span className="font-bold text-white">{p.value}</span></p>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const token = localStorage.getItem("zarierp_token");

  const { data: user, isLoading, isError } = useGetMe({
    query: { enabled: !!token, queryKey: getGetMeQueryKey(), retry: false },
  });

  const logoutMutation = useLogout();

  useEffect(() => {
    if (!token || isError) {
      localStorage.removeItem("zarierp_token");
      setLocation("/login");
    }
  }, [token, isError, setLocation]);

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => { localStorage.removeItem("zarierp_token"); queryClient.clear(); setLocation("/login"); },
      onError:   () => { localStorage.removeItem("zarierp_token"); queryClient.clear(); setLocation("/login"); },
    });
  };

  if (isLoading || !user) {
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
  const totalStatus = statusData.reduce((s, d) => s + d.value, 0);

  const kpiCards = [
    { label: "STYLE ORDERS",   value: "44",  sub: "Active this month",      change: "+15.8%", up: true,  icon: Layers,   delay: "0ms"   },
    { label: "SWATCH ORDERS",  value: "81",  sub: "Active this month",      change: "+12.5%", up: true,  icon: Package,  delay: "80ms"  },
    { label: "ARTWORKS",       value: "47",  sub: "Across all orders",      change: "+6.2%",  up: true,  icon: Palette,  delay: "160ms" },
    { label: "ACTIVE CLIENTS", value: "18",  sub: "In current pipeline",    change: "−2 this month", up: false, icon: Users, delay: "240ms" },
  ];

  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>

      {/* Animation keyframes */}
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes pulseGold {
          0%, 100% { box-shadow: 0 0 0 0 rgba(198,175,75,0); }
          50%       { box-shadow: 0 0 0 6px rgba(198,175,75,0.12); }
        }
        .fade-up { animation: fadeUp 0.5s ease both; }
        .gold-bar-track { background: rgba(198,175,75,0.12); }
        .gold-bar-fill {
          background: linear-gradient(90deg, #A8943E, #C6AF4B, #D4C870);
          background-size: 200%;
          animation: shimmer 2.5s linear infinite;
        }
      `}</style>

      {/* Subtle background glow */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full opacity-[0.04]"
          style={{ background: `radial-gradient(circle, ${G} 0%, transparent 65%)` }} />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full opacity-[0.03]"
          style={{ background: `radial-gradient(circle, ${G} 0%, transparent 65%)` }} />
      </div>

      <div className="relative z-10 space-y-5 pb-12">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="fade-up flex items-end justify-between" style={{ animationDelay: "0ms" }}>
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="h-px w-8 rounded-full" style={{ background: `linear-gradient(90deg, ${G}, transparent)` }} />
              <p className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: G }}>
                ZARI ERP · OVERVIEW
              </p>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Welcome back, <span style={{ color: G }}>{user.username}</span>.
            </h1>
            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
              <Clock className="h-3 w-3" style={{ color: G }} /> {today}
            </p>
          </div>
          <div className="flex items-center gap-5 text-xs">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: DARK3, border: `1.5px solid ${G}40` }} />
              <span className="text-gray-500 font-medium">Style Orders</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: G }} />
              <span className="text-gray-500 font-medium">Swatch Orders</span>
            </div>
          </div>
        </div>

        {/* ── KPI Cards ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((c) => (
            <div key={c.label} className={`${card} fade-up`} style={{ animationDelay: c.delay }}>
              {/* Gold shimmer top bar */}
              <div className="h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${G}, transparent)` }} />
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: G }}>
                    {c.label}
                  </p>
                  <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${G}18`, border: `1px solid ${G}30` }}>
                    <c.icon className="h-4 w-4" style={{ color: G }} />
                  </div>
                </div>
                <p className="text-[2.6rem] font-black leading-none tracking-tight text-white">
                  {c.value}
                </p>
                <p className="text-[11px] mt-1 mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {c.sub}
                </p>
                <div className={`flex items-center gap-1 text-[11px] font-bold ${c.up ? "text-emerald-400" : "text-red-400"}`}>
                  {c.up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                  {c.change}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Charts Row ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Trend bar chart */}
          <div className={`${card} fade-up lg:col-span-2 p-6`} style={{ animationDelay: "320ms" }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] mb-1" style={{ color: G }}>ORDER TREND</p>
                <h3 className="text-sm font-bold text-white">Monthly Orders — Nov 2025 to Apr 2026</h3>
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full"
                style={{ color: G, background: `${G}18`, border: `1px solid ${G}30` }}>
                6 Months
              </span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trendData} barCategoryGap="28%" barGap={3}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.35)", fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.25)" }} axisLine={false} tickLine={false} />
                <Tooltip content={<GoldTooltip />} cursor={{ fill: `${G}08`, radius: 6 }} />
                <Bar dataKey="styleQty"  name="Style Orders"  fill={DARK3}  radius={[5,5,0,0]} />
                <Bar dataKey="swatchQty" name="Swatch Orders" fill={G}      radius={[5,5,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Status donut */}
          <div className={`${card} fade-up p-6`} style={{ animationDelay: "400ms" }}>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] mb-0.5" style={{ color: G }}>STYLE ORDER STATUS</p>
            <h3 className="text-sm font-bold text-white mb-4">Current Pipeline</h3>
            <div className="flex justify-center mb-4">
              <div className="relative">
                <PieChart width={140} height={140}>
                  <Pie data={statusData} cx={65} cy={65} innerRadius={44} outerRadius={64}
                    dataKey="value" strokeWidth={2} stroke={DARK2}>
                    {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                </PieChart>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black text-white">{totalStatus}</span>
                  <span className="text-[9px] uppercase tracking-widest font-bold" style={{ color: G }}>Total</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {statusData.map((s) => (
                <div key={s.name} className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.color }} />
                  <span className="text-xs flex-1" style={{ color: "rgba(255,255,255,0.55)" }}>{s.name}</span>
                  <div className="w-14 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <div className="h-full rounded-full" style={{ width: `${(s.value/totalStatus)*100}%`, background: s.color }} />
                  </div>
                  <span className="text-xs font-bold text-white w-5 text-right">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Bottom Row ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Recent orders */}
          <div className={`${card} fade-up lg:col-span-2 p-6`} style={{ animationDelay: "480ms" }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] mb-0.5" style={{ color: G }}>RECENT STYLE ORDERS</p>
                <h3 className="text-sm font-bold text-white">Latest 5 Orders</h3>
              </div>
              <button onClick={() => setLocation("/style-orders")}
                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-colors"
                style={{ color: G }}
                onMouseEnter={e => (e.currentTarget.style.color = G_LIGHT)}
                onMouseLeave={e => (e.currentTarget.style.color = G)}>
                View All <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            {/* Table header */}
            <div className="grid grid-cols-[1fr_1.4fr_1fr_1fr] gap-3 pb-2.5 mb-1"
              style={{ borderBottom: "1px solid rgba(198,175,75,0.15)" }}>
              {["Order", "Client", "Status", "Date"].map((h, i) => (
                <span key={h} className={`text-[9px] font-black uppercase tracking-widest ${i === 3 ? "text-right" : ""}`}
                  style={{ color: "rgba(255,255,255,0.25)" }}>{h}</span>
              ))}
            </div>
            {recentOrders.map((order, idx) => (
              <button key={order.code} onClick={() => setLocation("/style-orders")}
                className="w-full grid grid-cols-[1fr_1.4fr_1fr_1fr] gap-3 py-2.5 text-left rounded-xl px-1 -mx-1 transition-all duration-200"
                style={{ borderBottom: idx < recentOrders.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${G}08`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ background: order.priority === "Urgent" ? "#EF4444" : order.priority === "High" ? G : order.priority === "Medium" ? "#60A5FA" : "#6B7280" }} />
                  <span className="text-xs font-bold font-mono text-white">{order.code}</span>
                </div>
                <span className="text-xs truncate" style={{ color: "rgba(255,255,255,0.55)" }}>{order.client}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full w-fit ${statusPill[order.status] ?? "bg-white/10 text-white/50"}`}>
                  {order.status}
                </span>
                <span className="text-xs text-right" style={{ color: "rgba(255,255,255,0.3)" }}>{order.date}</span>
              </button>
            ))}
          </div>

          {/* Right column */}
          <div className="space-y-4">

            {/* Artwork pipeline */}
            <div className={`${card} fade-up p-5`} style={{ animationDelay: "560ms" }}>
              <p className="text-[9px] font-black uppercase tracking-[0.18em] mb-0.5" style={{ color: G }}>ARTWORK PIPELINE</p>
              <h3 className="text-sm font-bold text-white mb-4">Current Status</h3>
              <div className="space-y-3.5">
                {artworkStats.map((a, i) => (
                  <div key={a.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>{a.label}</span>
                      <span className="text-xs font-black" style={{ color: G }}>{a.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full gold-bar-track overflow-hidden">
                      <div className="h-full rounded-full gold-bar-fill"
                        style={{ width: `${a.pct}%`, animationDelay: `${i * 200}ms` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className={`${card} fade-up p-5`} style={{ animationDelay: "640ms" }}>
              <p className="text-[9px] font-black uppercase tracking-[0.18em] mb-0.5" style={{ color: G }}>QUICK ACTIONS</p>
              <h3 className="text-sm font-bold text-white mb-4">Jump Right In</h3>
              <div className="space-y-1.5">
                {[
                  { label: "New Style Order",  icon: Star,     path: "/style-orders/new" },
                  { label: "New Swatch Order", icon: Zap,      path: "/swatch-orders"    },
                  { label: "View All Orders",  icon: Activity, path: "/style-orders"      },
                  { label: "Client Masters",   icon: Users,    path: "/clients"           },
                ].map((action) => (
                  <button key={action.label} onClick={() => setLocation(action.path)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200 text-left group"
                    style={{ border: "1px solid transparent" }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLButtonElement;
                      el.style.background = `${G}12`;
                      el.style.borderColor = `${G}30`;
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLButtonElement;
                      el.style.background = "transparent";
                      el.style.borderColor = "transparent";
                    }}>
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${G}20`, border: `1px solid ${G}35` }}>
                      <action.icon className="h-3.5 w-3.5" style={{ color: G }} />
                    </div>
                    <span className="text-sm font-medium flex-1" style={{ color: "rgba(255,255,255,0.65)" }}>
                      {action.label}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 opacity-30 group-hover:opacity-70 transition-opacity" style={{ color: G }} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Priority × Status Heatmap ───────────────────────────── */}
        <div className={`${card} fade-up p-6`} style={{ animationDelay: "720ms" }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.18em] mb-0.5" style={{ color: G }}>ORDER METRICS</p>
              <h3 className="text-sm font-bold text-white">This Week — Orders by Priority &amp; Status</h3>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" style={{ color: G }} />
              <span className="text-xs font-bold" style={{ color: G }}>Live</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left pb-3 w-28">
                    <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>Priority</span>
                  </th>
                  {["Draft", "Issued", "In Progress", "Completed", "Cancelled"].map(s => (
                    <th key={s} className="pb-3 text-center px-1">
                      <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>{s}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { priority: "Urgent", values: [2, 3, 7, 1, 1],  dot: "#EF4444" },
                  { priority: "High",   values: [3, 6, 12, 8, 2], dot: G },
                  { priority: "Medium", values: [4, 7, 6, 14, 1], dot: "#60A5FA" },
                  { priority: "Low",    values: [3, 2, 3, 11, 0], dot: "#6B7280" },
                ].map((row) => {
                  const rowMax = Math.max(...row.values);
                  return (
                    <tr key={row.priority}>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: row.dot }} />
                          <span className="font-bold text-white/70">{row.priority}</span>
                        </div>
                      </td>
                      {row.values.map((v, i) => {
                        const isMax  = v === rowMax;
                        const isHigh = v > rowMax * 0.6 && !isMax;
                        const isEmpty = v === 0;
                        return (
                          <td key={i} className="py-2 text-center px-1">
                            <span className="inline-flex items-center justify-center h-8 w-8 rounded-xl font-black text-sm mx-auto transition-all"
                              style={{
                                background: isEmpty ? "rgba(255,255,255,0.04)"
                                          : isMax   ? G
                                          : isHigh  ? `${G}40`
                                          :           `${G}18`,
                                color:      isEmpty ? "rgba(255,255,255,0.15)"
                                          : isMax   ? DARK1
                                          : isHigh  ? G
                                          :           `${G}80`,
                                border: isMax ? "none" : `1px solid ${G}20`,
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
        </div>

      </div>
    </AppLayout>
  );
}
