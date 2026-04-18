import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Search, Filter, RefreshCw, Package, AlertTriangle,
  CheckCircle2, XCircle, ChevronUp, ChevronDown,
  Edit2, X, ChevronLeft, ChevronRight, Boxes,
} from "lucide-react";
import { useGetMe, getGetMeQueryKey, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import TopNavbar from "@/components/layout/TopNavbar";
import { useToast } from "@/hooks/use-toast";

const G       = "#C6AF4B";
const G_DIM   = "#A8943E";
const SLATE   = "#3B3F5C";

const card = "rounded-2xl bg-white border border-[#C6AF4B]/15 shadow-[0_2px_16px_rgba(198,175,75,0.12),0_1px_3px_rgba(0,0,0,0.06)]";

interface InventoryItem {
  id: number;
  source_type: string;
  source_label: string;
  source_id: number;
  item_name: string;
  item_code: string;
  category: string | null;
  department: string | null;
  warehouse_location: string | null;
  unit_type: string | null;
  current_stock: string;
  style_reserved_qty: string;
  swatch_reserved_qty: string;
  available_stock: string;
  average_price: string;
  last_purchase_price: string;
  minimum_level: string;
  reorder_level: string;
  maximum_level: string;
  preferred_vendor: string | null;
  last_updated_at: string;
}

interface SummaryData {
  total_items: string;
  in_stock: string;
  out_of_stock: string;
  low_stock: string;
  total_current_stock: string;
  total_available_stock: string;
  fabric_count: string;
  material_count: string;
  packaging_count: string;
}

interface FilterOptions {
  categories: string[];
  departments: string[];
  locations: string[];
}

interface StockModalState {
  item: InventoryItem | null;
  open: boolean;
}

const SOURCE_COLORS: Record<string, { color: string; bg: string }> = {
  fabric:    { color: "#6366F1", bg: "rgba(99,102,241,0.1)"  },
  material:  { color: "#0EA5E9", bg: "rgba(14,165,233,0.1)"  },
  packaging: { color: "#F59E0B", bg: "rgba(245,158,11,0.1)"  },
};

function fmt(val: string | null | undefined, decimals = 2) {
  const n = parseFloat(val ?? "0");
  if (isNaN(n)) return "0";
  return n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtQty(val: string | null | undefined) {
  const n = parseFloat(val ?? "0");
  if (isNaN(n)) return "0";
  return n % 1 === 0 ? n.toLocaleString("en-IN") : n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}

function StockBadge({ item }: { item: InventoryItem }) {
  const avail = parseFloat(item.available_stock ?? "0");
  const reorder = parseFloat(item.reorder_level ?? "0");
  if (avail <= 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600">
        <XCircle className="h-3 w-3" /> Out of Stock
      </span>
    );
  }
  if (reorder > 0 && avail <= reorder) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
        <AlertTriangle className="h-3 w-3" /> Low Stock
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
      <CheckCircle2 className="h-3 w-3" /> In Stock
    </span>
  );
}

function SortIcon({ col, sort, order }: { col: string; sort: string; order: string }) {
  if (sort !== col) return <ChevronUp className="h-3 w-3 opacity-20" />;
  return order === "asc" ? <ChevronUp className="h-3.5 w-3.5" style={{ color: G }} /> : <ChevronDown className="h-3.5 w-3.5" style={{ color: G }} />;
}

