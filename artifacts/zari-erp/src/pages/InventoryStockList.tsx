import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Search, Filter, RefreshCw, Package, AlertTriangle,
  CheckCircle2, XCircle, ChevronUp, ChevronDown,
  Edit2, X, ChevronLeft, ChevronRight, Boxes,
  Clock, CalendarRange, ArrowUpCircle, ArrowDownCircle,
  MinusCircle, Info, BookOpen, ZoomIn,
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
const thCls = "px-3 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide whitespace-nowrap";
const tdCls = "px-3 py-3 text-sm text-gray-900";

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
  images: Array<{ id: string; name: string; data: string; size: number }> | null;
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

interface StockLog {
  id: number;
  inventory_item_id: number;
  action_type: string;
  quantity_before: string;
  quantity_after: string;
  quantity_delta: string;
  reference_type: string | null;
  notes: string | null;
  created_by_name: string | null;
  created_at: string;
}

interface SwatchOrderRow {
  id: number;
  order_code: string;
  swatch_name: string;
  client_name: string;
  order_status: string;
  quantity: string;
  unit_type: string;
  fabric_role: string;
}

interface ReservationData {
  item_name: string;
  source_type: string;
  style_reserved_qty: string;
  swatch_reserved_qty: string;
  swatch_orders: SwatchOrderRow[];
  style_orders: unknown[];
}

const SOURCE_COLORS: Record<string, { color: string; bg: string }> = {
  fabric:    { color: "#6366F1", bg: "rgba(99,102,241,0.1)"  },
  material:  { color: "#0EA5E9", bg: "rgba(14,165,233,0.1)"  },
  packaging: { color: "#F59E0B", bg: "rgba(245,158,11,0.1)"  },
};

const LOG_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  opening:        { label: "Opening Stock",   color: "#10B981", icon: Package },
  adjustment_in:  { label: "Stock Added",     color: "#3B82F6", icon: ArrowUpCircle },
  adjustment_out: { label: "Stock Reduced",   color: "#EF4444", icon: ArrowDownCircle },
  receipt:        { label: "Purchase Receipt",color: "#8B5CF6", icon: ArrowUpCircle },
  consumed:       { label: "Consumed",        color: "#F59E0B", icon: ArrowDownCircle },
  sync:           { label: "Sync from Master",color: "#6B7280", icon: RefreshCw },
  manual:         { label: "Manual Adjust",   color: "#6B7280", icon: MinusCircle },
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

