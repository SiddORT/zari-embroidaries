import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import {
  Search, ChevronDown, ChevronLeft, ChevronRight,
  X, BookOpen, Trash2, AlertTriangle, Plus, CalendarRange,
} from "lucide-react";
import { useGetMe, getGetMeQueryKey, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import TopNavbar from "@/components/layout/TopNavbar";
import { useToast } from "@/hooks/use-toast";

const G     = "#C6AF4B";
const G_DIM = "#A8943E";
const card  = "rounded-2xl bg-white border border-[#C6AF4B]/15 shadow-[0_2px_16px_rgba(198,175,75,0.12),0_1px_3px_rgba(0,0,0,0.06)]";
const thCls = "px-3 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide whitespace-nowrap";
const tdCls = "px-3 py-3 text-sm text-gray-900";

const TX_TYPES: Record<string, { label: string; color: string }> = {
  opening_stock:          { label: "Opening Stock",          color: "bg-blue-100 text-blue-800" },
  purchase_receipt:       { label: "Purchase Receipt",       color: "bg-green-100 text-green-800" },
  consumption:            { label: "Consumption",            color: "bg-orange-100 text-orange-800" },
  style_reservation:      { label: "Style Reservation",      color: "bg-purple-100 text-purple-800" },
  swatch_reservation:     { label: "Swatch Reservation",     color: "bg-violet-100 text-violet-800" },
  reservation_conversion: { label: "Reservation Conversion", color: "bg-indigo-100 text-indigo-800" },
  reservation_release:    { label: "Reservation Release",    color: "bg-teal-100 text-teal-800" },
  wastage:                { label: "Wastage",                color: "bg-red-100 text-red-800" },
  adjustment_in:          { label: "Adjustment (In)",        color: "bg-emerald-100 text-emerald-800" },
  adjustment_out:         { label: "Adjustment (Out)",       color: "bg-amber-100 text-amber-800" },
};

const REF_TYPES = ["manual_entry", "pr", "swatch", "style"];
const SORT_OPTS = [
  { value: "newest",       label: "Newest First" },
  { value: "oldest",       label: "Oldest First" },
  { value: "highest_in",   label: "Highest In Qty" },
  { value: "highest_out",  label: "Highest Out Qty" },
];

interface LedgerRow {
  id: number;
  item_id: number;
  item_name: string;
  item_code: string;
  unit_type: string | null;
  transaction_type: string;
  reference_number: string | null;
  reference_type: string | null;
  in_quantity: string;
  out_quantity: string;
  balance_quantity: string;
  remarks: string | null;
  created_by: string | null;
  created_at: string;
  swatch_order_code: string | null;
  style_order_code: string | null;
  style_order_style_no: string | null;
}

interface InventoryItemOption {
  id: number;
  item_name: string;
  item_code: string;
  available_stock: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}
function fmt3(v: string | number) {
  const n = parseFloat(String(v));
  return isNaN(n) ? "0.000" : n.toFixed(3);
}

export default function InventoryLedger() {
  const [, navigate] = useLocation();
  const { data: me, isError } = useGetMe();
  const token   = localStorage.getItem("zarierp_token");
  const isAdmin = (me as { role?: string } | undefined)?.role === "admin";
  const queryClient = useQueryClient();
  const { mutateAsync: logoutMutate } = useLogout();
  const { toast } = useToast();

  const handleLogout = async () => {
    await logoutMutate(undefined).catch(() => {});
    queryClient.removeQueries({ queryKey: getGetMeQueryKey() });
    localStorage.removeItem("zarierp_token");
    navigate("/login");
  };

  const [rows, setRows]     = useState<LedgerRow[]>([]);
  const [total, setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage]     = useState(1);
  const limit = 10;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const [search,    setSearch]    = useState("");
  const [txType,    setTxType]    = useState("all");
  const [refType,   setRefType]   = useState("all");
  const [fromDate,  setFromDate]  = useState("");
  const [toDate,    setToDate]    = useState("");
  const [sortMode,  setSortMode]  = useState("newest");
  const [itemFilter, setItemFilter] = useState(() => {
    const sp = new URLSearchParams(window.location.search);
    return sp.get("itemId") ?? "";
  });

  const [items, setItems]   = useState<InventoryItemOption[]>([]);
  const [itemSearch, setItemSearch] = useState(() => {
    const sp = new URLSearchParams(window.location.search);
    return sp.get("itemName") ? decodeURIComponent(sp.get("itemName")!) : "";
  });
  const [itemDropOpen, setItemDropOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItemOption | null>(null);
  const itemDropRef = useRef<HTMLDivElement>(null);

  const [wastageModal, setWastageModal] = useState(false);
  const [wastageForm, setWastageForm]   = useState({ itemId: "", quantity: "", reason: "", referenceNumber: "" });
  const [wastageItem, setWastageItem]   = useState<InventoryItemOption | null>(null);
  const [wastageItemSearch, setWastageItemSearch] = useState("");
  const [wastageItemDrop, setWastageItemDrop]     = useState(false);
  const wastageItemDropRef = useRef<HTMLDivElement>(null);
  const [submitting, setSubmitting] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<LedgerRow | null>(null);

  useEffect(() => { if (isError) navigate("/login"); }, [isError, navigate]);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (itemDropRef.current && !itemDropRef.current.contains(e.target as Node)) setItemDropOpen(false);
      if (wastageItemDropRef.current && !wastageItemDropRef.current.contains(e.target as Node)) setWastageItemDrop(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  useEffect(() => {
    if (!token) return;
    customFetch(`/api/inventory/items?limit=200&sort=item_name&order=asc&_t=${Date.now()}`)
      .then((r: unknown) => setItems((r as { data: InventoryItemOption[] }).data))
      .catch(() => {});
  }, [token]);

  const buildQs = useCallback(() => {
    const p = new URLSearchParams({ sort: sortMode, page: String(page), limit: String(limit) });
    if (search)     p.set("search",          search);
    if (txType  !== "all") p.set("transactionType", txType);
    if (refType !== "all") p.set("referenceType",   refType);
    if (fromDate)   p.set("fromDate",         fromDate);
    if (toDate)     p.set("toDate",           toDate);
    if (itemFilter) p.set("itemId",           itemFilter);
    return p.toString();
  }, [search, txType, refType, fromDate, toDate, sortMode, page, itemFilter, limit]);

  const loadData = useCallback((bust = false) => {
    if (!token) return;
    setLoading(true);
    const ts = bust ? `&_t=${Date.now()}` : "";
    customFetch(`/api/inventory/ledger?${buildQs()}${ts}`)
      .then((r: unknown) => {
        const res = r as { data: LedgerRow[]; total: number };
        setRows(res.data);
        setTotal(res.total);
      })
      .catch(() => toast({ title: "Failed to load ledger", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [token, buildQs, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleWastageSubmit = async () => {
    if (!wastageItem) return toast({ title: "Select an item", variant: "destructive" });
    if (!wastageForm.quantity || parseFloat(wastageForm.quantity) <= 0) return toast({ title: "Enter a valid quantity", variant: "destructive" });
    setSubmitting(true);
    try {
      await customFetch("/api/inventory/ledger/wastage", {
        method: "POST",
        body: JSON.stringify({ itemId: wastageItem.id, quantity: wastageForm.quantity, reason: wastageForm.reason, referenceNumber: wastageForm.referenceNumber }),
      });
      toast({ title: "Wastage entry recorded successfully" });
      setWastageModal(false);
      setWastageForm({ itemId: "", quantity: "", reason: "", referenceNumber: "" });
      setWastageItem(null);
      setWastageItemSearch("");
      loadData(true);
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? "Failed to record wastage";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row: LedgerRow) => {
    try {
      await customFetch(`/api/inventory/ledger/${row.id}`, { method: "DELETE" });
      toast({ title: "Ledger entry deleted" });
      setDeleteConfirm(null);
      loadData(true);
    } catch {
      toast({ title: "Failed to delete entry", variant: "destructive" });
    }
  };

  const filteredItems    = items.filter(i => i.item_name.toLowerCase().includes(itemSearch.toLowerCase()) || i.item_code.toLowerCase().includes(itemSearch.toLowerCase()));
  const filteredWItems   = items.filter(i => i.item_name.toLowerCase().includes(wastageItemSearch.toLowerCase()) || i.item_code.toLowerCase().includes(wastageItemSearch.toLowerCase()));

  return (
    <div className="min-h-screen" style={{ background: "#F8F6F0" }}>
      <TopNavbar
        username={(me as { name?: string } | undefined)?.name ?? ""}
        role={(me as { role?: string } | undefined)?.role ?? ""}
        onLogout={handleLogout}
        isLoggingOut={false}
      />

      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" style={{ color: G }} />
              <h1 className="text-xl font-bold text-gray-900">Stock Ledger</h1>
            </div>
            <p className="text-sm text-gray-700 mt-0.5">Complete movement history for all inventory items</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setWastageModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ background: `linear-gradient(135deg, ${G}, ${G_DIM})` }}>
              <Plus className="h-4 w-4" /> Add Wastage Entry
            </button>
          )}
        </div>

        {/* Filters */}
        <div className={`${card} p-4`}>
          <div className="flex flex-wrap gap-3">
            {/* Item search/select */}
            <div className="relative min-w-[220px]" ref={itemDropRef}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Filter by item…"
                value={itemSearch}
                onFocus={() => setItemDropOpen(true)}
                onChange={e => { setItemSearch(e.target.value); setItemDropOpen(true); }}
                className="w-full pl-8 pr-3 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30"
              />
              {selectedItem && (
                <button onClick={() => { setSelectedItem(null); setItemFilter(""); setItemSearch(""); setPage(1); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-100">
                  <X className="h-3.5 w-3.5 text-gray-400" />
                </button>
              )}
              {itemDropOpen && filteredItems.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 max-h-52 overflow-y-auto">
                  {filteredItems.slice(0, 40).map(it => (
                    <button key={it.id} onClick={() => {
                      setSelectedItem(it);
                      setItemFilter(String(it.id));
                      setItemSearch(it.item_name);
                      setItemDropOpen(false);
                      setPage(1);
                    }} className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-[#C6AF4B]/10 border-b border-gray-50 last:border-0">
                      <span className="font-medium">{it.item_name}</span>
                      <span className="text-xs text-gray-500 ml-2">{it.item_code}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search remarks/notes */}
            <div className="relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input type="text" placeholder="Search item name…" value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-8 pr-3 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30" />
            </div>

            {/* Transaction type */}
            <div className="relative">
              <select value={txType} onChange={e => { setTxType(e.target.value); setPage(1); }}
                className="appearance-none pl-3 pr-8 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 bg-white min-w-[180px]">
                <option value="all">All Transaction Types</option>
                {Object.entries(TX_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            </div>

            {/* Reference type */}
            <div className="relative">
              <select value={refType} onChange={e => { setRefType(e.target.value); setPage(1); }}
                className="appearance-none pl-3 pr-8 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 bg-white min-w-[160px]">
                <option value="all">All Reference Types</option>
                {REF_TYPES.map(r => <option key={r} value={r}>{r.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            </div>

            {/* Date range */}
            <div className="flex items-center gap-1 border border-gray-200 rounded-xl px-2 py-1 bg-white">
              <CalendarRange className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
              <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }}
                className="text-xs text-gray-900 border-0 outline-none bg-transparent w-[120px]" />
              <span className="text-gray-300 text-xs">—</span>
              <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }}
                className="text-xs text-gray-900 border-0 outline-none bg-transparent w-[120px]" />
            </div>

            {/* Sort */}
            <div className="relative ml-auto">
              <select value={sortMode} onChange={e => { setSortMode(e.target.value); setPage(1); }}
                className="appearance-none pl-3 pr-8 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 bg-white">
                {SORT_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            </div>

            {/* Clear */}
            {(search || txType !== "all" || refType !== "all" || fromDate || toDate || itemFilter) && (
              <button onClick={() => { setSearch(""); setTxType("all"); setRefType("all"); setFromDate(""); setToDate(""); setItemFilter(""); setItemSearch(""); setSelectedItem(null); setPage(1); }}
                className="flex items-center gap-1 text-xs text-gray-700 px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50">
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className={card}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F8F6F0] border-b border-[#C6AF4B]/15">
                <tr>
                  <th className={thCls}>#</th>
                  <th className={thCls}>Date & Time</th>
                  <th className={thCls}>Item Name</th>
                  <th className={thCls}>Code</th>
                  <th className={thCls}>Transaction Type</th>
                  <th className={thCls}>Reference</th>
                  <th className={`${thCls} text-right`}>In Qty</th>
                  <th className={`${thCls} text-right`}>Out Qty</th>
                  <th className={`${thCls} text-right`}>Balance</th>
                  <th className={thCls}>Remarks</th>
                  <th className={thCls}>Created By</th>
                  {isAdmin && <th className={thCls}>Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={isAdmin ? 12 : 11} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-8 w-8 rounded-full border-2 border-[#C6AF4B] border-t-transparent animate-spin" />
                        <span className="text-sm text-gray-700">Loading ledger…</span>
                      </div>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 12 : 11} className="px-4 py-16 text-center">
                      <BookOpen className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-700 font-medium">No ledger entries found</p>
                      <p className="text-xs text-gray-400 mt-1">Stock movements will appear here as they are recorded</p>
                    </td>
                  </tr>
                ) : rows.map((row, idx) => {
                  const tx = TX_TYPES[row.transaction_type] ?? { label: row.transaction_type, color: "bg-gray-100 text-gray-800" };
                  const inQ  = parseFloat(row.in_quantity);
                  const outQ = parseFloat(row.out_quantity);
                  return (
                    <tr key={row.id} className="hover:bg-[#C6AF4B]/5 transition-colors">
                      <td className={tdCls}>
                        <span className="text-xs text-gray-400">{(page - 1) * limit + idx + 1}</span>
                      </td>
                      <td className={tdCls}>
                        <div className="text-xs font-medium text-gray-900">{fmtDate(row.created_at)}</div>
                        <div className="text-[11px] text-gray-400">{fmtTime(row.created_at)}</div>
                      </td>
                      <td className={tdCls}>
                        <span className="font-medium text-gray-900 text-xs">{row.item_name}</span>
                      </td>
                      <td className={tdCls}>
                        <span className="text-xs text-gray-500 font-mono">{row.item_code}</span>
                      </td>
                      <td className={tdCls}>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${tx.color}`}>
                          {tx.label}
                        </span>
                      </td>
                      <td className={tdCls}>
                        {row.reference_type === "Swatch" && row.swatch_order_code ? (
                          <div>
                            <div className="text-xs font-semibold text-violet-700">{row.swatch_order_code}</div>
                            <div className="text-[11px] text-gray-400">Swatch Order</div>
                          </div>
                        ) : row.reference_type === "Style" && row.style_order_code ? (
                          <div>
                            <div className="text-xs font-semibold text-indigo-700">{row.style_order_code}</div>
                            {row.style_order_style_no && (
                              <div className="text-[11px] text-gray-400">{row.style_order_style_no}</div>
                            )}
                          </div>
                        ) : row.reference_number ? (
                          <div>
                            <div className="text-xs text-gray-700 font-mono">{row.reference_number}</div>
                            {row.reference_type && (
                              <div className="text-[11px] text-gray-400 capitalize">{row.reference_type.replace(/_/g, " ")}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className={`${tdCls} text-right`}>
                        {inQ > 0 ? (
                          <span className="text-xs font-semibold text-emerald-700">+{fmt3(inQ)}</span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className={`${tdCls} text-right`}>
                        {outQ > 0 ? (
                          <span className="text-xs font-semibold text-red-600">−{fmt3(outQ)}</span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className={`${tdCls} text-right`}>
                        <span className="text-xs font-bold text-gray-900">{fmt3(row.balance_quantity)}</span>
                        {row.unit_type && <span className="text-[10px] text-gray-400 ml-0.5">{row.unit_type}</span>}
                      </td>
                      <td className={tdCls}>
                        <span className="text-xs text-gray-600 max-w-[160px] block truncate" title={row.remarks ?? ""}>
                          {row.remarks ?? "—"}
                        </span>
                      </td>
                      <td className={tdCls}>
                        <span className="text-xs text-gray-600">{row.created_by ?? "—"}</span>
                      </td>
                      {isAdmin && (
                        <td className={tdCls}>
                          <button onClick={() => setDeleteConfirm(row)}
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
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
              <span className="text-xs text-gray-700">
                Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total} entries
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
          {total > 0 && total <= limit && (
            <div className="px-4 py-3 border-t border-gray-100">
              <span className="text-xs text-gray-500">{total} entries</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Wastage Modal ─────────────────────────────────────────────────────── */}
      {wastageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`${card} w-full max-w-md`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">Add Wastage Entry</h2>
                <p className="text-xs text-gray-500 mt-0.5">Record material wastage and reduce stock</p>
              </div>
              <button onClick={() => { setWastageModal(false); setWastageItem(null); setWastageItemSearch(""); }}
                className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="h-4 w-4 text-gray-700" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Item select */}
              <div className="relative" ref={wastageItemDropRef}>
                <label className="block text-xs font-medium text-gray-900 mb-1">Item <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="Search and select item…"
                  value={wastageItemSearch}
                  onFocus={() => setWastageItemDrop(true)}
                  onChange={e => { setWastageItemSearch(e.target.value); setWastageItemDrop(true); if (wastageItem) setWastageItem(null); }}
                  className="w-full px-3 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30"
                />
                {wastageItemDrop && filteredWItems.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 max-h-48 overflow-y-auto">
                    {filteredWItems.slice(0, 30).map(it => (
                      <button key={it.id} onClick={() => {
                        setWastageItem(it);
                        setWastageItemSearch(it.item_name);
                        setWastageItemDrop(false);
                      }} className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-[#C6AF4B]/10 border-b border-gray-50 last:border-0">
                        <span className="font-medium">{it.item_name}</span>
                        <span className="text-xs text-gray-400 ml-2">{it.item_code}</span>
                        <span className="text-xs text-gray-400 ml-2">Avail: {fmt3(it.available_stock)}</span>
                      </button>
                    ))}
                  </div>
                )}
                {wastageItem && (
                  <div className="mt-1.5 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                    Available stock: <span className="font-bold">{fmt3(wastageItem.available_stock)}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-900 mb-1">Wastage Qty <span className="text-red-500">*</span></label>
                  <input type="number" placeholder="0.000" min="0" step="0.001"
                    value={wastageForm.quantity}
                    onChange={e => setWastageForm(f => ({ ...f, quantity: e.target.value }))}
                    className="w-full px-3 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-900 mb-1">Reference # (optional)</label>
                  <input type="text" placeholder="e.g. WO-001"
                    value={wastageForm.referenceNumber}
                    onChange={e => setWastageForm(f => ({ ...f, referenceNumber: e.target.value }))}
                    className="w-full px-3 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30" />
                </div>
              </div>

              {wastageItem && wastageForm.quantity && parseFloat(wastageForm.quantity) > 0 && (
                <div className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 ${parseFloat(wastageForm.quantity) > parseFloat(wastageItem.available_stock) ? "bg-red-50 border border-red-200 text-red-700" : "bg-emerald-50 border border-emerald-200 text-emerald-700"}`}>
                  {parseFloat(wastageForm.quantity) > parseFloat(wastageItem.available_stock) ? (
                    <><AlertTriangle className="h-3.5 w-3.5" /> Quantity exceeds available stock ({fmt3(wastageItem.available_stock)})</>
                  ) : (
                    <>New stock after wastage: <span className="font-bold">{(parseFloat(wastageItem.available_stock) - parseFloat(wastageForm.quantity)).toFixed(3)}</span></>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-900 mb-1">Reason / Notes</label>
                <textarea rows={2} placeholder="e.g. Damaged during production, quality rejected…"
                  value={wastageForm.reason}
                  onChange={e => setWastageForm(f => ({ ...f, reason: e.target.value }))}
                  className="w-full px-3 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 resize-none" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 pb-5">
              <button onClick={() => { setWastageModal(false); setWastageItem(null); setWastageItemSearch(""); }}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleWastageSubmit} disabled={submitting || !wastageItem || !wastageForm.quantity}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: `linear-gradient(135deg, ${G}, ${G_DIM})` }}>
                {submitting ? "Saving…" : "Record Wastage"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ────────────────────────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`${card} w-full max-w-sm p-6`} onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Delete Ledger Entry?</h3>
                <p className="text-xs text-gray-500 mt-1">
                  This will permanently delete the <span className="font-semibold">{TX_TYPES[deleteConfirm.transaction_type]?.label ?? deleteConfirm.transaction_type}</span> entry for <span className="font-semibold">{deleteConfirm.item_name}</span>.
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