export default function InventoryStockList() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const token = localStorage.getItem("zarierp_token");

  const { data: user, isLoading: userLoading, isError } = useGetMe({
    query: { enabled: !!token, queryKey: getGetMeQueryKey(), retry: false },
  });
  const logoutMutation = useLogout();

  const isAdmin = (user as { role?: string } | undefined)?.role === "admin";

  const [items, setItems]     = useState<InventoryItem[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({ categories: [], departments: [], locations: [] });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const limit                 = 50;

  const [search,      setSearch]      = useState("");
  const [category,    setCategory]    = useState("all");
  const [department,  setDepartment]  = useState("all");
  const [location,    setLocation]    = useState("all");
  const [stockLevel,  setStockLevel]  = useState("all");
  const [sourceType,  setSourceType]  = useState("all");
  const [sort,        setSort]        = useState("item_name");
  const [order,       setOrder]       = useState<"asc" | "desc">("asc");

  const [stockModal, setStockModal] = useState<StockModalState>({ item: null, open: false });
  const [stockForm, setStockForm]   = useState({
    currentStock: "",
    averagePrice: "",
    lastPurchasePrice: "",
    warehouseLocation: "",
    department: "",
    minimumLevel: "",
    reorderLevel: "",
    maximumLevel: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const buildQs = useCallback(() => {
    const p = new URLSearchParams({
      search, category, department, location, stockLevel, sourceType,
      sort, order, page: String(page), limit: String(limit),
    });
    return p.toString();
  }, [search, category, department, location, stockLevel, sourceType, sort, order, page]);

  const loadData = useCallback((bust = false) => {
    if (!token) return;
    setLoading(true);
    const ts = bust ? `&_t=${Date.now()}` : "";
    Promise.all([
      customFetch(`/api/inventory/items?${buildQs()}${ts}`),
      customFetch(`/api/inventory/summary${bust ? `?_t=${Date.now()}` : ""}`),
      customFetch(`/api/inventory/filters${bust ? `?_t=${Date.now()}` : ""}`),
    ])
      .then(([itemsRes, summaryRes, filtersRes]) => {
        const ir = itemsRes as { data: InventoryItem[]; total: number };
        setItems(ir.data);
        setTotal(ir.total);
        setSummary(summaryRes as SummaryData);
        setFilters(filtersRes as FilterOptions);
      })
      .catch(() => toast({ title: "Failed to load inventory", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [token, buildQs, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => { if (isError) navigate("/login"); }, [isError, navigate]);

  const toggleSort = (col: string) => {
    if (sort === col) setOrder(o => o === "asc" ? "desc" : "asc");
    else { setSort(col); setOrder("asc"); }
    setPage(1);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await customFetch("/api/inventory/sync", { method: "POST" }) as { message: string };
      toast({ title: res.message });
      loadData(true);
    } catch {
      toast({ title: "Sync failed", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const openStockModal = (item: InventoryItem) => {
    setStockForm({
      currentStock: item.current_stock ?? "0",
      averagePrice: item.average_price ?? "0",
      lastPurchasePrice: item.last_purchase_price ?? "0",
      warehouseLocation: item.warehouse_location ?? "",
      department: item.department ?? "",
      minimumLevel: item.minimum_level ?? "0",
      reorderLevel: item.reorder_level ?? "0",
      maximumLevel: item.maximum_level ?? "0",
    });
    setStockModal({ item, open: true });
  };

  const handleStockSubmit = async () => {
    if (!stockModal.item) return;
    setSubmitting(true);
    try {
      await customFetch(`/api/inventory/items/${stockModal.item.id}/stock`, {
        method: "PUT",
        body: JSON.stringify(stockForm),
      });
      toast({ title: "Stock updated successfully" });
      setStockModal({ item: null, open: false });
      loadData(true);
    } catch {
      toast({ title: "Failed to update stock", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const clearFilters = () => {
    setSearch(""); setCategory("all"); setDepartment("all"); setLocation("all");
    setStockLevel("all"); setSourceType("all"); setPage(1);
  };
  const hasFilters = search || category !== "all" || department !== "all" || location !== "all" || stockLevel !== "all" || sourceType !== "all";

  const totalPages = Math.ceil(total / limit);

  const handleLogout = () => logoutMutation.mutate(undefined, { onSuccess: () => { queryClient.clear(); navigate("/login"); } });

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #FAFAF7 0%, #F5F2E8 100%)" }}>
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-[#C6AF4B] border-t-transparent" />
      </div>
    );
  }

  const SummaryCard = ({ label, value, icon: Icon, color, sub }: { label: string; value: string | number; icon: React.ElementType; color: string; sub?: string }) => (
    <div className={`${card} p-5 flex items-start gap-4`}>
      <div className="flex-shrink-0 h-11 w-11 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold mt-0.5" style={{ color: SLATE }}>{value}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );

  const thCls = "px-3 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide select-none whitespace-nowrap";
  const tdCls = "px-3 py-3 text-sm text-gray-800 whitespace-nowrap";

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #FAFAF7 0%, #F5F2E8 100%)" }}>
      <TopNavbar
        username={(user as { username?: string } | undefined)?.username ?? ""}
        role={(user as { role?: string } | undefined)?.role ?? ""}
        onLogout={handleLogout}
        isLoggingOut={logoutMutation.isPending}
      />

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Boxes className="h-5 w-5" style={{ color: G }} />
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: G }}>Inventory Management</span>
            </div>
            <h1 className="text-2xl font-bold" style={{ color: SLATE }}>Item Stock Listing</h1>
            <p className="text-sm text-gray-500 mt-0.5">Track stock across Fabric, Material, and Item Master</p>
          </div>
          {isAdmin && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow hover:shadow-md active:scale-95"
              style={{ background: `linear-gradient(135deg, ${G}, ${G_DIM})`, color: "white" }}
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync from Masters"}
            </button>
          )}
        </div>

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <SummaryCard label="Total Items"   value={summary.total_items}   icon={Boxes}          color={SLATE} />
            <SummaryCard label="In Stock"      value={summary.in_stock}      icon={CheckCircle2}   color="#10B981" />
            <SummaryCard label="Low Stock"     value={summary.low_stock}     icon={AlertTriangle}  color="#F59E0B" />
            <SummaryCard label="Out of Stock"  value={summary.out_of_stock}  icon={XCircle}        color="#EF4444" />
            <SummaryCard label="Fabrics"       value={summary.fabric_count}  icon={Package}        color="#6366F1" sub="source items" />
            <SummaryCard label="Materials"     value={parseInt(summary.material_count)+parseInt(summary.packaging_count)} icon={Package} color="#0EA5E9" sub="mat. + item master" />
          </div>
        )}

        {/* Filters */}
        <div className={`${card} p-4`}>
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search item name or code…"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30"
              />
            </div>

            <select value={sourceType} onChange={e => { setSourceType(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30">
              <option value="all">All Sources</option>
              <option value="fabric">Fabric</option>
              <option value="material">Material</option>
              <option value="packaging">Item Master</option>
            </select>

            <select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30">
              <option value="all">All Categories</option>
              {filters.categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <select value={department} onChange={e => { setDepartment(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30">
              <option value="all">All Departments</option>
              {filters.departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>

            <select value={location} onChange={e => { setLocation(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30">
              <option value="all">All Locations</option>
              {filters.locations.map(l => <option key={l} value={l}>{l}</option>)}
            </select>

            <select value={stockLevel} onChange={e => { setStockLevel(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30">
              <option value="all">All Stock Levels</option>
              <option value="in-stock">In Stock</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
            </select>

            {hasFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700">
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}

            <div className="ml-auto flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <span className="text-xs text-gray-500">{total} items</span>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className={`${card} overflow-hidden`}>
          <div className="h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${G}, transparent)` }} />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100" style={{ background: "linear-gradient(135deg,rgba(198,175,75,0.06),rgba(198,175,75,0.03))" }}>
                  <th className={thCls} onClick={() => toggleSort("item_name")} style={{ cursor: "pointer" }}>
                    <span className="flex items-center gap-1">Item Name <SortIcon col="item_name" sort={sort} order={order} /></span>
                  </th>
                  <th className={thCls}>Code</th>
                  <th className={thCls} onClick={() => toggleSort("category")} style={{ cursor: "pointer" }}>
                    <span className="flex items-center gap-1">Category <SortIcon col="category" sort={sort} order={order} /></span>
                  </th>
                  <th className={thCls}>Dept</th>
                  <th className={thCls}>Location</th>
                  <th className={thCls}>Unit</th>
                  <th className={`${thCls} text-right`} onClick={() => toggleSort("current_stock")} style={{ cursor: "pointer" }}>
                    <span className="flex items-center justify-end gap-1">Current Stock <SortIcon col="current_stock" sort={sort} order={order} /></span>
                  </th>
                  <th className={`${thCls} text-right`}>Style Res.</th>
                  <th className={`${thCls} text-right`}>Swatch Res.</th>
                  <th className={`${thCls} text-right`} onClick={() => toggleSort("available_stock")} style={{ cursor: "pointer" }}>
                    <span className="flex items-center justify-end gap-1">Available <SortIcon col="available_stock" sort={sort} order={order} /></span>
                  </th>
                  <th className={`${thCls} text-right`}>Avg Price</th>
                  <th className={`${thCls} text-right`}>Last Price</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls} onClick={() => toggleSort("last_updated_at")} style={{ cursor: "pointer" }}>
                    <span className="flex items-center gap-1">Updated <SortIcon col="last_updated_at" sort={sort} order={order} /></span>
                  </th>
                  {isAdmin && <th className={thCls}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={isAdmin ? 15 : 14} className="text-center py-16 text-gray-400">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin h-5 w-5 rounded-full border-2 border-[#C6AF4B] border-t-transparent" />
                        Loading inventory…
                      </div>
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 15 : 14} className="text-center py-20">
                      <Boxes className="h-12 w-12 mx-auto text-gray-200 mb-3" />
                      <p className="text-gray-500 font-medium">No inventory items found</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {hasFilters ? "Try clearing your filters" : isAdmin ? 'Click "Sync from Masters" to import all existing items' : "No items have been synced yet"}
                      </p>
                    </td>
                  </tr>
                ) : items.map((item, idx) => {
                  const src = SOURCE_COLORS[item.source_type] ?? { color: G, bg: `${G}18` };
                  const avail = parseFloat(item.available_stock ?? "0");
                  const availColor = avail <= 0 ? "#EF4444" : avail <= parseFloat(item.reorder_level ?? "0") && parseFloat(item.reorder_level ?? "0") > 0 ? "#F59E0B" : "#10B981";
                  return (
                    <tr key={item.id}
                      className={`border-b border-gray-50 hover:bg-[#C6AF4B]/[0.025] transition-colors ${idx % 2 === 0 ? "" : "bg-gray-50/40"}`}>
                      <td className={tdCls}>
                        <div className="flex flex-col gap-0.5 max-w-[220px]">
                          <span className="font-medium text-gray-900 leading-snug">{item.item_name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full w-fit font-medium"
                            style={{ color: src.color, background: src.bg }}>{item.source_label}</span>
                        </div>
                      </td>
                      <td className={tdCls}><span className="font-mono text-xs text-gray-600">{item.item_code}</span></td>
                      <td className={tdCls}><span className="text-xs text-gray-600">{item.category ?? "—"}</span></td>
                      <td className={tdCls}><span className="text-xs text-gray-600">{item.department ?? "—"}</span></td>
                      <td className={tdCls}><span className="text-xs text-gray-600">{item.warehouse_location ?? "—"}</span></td>
                      <td className={tdCls}><span className="text-xs text-gray-500">{item.unit_type ?? "—"}</span></td>
                      <td className={`${tdCls} text-right font-mono`}>{fmtQty(item.current_stock)}</td>
                      <td className={`${tdCls} text-right font-mono text-blue-600`}>{fmtQty(item.style_reserved_qty)}</td>
                      <td className={`${tdCls} text-right font-mono text-purple-600`}>{fmtQty(item.swatch_reserved_qty)}</td>
                      <td className={`${tdCls} text-right font-mono font-semibold`} style={{ color: availColor }}>{fmtQty(item.available_stock)}</td>
                      <td className={`${tdCls} text-right`}>
                        <span className="text-xs">₹{fmt(item.average_price)}</span>
                      </td>
                      <td className={`${tdCls} text-right`}>
                        <span className="text-xs">₹{fmt(item.last_purchase_price)}</span>
                      </td>
                      <td className={tdCls}><StockBadge item={item} /></td>
                      <td className={tdCls}>
                        <span className="text-xs text-gray-400">
                          {item.last_updated_at ? new Date(item.last_updated_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) : "—"}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className={tdCls}>
                          <button onClick={() => openStockModal(item)}
                            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-[#C6AF4B]/30 text-[#A8943E] hover:bg-[#C6AF4B]/10 transition-colors">
                            <Edit2 className="h-3 w-3" /> Stock
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <span className="text-xs text-gray-500">
                Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total} items
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors">
                  <ChevronLeft className="h-4 w-4 text-gray-600" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pg = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                  return (
                    <button key={pg} onClick={() => setPage(pg)}
                      className={`min-w-[32px] h-8 rounded-lg text-xs font-medium transition-colors ${pg === page ? "text-white" : "text-gray-600 hover:bg-gray-100"}`}
                      style={pg === page ? { background: G } : {}}>
                      {pg}
                    </button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors">
                  <ChevronRight className="h-4 w-4 text-gray-600" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Opening Stock Modal */}
      {stockModal.open && stockModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`${card} w-full max-w-lg`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold" style={{ color: SLATE }}>Update Stock</h2>
                <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[320px]">{stockModal.item.item_name}</p>
              </div>
              <button onClick={() => setStockModal({ item: null, open: false })} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            <div className="p-5 grid grid-cols-2 gap-4">
              {[
                { label: "Opening / Current Stock *", key: "currentStock", placeholder: "0.000" },
                { label: "Average Price (₹)", key: "averagePrice", placeholder: "0.00" },
                { label: "Last Purchase Price (₹)", key: "lastPurchasePrice", placeholder: "0.00" },
                { label: "Warehouse Location", key: "warehouseLocation", placeholder: "e.g. Rack A-12" },
                { label: "Department", key: "department", placeholder: "e.g. Embroidery" },
                { label: "Minimum Level", key: "minimumLevel", placeholder: "0" },
                { label: "Reorder Level", key: "reorderLevel", placeholder: "0" },
                { label: "Maximum Level", key: "maximumLevel", placeholder: "0" },
              ].map(({ label, key, placeholder }) => (
                <div key={key} className={key === "warehouseLocation" || key === "department" ? "col-span-2" : ""}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type="text"
                    placeholder={placeholder}
                    value={(stockForm as Record<string, string>)[key]}
                    onChange={e => setStockForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30"
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between px-5 pb-5 gap-3">
              <p className="text-[11px] text-gray-400">Available = Current − Style Reserved − Swatch Reserved</p>
              <div className="flex gap-2">
                <button onClick={() => setStockModal({ item: null, open: false })}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={handleStockSubmit} disabled={submitting || !stockForm.currentStock}
                  className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                  style={{ background: `linear-gradient(135deg, ${G}, ${G_DIM})` }}>
                  {submitting ? "Saving…" : "Update Stock"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
