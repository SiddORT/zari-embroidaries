import { useEffect } from "react";
import { useLocation } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts";
import {
  Package, Palette, Users, Clock, ArrowUpRight, ArrowDownRight,
  Layers, FileText, TrendingUp, ChevronRight, Star, Zap, Activity,
} from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/layout/AppLayout";

// ── Palette from reference image ─────────────────────────────────
const ORANGE   = "#E8956D";
const ORANGE_L = "#F4C4A8";
const GOLD     = "#C9B45C";
const DARK     = "#1A1A2E";
const CARD_BG  = "#FFFFFF";

// ── Mock data ─────────────────────────────────────────────────────
const trendData = [
  { month: "Nov", styleOrders: 18, swatchOrders: 42 },
  { month: "Dec", styleOrders: 24, swatchOrders: 55 },
  { month: "Jan", styleOrders: 31, swatchOrders: 61 },
  { month: "Feb", styleOrders: 27, swatchOrders: 48 },
  { month: "Mar", styleOrders: 38, swatchOrders: 72 },
  { month: "Apr", styleOrders: 44, swatchOrders: 81 },
];

const statusData = [
  { name: "Draft",       value: 12, color: "#94A3B8" },
  { name: "Issued",      value: 18, color: GOLD },
  { name: "In Progress", value: 28, color: ORANGE },
  { name: "Completed",   value: 34, color: "#1A1A2E" },
  { name: "Cancelled",   value: 4,  color: "#FCA5A5" },
];

const recentOrders = [
  { code: "ZST-2601", client: "House of Amore",    status: "In Progress", date: "15 Apr",  priority: "High" },
  { code: "ZST-2600", client: "Vera Couture",       status: "Issued",      date: "14 Apr",  priority: "Medium" },
  { code: "ZST-2599", client: "Nila Threads",       status: "Completed",   date: "13 Apr",  priority: "Low" },
  { code: "ZST-2598", client: "Meera Bespoke",      status: "Draft",       date: "12 Apr",  priority: "Urgent" },
  { code: "ZST-2597", client: "Elara Fashion",      status: "In Progress", date: "11 Apr",  priority: "High" },
];

const artworkStats = [
  { label: "Pending Toile",  count: 7,  color: ORANGE },
  { label: "Pattern Ready",  count: 12, color: GOLD },
  { label: "Client Review",  count: 5,  color: "#6366F1" },
  { label: "Approved",       count: 23, color: "#10B981" },
];

const statusPill: Record<string, string> = {
  Draft:       "bg-slate-100 text-slate-600",
  Issued:      "bg-amber-100 text-amber-700",
  "In Progress":"bg-orange-100 text-orange-700",
  Completed:   "bg-emerald-100 text-emerald-700",
  Cancelled:   "bg-red-100 text-red-600",
};

