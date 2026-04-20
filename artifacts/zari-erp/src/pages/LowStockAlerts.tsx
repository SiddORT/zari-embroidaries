import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  AlertTriangle, XCircle, ShoppingCart, RefreshCw,
  Package, CheckCircle2, Boxes,
} from "lucide-react";
import { useGetMe, getGetMeQueryKey, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import TopNavbar from "@/components/layout/TopNavbar";
import { useToast } from "@/hooks/use-toast";

const G     = "#C6AF4B";
const G_DIM = "#A8943E";

const card = [
  "rounded-2xl bg-white",
  "border border-[#C6AF4B]/15",
  "shadow-[0_2px_16px_rgba(198,175,75,0.12),0_1px_3px_rgba(0,0,0,0.06)]",
].join(" ");

interface AlertItem {
  id: number;
  item_name: string;
  item_code: string | null;
  current_stock: string;
  available_stock: string;
  reorder_level: string;
  minimum_level: string;
  maximum_level: string;
  unit_type: string | null;
  source_type: string;
}

export default function LowStockAlerts() {
  const [, navigate] = useLocation();
  const { toast }    = useToast();
  const queryClient  = useQueryClient();
  const token        = localStorage.getItem("zarierp_token");

  const { data: user, isLoading: userLoading, isError } = useGetMe({
    query: { enabled: !!token, queryKey: getGetMeQueryKey(), retry: false },
  });
  const logoutMutation = useLogout();

  const [items, setItems]       = useState<AlertItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  useEffect(() => { if (isError) navigate("/login"); }, [isError, navigate]);

  function fetchAlerts() {
    if (!token) return;
    setLoading(true);
    customFetch<{ data: AlertItem[] }>("/api/inventory/low-stock-alerts")
      .then(d => { setItems(d.data ?? []); setLastFetched(new Date()); })
      .catch(() => toast({ title: "Failed to load alerts", variant: "destructive" }))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchAlerts(); }, [token]);

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

  const outOfStock = items.filter(i => parseFloat(i.current_stock ?? "0") <= 0);
  const lowStock   = items.filter(i => {
    const cur   = parseFloat(i.current_stock ?? "0");
    const reord = parseFloat(i.reorder_level ?? "0");
    return cur > 0 && reord > 0 && cur <= reord;
  });

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <TopNavbar
        username={(user as { name?: string } | undefined)?.name ?? ""}
        role={(user as { role?: string } | undefined)?.role ?? ""}
        onLogout={handleLogout}
        isLoggingOut={logoutMutation.isPending}
      />

      <div className="py-6 px-6 max-w-screen-2xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="h-px w-6 rounded-full" style={{ background: `linear-gradient(90deg, ${G}, transparent)` }} />
              <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: G }}>INVENTORY · ALERTS</p>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Low-Stock &amp; Out-of-Stock Alerts</h1>
            <p className="text-sm text-gray-500 mt-0.5">Items that have reached or fallen below their reorder level</p>
          </div>
          <div className="flex items-center gap-3">
            {lastFetched && (
              <p className="text-xs text-gray-400">
                Last updated: {lastFetched.toLocaleTimeString("en-IN")}
              </p>
            )}
            <button onClick={fetchAlerts} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
              style={{ background: `linear-gradient(135deg, ${G}, ${G_DIM})` }}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: "Total Alerts",  value: items.length,       icon: Boxes,         color: G_DIM,      bg: `${G}18`            },
            { label: "Out of Stock",  value: outOfStock.length,  icon: XCircle,       color: "#EF4444",  bg: "rgba(239,68,68,0.1)"  },
            { label: "Low Stock",     value: lowStock.length,    icon: AlertTriangle, color: "#F59E0B",  bg: "rgba(245,158,11,0.1)" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className={`${card} p-4 flex items-start gap-3`}>
              <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                <Icon className="h-5 w-5" style={{ color }} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{loading ? "…" : value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Out of Stock */}
        {!loading && outOfStock.length > 0 && (
          <AlertTable
            title="Out of Stock"
            subtitle="These items have zero or negative stock and need immediate attention"
            accentColor="#EF4444"
            items={outOfStock}
            onCreatePO={(item) => navigate(`/procurement/purchase-orders/new?itemId=${item.id}&itemName=${encodeURIComponent(item.item_name)}`)}
          />
        )}

        {/* Low Stock */}
        {!loading && lowStock.length > 0 && (
          <AlertTable
            title="Low Stock"
            subtitle="These items are at or below their reorder level and should be replenished"
            accentColor="#F59E0B"
            items={lowStock}
            onCreatePO={(item) => navigate(`/procurement/purchase-orders/new?itemId=${item.id}&itemName=${encodeURIComponent(item.item_name)}`)}
          />
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className={`${card} p-5 space-y-3`}>
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="h-10 rounded-xl bg-gray-100 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && items.length === 0 && (
          <div className={`${card} p-16 flex flex-col items-center justify-center gap-4`}>
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{ background: `${G}12` }}>
              <CheckCircle2 className="h-8 w-8" style={{ color: G }} />
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-gray-800">All stock levels are healthy</p>
              <p className="text-sm text-gray-400 mt-1">No items are currently below their reorder level</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

interface AlertTableProps {
  title: string;
  subtitle: string;
  accentColor: string;
  items: AlertItem[];
  onCreatePO: (item: AlertItem) => void;
}

function AlertTable({ title, subtitle, accentColor, items, onCreatePO }: AlertTableProps) {
  const G = "#C6AF4B";
  const thCls = "text-left px-4 py-3 text-[9px] font-black uppercase tracking-[0.15em] text-gray-400 bg-gray-50/80 border-b border-gray-100";
  const tdCls = "px-4 py-3 text-xs align-middle";

  const SOURCE_LABELS: Record<string, string> = {
    fabric: "Fabric", material: "Material", packaging: "Item Master",
  };

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-[0_2px_16px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }} />
      <div className="px-5 pt-4 pb-3 border-b border-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg flex items-center justify-center"
            style={{ background: `${accentColor}15`, border: `1px solid ${accentColor}30` }}>
            {accentColor === "#EF4444"
              ? <XCircle className="h-4 w-4" style={{ color: accentColor }} />
              : <AlertTriangle className="h-4 w-4" style={{ color: accentColor }} />
            }
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: G }}>ALERTS</p>
            <h3 className="text-sm font-bold text-gray-800 leading-tight">{title}</h3>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
            style={{ background: `${accentColor}15`, color: accentColor }}>
            {items.length} item{items.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
      <p className="px-5 py-2 text-xs text-gray-400">{subtitle}</p>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              {["#", "Item Name", "Code", "Type", "Current Stock", "Reorder Level", "Min Level", "Max Level", "Status", "Action"].map(h => (
                <th key={h} className={thCls}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const cur   = parseFloat(item.current_stock ?? "0");
              const reord = parseFloat(item.reorder_level ?? "0");
              const min   = parseFloat(item.minimum_level ?? "0");
              const max   = parseFloat(item.maximum_level ?? "0");
              const isOut = cur <= 0;
              return (
                <tr key={item.id}
                  className={`border-b border-gray-50 transition-colors ${idx % 2 === 0 ? "" : "bg-gray-50/40"}`}
                  style={{ borderLeft: `3px solid ${isOut ? "#EF444430" : "#F59E0B30"}` }}>
                  <td className={tdCls}>
                    <span className="text-xs text-gray-400 font-mono">{idx + 1}</span>
                  </td>
                  <td className={tdCls}>
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: isOut ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)" }}>
                        <Package className="h-3.5 w-3.5" style={{ color: isOut ? "#EF4444" : "#F59E0B" }} />
                      </div>
                      <span className="font-medium text-gray-900 leading-snug">{item.item_name}</span>
                    </div>
                  </td>
                  <td className={tdCls}>
                    <span className="font-mono text-xs text-gray-500">{item.item_code ?? "—"}</span>
                  </td>
                  <td className={tdCls}>
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">
                      {SOURCE_LABELS[item.source_type] ?? item.source_type}
                    </span>
                  </td>
                  <td className={tdCls}>
                    <span className="font-mono font-bold text-sm" style={{ color: isOut ? "#EF4444" : "#F59E0B" }}>
                      {cur} <span className="text-[10px] font-normal text-gray-400">{item.unit_type ?? ""}</span>
                    </span>
                  </td>
                  <td className={tdCls}>
                    <span className="font-mono text-gray-700">{reord > 0 ? reord : "—"}</span>
                  </td>
                  <td className={tdCls}>
                    <span className="font-mono text-gray-500">{min > 0 ? min : "—"}</span>
                  </td>
                  <td className={tdCls}>
                    <span className="font-mono text-gray-500">{max > 0 ? max : "—"}</span>
                  </td>
                  <td className={tdCls}>
                    {isOut ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                        <XCircle className="h-3 w-3" /> Out of Stock
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                        <AlertTriangle className="h-3 w-3" /> Low Stock
                      </span>
                    )}
                  </td>
                  <td className={tdCls}>
                    <button onClick={() => onCreatePO(item)}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap"
                      style={{ borderColor: "#FECACA", color: "#DC2626", background: "rgba(239,68,68,0.04)" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.1)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.04)"; }}>
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
  );
}