function fmtDt(val: string) {
  return new Date(val).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function fmtDateShort(val: string) {
  return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
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

function StatusPill({ status }: { status: string }) {
  const s = status?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    pending: "bg-yellow-50 text-yellow-700",
    approved: "bg-blue-50 text-blue-700",
    "in progress": "bg-purple-50 text-purple-700",
    completed: "bg-emerald-50 text-emerald-700",
    cancelled: "bg-red-50 text-red-700",
  };
  const cls = map[s] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>
      {status}
    </span>
  );
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
  const limit                 = 10;

  const [search,      setSearch]      = useState("");
  const [category,    setCategory]    = useState("all");
  const [department,  setDepartment]  = useState("all");
  const [location,    setLocation]    = useState("all");
  const [stockLevel,  setStockLevel]  = useState("all");
  const [sourceType,  setSourceType]  = useState("all");
  const [fromDate,    setFromDate]    = useState("");
  const [toDate,      setToDate]      = useState("");
  const [sort,        setSort]        = useState("item_name");
  const [order,       setOrder]       = useState<"asc" | "desc">("asc");

  const [stockModal, setStockModal] = useState<{ item: InventoryItem | null; open: boolean }>({ item: null, open: false });
  const [stockForm, setStockForm]   = useState({
    currentStock: "", stockChange: "", averagePrice: "", lastPurchasePrice: "",
    warehouseLocation: "", department: "", minimumLevel: "",
    reorderLevel: "", maximumLevel: "", notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const [logModal, setLogModal]   = useState<{ item: InventoryItem | null; open: boolean; logs: StockLog[]; loading: boolean }>({
    item: null, open: false, logs: [], loading: false,
  });
  const [resModal, setResModal]   = useState<{ item: InventoryItem | null; open: boolean; data: ReservationData | null; loading: boolean; tab: "swatch" | "style" }>({
    item: null, open: false, data: null, loading: false, tab: "swatch",
  });

  const buildQs = useCallback(() => {
    const p = new URLSearchParams({ search, category, department, location, stockLevel, sourceType, sort, order, page: String(page), limit: String(limit) });
    if (fromDate) p.set("fromDate", fromDate);
    if (toDate) p.set("toDate", toDate);
    return p.toString();
  }, [search, category, department, location, stockLevel, sourceType, sort, order, page, fromDate, toDate]);

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
      stockChange: "",
      averagePrice: item.average_price ?? "0",
      lastPurchasePrice: item.last_purchase_price ?? "0",
      warehouseLocation: item.warehouse_location ?? "",
      department: item.department ?? "",
      minimumLevel: item.minimum_level ?? "0",
      reorderLevel: item.reorder_level ?? "0",
      maximumLevel: item.maximum_level ?? "0",
      notes: "",
    });
    setStockModal({ item, open: true });
  };

  const handleStockSubmit = async () => {
    if (!stockModal.item) return;
    setSubmitting(true);
    try {
      const base   = parseFloat(stockForm.currentStock) || 0;
      const delta  = parseFloat(stockForm.stockChange)  || 0;
      const newQty = (base + delta).toFixed(3);
      await customFetch(`/api/inventory/items/${stockModal.item.id}/stock`, {
        method: "PUT",
        body: JSON.stringify({ ...stockForm, currentStock: newQty }),
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

  const openLogModal = async (item: InventoryItem) => {
    setLogModal({ item, open: true, logs: [], loading: true });
    try {
      const logs = await customFetch(`/api/inventory/items/${item.id}/logs`) as StockLog[];
      setLogModal(m => ({ ...m, logs, loading: false }));
    } catch {
      setLogModal(m => ({ ...m, loading: false }));
      toast({ title: "Failed to load stock logs", variant: "destructive" });
    }
  };

  const openResModal = async (item: InventoryItem, tab: "swatch" | "style") => {
    setResModal({ item, open: true, data: null, loading: true, tab });
    try {
      const data = await customFetch(`/api/inventory/items/${item.id}/reservations`) as ReservationData;
      setResModal(m => ({ ...m, data, loading: false }));
    } catch {
      setResModal(m => ({ ...m, loading: false }));
      toast({ title: "Failed to load reservations", variant: "destructive" });
    }
  };

  const clearFilters = () => {
    setSearch(""); setCategory("all"); setDepartment("all"); setLocation("all");
    setStockLevel("all"); setSourceType("all"); setFromDate(""); setToDate(""); setPage(1);
  };
  const hasFilters = search || category !== "all" || department !== "all" || location !== "all" || stockLevel !== "all" || sourceType !== "all" || fromDate || toDate;

  const totalPages = Math.ceil(total / limit);

  const handleLogout = () => logoutMutation.mutate(undefined, { onSuccess: () => { queryClient.clear(); navigate("/login"); } });

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #FAFAF7 0%, #F5F2E8 100%)" }}>
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-[#C6AF4B] border-t-transparent" />
      </div>
    );
  }

  const [lightboxImages, setLightboxImages] = useState<Array<{ id: string; name: string; data: string; size: number }> | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState(0);
  const colSpan = isAdmin ? 18 : 17;

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #FAFAF7 0%, #F5F2E8 100%)" }}>
      <TopNavbar
        username={(user as { name?: string } | undefined)?.name ?? ""}
        role={(user as { role?: string } | undefined)?.role ?? ""}
        onLogout={handleLogout}
        isLoggingOut={logoutMutation.isPending}
      />

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Item Stock Listing</h1>
            <p className="text-sm text-gray-700 mt-0.5">Track and manage all inventory across fabrics, materials & item master</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
              <CalendarRange className="h-4 w-4 text-gray-500" />
              <input
                type="date"
                value={fromDate}
                onChange={e => { setFromDate(e.target.value); setPage(1); }}
                className="text-sm text-gray-900 border-0 outline-none bg-transparent w-32"
                placeholder="From"
              />
              <span className="text-gray-400 text-xs">—</span>
              <input
                type="date"
                value={toDate}
                onChange={e => { setToDate(e.target.value); setPage(1); }}
                className="text-sm text-gray-900 border-0 outline-none bg-transparent w-32"
                placeholder="To"
              />
              {(fromDate || toDate) && (
                <button onClick={() => { setFromDate(""); setToDate(""); setPage(1); }} className="ml-1 text-gray-400 hover:text-red-500">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {isAdmin && (
              <button onClick={handleSync} disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
                style={{ background: `linear-gradient(135deg, ${G}, ${G_DIM})` }}>
                <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing…" : "Sync from Masters"}
              </button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: "Total Items",    value: summary.total_items,    icon: Boxes,          color: SLATE },
              { label: "In Stock",       value: summary.in_stock,       icon: CheckCircle2,   color: "#10B981" },
              { label: "Low Stock",      value: summary.low_stock,      icon: AlertTriangle,  color: "#F59E0B" },
              { label: "Out of Stock",   value: summary.out_of_stock,   icon: XCircle,        color: "#EF4444" },
              { label: "Fabrics",        value: summary.fabric_count,   icon: Package,        color: "#6366F1", sub: `${summary.material_count} mat` },
              { label: "Item Masters",   value: summary.packaging_count,icon: Package,        color: "#F59E0B" },
            ].map(({ label, value, icon: Icon, color, sub }) => (
              <div key={label} className={`${card} p-4 flex items-start gap-3`}>
                <div className="flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
                  <Icon className="h-5 w-5" style={{ color }} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                  <p className="text-xs text-gray-700 mt-0.5">{label}</p>
                  {sub && <p className="text-[10px] text-gray-500">{sub}</p>}
                </div>
              </div>
            ))}
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
                className="w-full pl-9 pr-3 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30"
              />
            </div>

            {[
              { value: sourceType, onChange: (v: string) => { setSourceType(v); setPage(1); }, opts: [["all","All Sources"],["fabric","Fabric"],["material","Material"],["packaging","Item Master"]] },
              { value: category,   onChange: (v: string) => { setCategory(v); setPage(1); },   opts: [["all","All Categories"], ...filters.categories.map(c => [c,c])] },
              { value: department, onChange: (v: string) => { setDepartment(v); setPage(1); }, opts: [["all","All Departments"], ...filters.departments.map(d => [d,d])] },
              { value: location,   onChange: (v: string) => { setLocation(v); setPage(1); },   opts: [["all","All Locations"], ...filters.locations.map(l => [l,l])] },
              { value: stockLevel, onChange: (v: string) => { setStockLevel(v); setPage(1); }, opts: [["all","All Stock Levels"],["in-stock","In Stock"],["low","Low Stock"],["out","Out of Stock"]] },
            ].map((sel, i) => (
              <select key={i} value={sel.value} onChange={e => sel.onChange(e.target.value)}
                className="px-3 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30">
                {sel.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            ))}

            {hasFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700">
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <span className="text-xs text-gray-700">{total} items</span>
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
                  <th className={thCls}>#</th>
                  <th className={thCls} onClick={() => toggleSort("item_name")} style={{ cursor: "pointer" }}>
                    <span className="flex items-center gap-1">Item Name <SortIcon col="item_name" sort={sort} order={order} /></span>
                  </th>
                  <th className={thCls}>Image</th>
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
                  {isAdmin && <th className={thCls}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={colSpan} className="text-center py-16 text-gray-700">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin h-5 w-5 rounded-full border-2 border-[#C6AF4B] border-t-transparent" />
                        Loading inventory…
                      </div>
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan} className="text-center py-20">
                      <Boxes className="h-12 w-12 mx-auto text-gray-200 mb-3" />
                      <p className="text-gray-700 font-medium">No inventory items found</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {hasFilters ? "Try clearing your filters" : isAdmin ? 'Click "Sync from Masters" to import all existing items' : "No items have been synced yet"}
                      </p>
                    </td>
                  </tr>
                ) : items.map((item, idx) => {
                  const src = SOURCE_COLORS[item.source_type] ?? { color: G, bg: `${G}18` };
                  const avail = parseFloat(item.available_stock ?? "0");
                  const reorder = parseFloat(item.reorder_level ?? "0");
                  const availColor = avail <= 0 ? "#EF4444" : reorder > 0 && avail <= reorder ? "#F59E0B" : "#10B981";
                  const styleRes = parseFloat(item.style_reserved_qty ?? "0");
                  const swatchRes = parseFloat(item.swatch_reserved_qty ?? "0");
                  const srNo = (page - 1) * limit + idx + 1;
                  return (
                    <tr key={item.id}
                      className={`border-b border-gray-50 hover:bg-[#C6AF4B]/[0.025] transition-colors ${idx % 2 === 0 ? "" : "bg-gray-50/40"}`}>
                      <td className={tdCls}>
                        <span className="text-xs text-gray-500 font-mono">{srNo}</span>
                      </td>
                      <td className={tdCls}>
                        <div className="flex flex-col gap-0.5 max-w-[220px]">
                          <span className="font-medium text-gray-900 leading-snug">{item.item_name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full w-fit font-medium"
                            style={{ color: src.color, background: src.bg }}>{item.source_label}</span>
                        </div>
                      </td>
                      <td className={tdCls}>
                        {item.images && item.images.length > 0 ? (
                          <button type="button" onClick={() => { setLightboxImages(item.images!); setLightboxIdx(0); }}
                            className="relative w-9 h-9 rounded-lg overflow-hidden border border-gray-200 hover:border-[#C6AF4B] transition-colors">
                            <img src={item.images[0].data} alt="" className="w-full h-full object-cover" />
                            {item.images.length > 1 && (
                              <span className="absolute bottom-0 right-0 text-[9px] font-bold bg-black/60 text-white px-0.5 rounded-tl-md">+{item.images.length - 1}</span>
                            )}
                          </button>
                        ) : (
                          <div className="w-9 h-9 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center">
                            <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 20.25h18a.75.75 0 00.75-.75V5.25A.75.75 0 0021 4.5H3A.75.75 0 002.25 5.25v14.25c0 .414.336.75.75.75zM12 10.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                            </svg>
                          </div>
                        )}
                      </td>
                      <td className={tdCls}><span className="font-mono text-xs text-gray-900">{item.item_code}</span></td>
                      <td className={tdCls}><span className="text-xs text-gray-900">{item.category ?? "—"}</span></td>
                      <td className={tdCls}><span className="text-xs text-gray-900">{item.department ?? "—"}</span></td>
                      <td className={tdCls}><span className="text-xs text-gray-900">{item.warehouse_location ?? "—"}</span></td>
                      <td className={tdCls}><span className="text-xs text-gray-700">{item.unit_type ?? "—"}</span></td>
                      <td className={`${tdCls} text-right font-mono text-gray-900`}>{fmtQty(item.current_stock)}</td>
                      <td className={`${tdCls} text-right`}>
                        <button
                          onClick={() => openResModal(item, "style")}
                          className={`font-mono text-sm transition-colors ${styleRes > 0 ? "text-blue-700 font-semibold hover:underline cursor-pointer" : "text-gray-500 cursor-default"}`}
                          disabled={styleRes === 0}
                        >
                          {fmtQty(item.style_reserved_qty)}
                        </button>
                      </td>
                      <td className={`${tdCls} text-right`}>
                        <button
                          onClick={() => openResModal(item, "swatch")}
                          className={`font-mono text-sm transition-colors ${swatchRes > 0 ? "text-purple-700 font-semibold hover:underline cursor-pointer" : "text-gray-500 cursor-default"}`}
                          disabled={swatchRes === 0}
                        >
                          {fmtQty(item.swatch_reserved_qty)}
                        </button>
                      </td>
                      <td className={`${tdCls} text-right font-mono font-semibold`} style={{ color: availColor }}>{fmtQty(item.available_stock)}</td>
                      <td className={`${tdCls} text-right`}>
                        <span className="text-sm text-gray-900">₹{fmt(item.average_price)}</span>
                      </td>
                      <td className={`${tdCls} text-right`}>
                        <span className="text-sm text-gray-900">₹{fmt(item.last_purchase_price)}</span>
                      </td>
                      <td className={tdCls}><StockBadge item={item} /></td>
                      <td className={tdCls}>
                        <span className="text-xs text-gray-700">
                          {item.last_updated_at ? fmtDateShort(item.last_updated_at) : "—"}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className={tdCls}>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => openStockModal(item)}
                              className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border border-[#C6AF4B]/30 text-[#A8943E] hover:bg-[#C6AF4B]/10 transition-colors">
                              <Edit2 className="h-3 w-3" /> Stock
                            </button>
                            <button onClick={() => openLogModal(item)}
                              className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors">
                              <Clock className="h-3 w-3" /> Log
                            </button>
                            <button onClick={() => navigate(`/inventory/ledger?itemId=${item.id}&itemName=${encodeURIComponent(item.item_name)}`)}
                              className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors">
                              <BookOpen className="h-3 w-3" /> Ledger
                            </button>
                          </div>
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
              <span className="text-xs text-gray-700">
                Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total} items
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors">
                  <ChevronLeft className="h-4 w-4 text-gray-700" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pg = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                  return (
                    <button key={pg} onClick={() => setPage(pg)}
                      className={`min-w-[32px] h-8 rounded-lg text-xs font-medium transition-colors ${pg === page ? "text-white" : "text-gray-700 hover:bg-gray-100"}`}
                      style={pg === page ? { background: G } : {}}>
                      {pg}
                    </button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors">
                  <ChevronRight className="h-4 w-4 text-gray-700" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Update Stock Modal */}
      {stockModal.open && stockModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`${card} w-full max-w-lg max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">Update Stock</h2>
                <p className="text-xs text-gray-700 mt-0.5 truncate max-w-[320px]">{stockModal.item.item_name}</p>
              </div>
              <button onClick={() => setStockModal({ item: null, open: false })} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="h-4 w-4 text-gray-700" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Stock change row */}
              {(() => {
                const base    = parseFloat(stockForm.currentStock) || 0;
                const delta   = parseFloat(stockForm.stockChange)  || 0;
                const newQty  = base + delta;
                const hasChange = stockForm.stockChange.trim() !== "";
                const isPos   = delta > 0;
                const isNeg   = delta < 0;
                return (
                  <div className="rounded-xl border border-[#C6AF4B]/30 bg-[#FDFBF2] p-3 space-y-3">
                    {/* Current + Adjustment side by side */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-900 mb-1">Current Stock</label>
                        <div className="w-full px-3 py-2 text-sm font-semibold text-gray-900 rounded-xl border border-gray-200 bg-gray-50 select-none">
                          {parseFloat(stockForm.currentStock).toFixed(3)}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-900 mb-1">Adjustment&nbsp;<span className="text-gray-400 font-normal">(+ add / − reduce)</span></label>
                        <input
                          type="number"
                          placeholder="e.g. +50 or -20"
                          value={stockForm.stockChange}
                          onChange={e => setStockForm(f => ({ ...f, stockChange: e.target.value }))}
                          className="w-full px-3 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30"
                        />
                      </div>
                    </div>
                    {/* Live preview strip */}
                    {hasChange && (
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${isPos ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : isNeg ? "bg-red-50 text-red-700 border border-red-200" : "bg-gray-50 text-gray-600 border border-gray-200"}`}>
                        <span className="text-gray-500 font-normal">{base.toFixed(3)}</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-bold text-base">{newQty.toFixed(3)}</span>
                        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-semibold ${isPos ? "bg-emerald-100 text-emerald-800" : isNeg ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-700"}`}>
                          {isPos ? `▲ +${delta.toFixed(3)}` : isNeg ? `▼ ${delta.toFixed(3)}` : "No change"}
                        </span>
                      </div>
                    )}
                    {!hasChange && (
                      <p className="text-[11px] text-gray-400 text-center">Enter an adjustment amount to preview the new stock level</p>
                    )}
                  </div>
                );
              })()}

              {/* Other fields grid */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Average Price (₹)", key: "averagePrice", placeholder: "0.00" },
                  { label: "Last Purchase Price (₹)", key: "lastPurchasePrice", placeholder: "0.00" },
                  { label: "Warehouse Location", key: "warehouseLocation", placeholder: "e.g. Rack A-12" },
                  { label: "Department", key: "department", placeholder: "e.g. Embroidery" },
                  { label: "Minimum Level", key: "minimumLevel", placeholder: "0" },
                  { label: "Reorder Level", key: "reorderLevel", placeholder: "0" },
                  { label: "Maximum Level", key: "maximumLevel", placeholder: "0" },
                ].map(({ label, key, placeholder }) => (
                  <div key={key} className={(key === "warehouseLocation" || key === "department") ? "col-span-2" : ""}>
                    <label className="block text-xs font-medium text-gray-900 mb-1">{label}</label>
                    <input
                      type="text"
                      placeholder={placeholder}
                      value={(stockForm as Record<string, string>)[key]}
                      onChange={e => setStockForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full px-3 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30"
                    />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-900 mb-1">Notes / Reason</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Opening stock entry, received from vendor…"
                  value={stockForm.notes}
                  onChange={e => setStockForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between px-5 pb-5 gap-3">
              <p className="text-[11px] text-gray-500">Available = Current − Style Res − Swatch Res</p>
              <div className="flex gap-2">
                <button onClick={() => setStockModal({ item: null, open: false })}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50">
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

      {/* Stock Log Timeline Modal */}
      {logModal.open && logModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`${card} w-full max-w-xl max-h-[85vh] flex flex-col`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-gray-900">Stock Log Timeline</h2>
                <p className="text-xs text-gray-700 mt-0.5 truncate max-w-[340px]">{logModal.item.item_name}</p>
              </div>
              <button onClick={() => setLogModal(m => ({ ...m, open: false }))} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="h-4 w-4 text-gray-700" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5">
              {logModal.loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin h-6 w-6 rounded-full border-2 border-[#C6AF4B] border-t-transparent" />
                </div>
              ) : logModal.logs.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="h-10 w-10 mx-auto text-gray-200 mb-3" />
                  <p className="text-gray-700 font-medium">No stock movements yet</p>
                  <p className="text-xs text-gray-500 mt-1">Stock changes will appear here once you update stock.</p>
                </div>
              ) : (
                <div className="relative pl-6">
                  <div className="absolute left-2.5 top-0 bottom-0 w-0.5 bg-gray-100" />
                  <div className="space-y-5">
                    {logModal.logs.map((log) => {
                      const meta = LOG_META[log.action_type] ?? LOG_META.manual;
                      const Icon = meta.icon;
                      const delta = parseFloat(log.quantity_delta ?? "0");
                      return (
                        <div key={log.id} className="relative flex gap-3">
                          <div className="absolute -left-6 top-0.5 h-5 w-5 rounded-full flex items-center justify-center z-10"
                            style={{ background: `${meta.color}18`, border: `1.5px solid ${meta.color}` }}>
                            <Icon className="h-2.5 w-2.5" style={{ color: meta.color }} />
                          </div>
                          <div className="flex-1 bg-gray-50 rounded-xl p-3 border border-gray-100">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                                {log.notes && <p className="text-xs text-gray-700 mt-0.5">{log.notes}</p>}
                              </div>
                              <span className={`text-sm font-bold ${delta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {delta >= 0 ? "+" : ""}{fmtQty(log.quantity_delta)}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 mt-1.5 text-[11px] text-gray-500">
                              <span>{fmtQty(log.quantity_before)} → <strong className="text-gray-900">{fmtQty(log.quantity_after)}</strong></span>
                              {log.created_by_name && <span>by {log.created_by_name}</span>}
                              <span className="ml-auto">{fmtDt(log.created_at)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reservations Modal */}
      {resModal.open && resModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`${card} w-full max-w-2xl max-h-[85vh] flex flex-col`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-gray-900">Reservation Details</h2>
                <p className="text-xs text-gray-700 mt-0.5 truncate max-w-[400px]">{resModal.item.item_name}</p>
              </div>
              <button onClick={() => setResModal(m => ({ ...m, open: false }))} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="h-4 w-4 text-gray-700" />
              </button>
            </div>

            {/* Summary Strip */}
            {resModal.data && (
              <div className="flex items-center gap-6 px-5 py-3 border-b border-gray-50 flex-shrink-0">
                <div className="text-center">
                  <p className="text-lg font-bold text-blue-700">{fmtQty(resModal.data.style_reserved_qty)}</p>
                  <p className="text-[11px] text-gray-700">Style Reserved</p>
                </div>
                <div className="w-px h-8 bg-gray-100" />
                <div className="text-center">
                  <p className="text-lg font-bold text-purple-700">{fmtQty(resModal.data.swatch_reserved_qty)}</p>
                  <p className="text-[11px] text-gray-700">Swatch Reserved</p>
                </div>
                <div className="w-px h-8 bg-gray-100" />
                <div className="text-center">
                  <p className="text-lg font-bold text-emerald-700">{fmtQty(resModal.item.available_stock)}</p>
                  <p className="text-[11px] text-gray-700">Available</p>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-gray-100 px-5 flex-shrink-0">
              {(["swatch", "style"] as const).map(tab => (
                <button key={tab} onClick={() => setResModal(m => ({ ...m, tab }))}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
                    resModal.tab === tab ? "border-[#C6AF4B] text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}>
                  {tab} Orders
                  {resModal.data && (
                    <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      {tab === "swatch" ? resModal.data.swatch_orders.length : resModal.data.style_orders.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto flex-1 p-5">
              {resModal.loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin h-6 w-6 rounded-full border-2 border-[#C6AF4B] border-t-transparent" />
                </div>
              ) : !resModal.data ? (
                <p className="text-center text-gray-500 py-12">No reservation data</p>
              ) : resModal.tab === "swatch" ? (
                resModal.data.swatch_orders.length === 0 ? (
                  <div className="text-center py-12">
                    <Info className="h-10 w-10 mx-auto text-gray-200 mb-3" />
                    <p className="text-gray-700 font-medium">No swatch orders linked</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {resModal.data.source_type === "fabric"
                        ? "No active swatch orders reference this fabric."
                        : "Order linkage for materials and item masters is available in the Reservations module."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {resModal.data.swatch_orders.map(order => (
                      <div key={order.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50">
                        <div>
                          <span className="font-semibold text-sm text-gray-900">{order.order_code}</span>
                          <span className="mx-2 text-gray-300">·</span>
                          <span className="text-sm text-gray-700">{order.swatch_name}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-gray-500">{order.client_name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">{order.fabric_role}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm font-semibold text-gray-900">{order.quantity} {order.unit_type}</p>
                            <p className="text-[10px] text-gray-500">Qty</p>
                          </div>
                          <StatusPill status={order.order_status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="text-center py-12">
                  <Info className="h-10 w-10 mx-auto text-gray-200 mb-3" />
                  <p className="text-gray-700 font-medium">Style order linkage coming soon</p>
                  <p className="text-xs text-gray-500 mt-1">Detailed style order reservation tracking will be available in the Reservations module.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      {lightboxImages && lightboxImages.length > 0 && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxImages(null)}>
          <div className="relative flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
            <img src={lightboxImages[lightboxIdx].data} alt={lightboxImages[lightboxIdx].name}
              className="max-w-[85vw] max-h-[80vh] rounded-2xl shadow-2xl object-contain" />
            {lightboxImages.length > 1 && (
              <div className="flex items-center gap-2">
                {lightboxImages.map((img, i) => (
                  <button key={img.id} onClick={() => setLightboxIdx(i)}
                    className={`w-10 h-10 rounded-lg overflow-hidden border-2 transition-all ${i === lightboxIdx ? "border-[#C6AF4B] scale-110" : "border-transparent opacity-60"}`}>
                    <img src={img.data} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setLightboxImages(null)}
              className="absolute -top-3 -right-3 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors">
              <X className="h-4 w-4 text-gray-700" />
            </button>
            {lightboxImages.length > 1 && lightboxIdx > 0 && (
              <button onClick={() => setLightboxIdx(i => i - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white/90 rounded-full shadow hover:bg-white transition-colors">
                <ChevronLeft className="h-5 w-5 text-gray-700" />
              </button>
            )}
            {lightboxImages.length > 1 && lightboxIdx < lightboxImages.length - 1 && (
              <button onClick={() => setLightboxIdx(i => i + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/90 rounded-full shadow hover:bg-white transition-colors">
                <ChevronRight className="h-5 w-5 text-gray-700" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