const priorityDot: Record<string, string> = {
  Low:    "bg-slate-400",
  Medium: "bg-blue-500",
  High:   "bg-amber-500",
  Urgent: "bg-red-500",
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const token = localStorage.getItem("zarierp_token");

  const { data: user, isLoading, isError } = useGetMe({
    query: {
      enabled: !!token,
      queryKey: getGetMeQueryKey(),
      retry: false,
    },
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
      onSuccess: () => {
        localStorage.removeItem("zarierp_token");
        queryClient.clear();
        setLocation("/login");
      },
      onError: () => {
        localStorage.removeItem("zarierp_token");
        queryClient.clear();
        setLocation("/login");
      },
    });
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-[#1A1A2E] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading workspace…</p>
        </div>
      </div>
    );
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const totalStatusCount = statusData.reduce((s, d) => s + d.value, 0);

  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>

      {/* Decorative background blobs (matches reference image aesthetic) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full opacity-[0.07]"
          style={{ background: `radial-gradient(circle, ${ORANGE} 0%, transparent 70%)` }} />
        <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full opacity-[0.06]"
          style={{ background: `radial-gradient(circle, ${GOLD} 0%, transparent 70%)` }} />
      </div>

      <div className="relative z-10 space-y-6 pb-10">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#E8956D] mb-1">
              ZARI ERP · OVERVIEW
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-[#1A1A2E]">
              Welcome back, {user.username}.
            </h1>
            <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> {today}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="h-2.5 w-2.5 rounded-full bg-[#1A1A2E] inline-block" />
            <span className="font-medium text-gray-700">Style Orders</span>
            <span className="h-2.5 w-2.5 rounded-full bg-[#E8956D] inline-block ml-2" />
            <span className="font-medium text-gray-700">Swatch Orders</span>
          </div>
        </div>

        {/* ── KPI Row ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "STYLE ORDERS",
              value: "44",
              sub: "Active this month",
              change: "+15.8%",
              up: true,
              icon: Layers,
              accent: ORANGE,
              accentBg: "#FDF0E8",
            },
            {
              label: "SWATCH ORDERS",
              value: "81",
              sub: "Active this month",
              change: "+12.5%",
              up: true,
              icon: Package,
              accent: GOLD,
              accentBg: "#FAF5E4",
            },
            {
              label: "ARTWORKS",
              value: "47",
              sub: "Across all orders",
              change: "+6.2%",
              up: true,
              icon: Palette,
              accent: "#6366F1",
              accentBg: "#EEF2FF",
            },
            {
              label: "ACTIVE CLIENTS",
              value: "18",
              sub: "In current pipeline",
              change: "-2 this month",
              up: false,
              icon: Users,
              accent: "#10B981",
              accentBg: "#ECFDF5",
            },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-5">
              <div className="flex items-start justify-between mb-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400">
                  {card.label}
                </p>
                <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: card.accentBg }}>
                  <card.icon className="h-4 w-4" style={{ color: card.accent }} />
                </div>
              </div>
              <p className="text-[2.2rem] font-bold leading-none tracking-tight text-[#1A1A2E]">
                {card.value}
              </p>
              <p className="text-[11px] text-gray-400 mt-1 mb-3">{card.sub}</p>
              <div className={`flex items-center gap-1 text-[11px] font-semibold ${card.up ? "text-emerald-600" : "text-red-500"}`}>
                {card.up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                {card.change}
              </div>
            </div>
          ))}
        </div>

        {/* ── Main Row ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Trend Chart (spans 2 cols) */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-0.5">ORDER TREND</p>
                <h3 className="text-sm font-bold text-[#1A1A2E]">Monthly Orders — Nov 2025 to Apr 2026</h3>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#E8956D] bg-[#FDF0E8] px-3 py-1.5 rounded-full">
                6 Months
              </span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trendData} barCategoryGap="28%" barGap={3}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9CA3AF", fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: CARD_BG, border: "none", borderRadius: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.12)", fontSize: 12 }}
                  cursor={{ fill: "rgba(0,0,0,0.03)", radius: 6 }}
                />
                <Bar dataKey="styleOrders" name="Style Orders" fill={DARK} radius={[5, 5, 0, 0]} />
                <Bar dataKey="swatchOrders" name="Swatch Orders" fill={ORANGE} radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Status Donut */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-6">
            <div className="mb-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-0.5">STYLE ORDER STATUS</p>
              <h3 className="text-sm font-bold text-[#1A1A2E]">Current Pipeline</h3>
            </div>
            <div className="flex items-center justify-center mb-5">
              <div className="relative">
                <PieChart width={140} height={140}>
                  <Pie data={statusData} cx={65} cy={65} innerRadius={42} outerRadius={62}
                    dataKey="value" strokeWidth={2} stroke="white">
                    {statusData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-[#1A1A2E]">{totalStatusCount}</span>
                  <span className="text-[10px] text-gray-400 font-medium">Total</span>
                </div>
              </div>
            </div>
            <div className="space-y-2.5">
              {statusData.map((s) => (
                <div key={s.name} className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                  <span className="text-xs text-gray-600 flex-1">{s.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(s.value / totalStatusCount) * 100}%`, background: s.color }} />
                    </div>
                    <span className="text-xs font-bold text-[#1A1A2E] w-5 text-right">{s.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Bottom Row ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Recent Style Orders */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-0.5">RECENT STYLE ORDERS</p>
                <h3 className="text-sm font-bold text-[#1A1A2E]">Latest 5 Orders</h3>
              </div>
              <button onClick={() => setLocation("/style-orders")}
                className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#E8956D] hover:text-[#d47a55] transition-colors">
                View All <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-0">
              <div className="grid grid-cols-[1fr_1.4fr_1fr_1fr] gap-3 pb-2 border-b border-gray-100">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Order</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Client</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 text-right">Date</span>
              </div>
              {recentOrders.map((order) => (
                <button key={order.code} onClick={() => setLocation("/style-orders")}
                  className="w-full grid grid-cols-[1fr_1.4fr_1fr_1fr] gap-3 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors rounded-xl px-1 -mx-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${priorityDot[order.priority] ?? "bg-gray-400"}`} />
                    <span className="text-xs font-bold text-[#1A1A2E] font-mono">{order.code}</span>
                  </div>
                  <span className="text-xs text-gray-600 truncate">{order.client}</span>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit ${statusPill[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {order.status}
                  </span>
                  <span className="text-xs text-gray-400 text-right">{order.date}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right column: Artwork stats + Quick Actions */}
          <div className="space-y-4">

            {/* Artwork breakdown */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-0.5">ARTWORK PIPELINE</p>
              <h3 className="text-sm font-bold text-[#1A1A2E] mb-4">Current Status</h3>
              <div className="space-y-3">
                {artworkStats.map((a) => (
                  <div key={a.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-600">{a.label}</span>
                      <span className="text-xs font-bold text-[#1A1A2E]">{a.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${(a.count / 30) * 100}%`, background: a.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-[#1A1A2E] rounded-2xl shadow-[0_2px_12px_rgba(26,26,46,0.2)] p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#E8956D] mb-1">QUICK ACTIONS</p>
              <h3 className="text-sm font-bold text-white mb-4">Jump Right In</h3>
              <div className="space-y-2.5">
                {[
                  { label: "New Style Order",  icon: Star,     path: "/style-orders/new", color: ORANGE },
                  { label: "New Swatch Order", icon: Zap,      path: "/swatch-orders",    color: GOLD },
                  { label: "View All Orders",  icon: Activity, path: "/style-orders",     color: "#6366F1" },
                  { label: "Client Masters",   icon: Users,    path: "/clients",           color: "#10B981" },
                ].map((action) => (
                  <button key={action.label} onClick={() => setLocation(action.path)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 transition-colors text-left group">
                    <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${action.color}22` }}>
                      <action.icon className="h-4 w-4" style={{ color: action.color }} />
                    </div>
                    <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                      {action.label}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-gray-500 group-hover:text-gray-300 ml-auto transition-colors" />
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* ── Survey Score–style Heatmap Row (matches reference's survey section) ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-0.5">ORDER METRICS</p>
              <h3 className="text-sm font-bold text-[#1A1A2E]">This Week — Orders by Priority &amp; Status</h3>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left pb-3 text-gray-400 font-bold uppercase tracking-widest text-[10px] w-36">Priority</th>
                  {["Draft", "Issued", "In Progress", "Completed", "Cancelled"].map(s => (
                    <th key={s} className="pb-3 text-gray-400 font-bold uppercase tracking-widest text-[10px] text-center px-2">{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="space-y-1">
                {[
                  { priority: "Urgent", values: [2, 3, 7, 1, 1],  dotColor: "bg-red-500" },
                  { priority: "High",   values: [3, 6, 12, 8, 2], dotColor: "bg-amber-500" },
                  { priority: "Medium", values: [4, 7, 6, 14, 1], dotColor: "bg-blue-500" },
                  { priority: "Low",    values: [3, 2, 3, 11, 0], dotColor: "bg-slate-400" },
                ].map((row) => {
                  const rowMax = Math.max(...row.values);
                  return (
                    <tr key={row.priority}>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${row.dotColor}`} />
                          <span className="font-semibold text-[#1A1A2E]">{row.priority}</span>
                        </div>
                      </td>
                      {row.values.map((v, i) => (
                        <td key={i} className="py-2 text-center px-2">
                          <span className="inline-flex items-center justify-center h-8 w-8 rounded-xl font-bold text-sm mx-auto"
                            style={{
                              background: v === 0 ? "#F9FAFB" : v === rowMax ? "#1A1A2E" : v > rowMax * 0.6 ? "#E8956D" : "#FDF0E8",
                              color:      v === 0 ? "#D1D5DB" : v === rowMax ? "#FFFFFF" : v > rowMax * 0.6 ? "#FFFFFF" : "#E8956D",
                            }}>
                            {v === 0 ? "–" : v}
                          </span>
                        </td>
                      ))}
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
