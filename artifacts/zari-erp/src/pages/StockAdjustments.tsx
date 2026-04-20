import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  Search, Plus, ChevronDown, ChevronLeft, ChevronRight,
  SlidersHorizontal, X, CalendarRange, AlertTriangle, CheckCircle2,
  TrendingDown, PackageX, ClipboardList, Edit2, Trash2, BarChart2,
} from "lucide-react";
import { useGetMe, getGetMeQueryKey, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import TopNavbar from "@/components/layout/TopNavbar";
import { useToast } from "@/hooks/use-toast";

const G    = "#C6AF4B";
const card = "rounded-2xl bg-white border border-[#C6AF4B]/15 shadow-[0_2px_16px_rgba(198,175,75,0.12),0_1px_3px_rgba(0,0,0,0.06)]";
const thCls = "px-3 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide whitespace-nowrap";
const tdCls = "px-3 py-3 align-top";
const inputCls = "w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 text-gray-900 bg-white";
const labelCls = "block text-xs font-semibold text-gray-500 mb-1";

const ADJ_TYPES = ["Damage", "Loss", "Manual Correction", "Audit Correction", "Opening Correction"];
const REF_TYPES = ["Manual", "Inventory", "Swatch", "Style", "Audit"];
const LOSS_TYPES = new Set(["Damage", "Loss", "Audit Correction"]);

const TYPE_COLOR: Record<string, string> = {
  "Damage":             "bg-red-100 text-red-700",
  "Loss":               "bg-orange-100 text-orange-700",
  "Manual Correction":  "bg-blue-100 text-blue-700",
  "Audit Correction":   "bg-purple-100 text-purple-700",
  "Opening Correction": "bg-gray-100 text-gray-700",
};
const DIR_COLOR: Record<string, string> = {
  "Increase": "bg-emerald-100 text-emerald-700",
  "Decrease": "bg-red-100 text-red-600",
};

interface AdjRow {
  id: number;
  item_id: number;
  inventory_id: number;
  item_name: string;
  item_code: string;
  unit_type: string | null;
  adjustment_type: string;
  adjustment_direction: string;
  adjustment_quantity: string;
  average_price_at_adjustment: string;
  revenue_loss_amount: string;
  reference_type: string;
  reference_id: string | null;
  reason: string | null;
  remarks: string | null;
  adjusted_by: string | null;
  adjustment_date: string;
  created_at: string;
}

interface Summary {
  damage_loss_month: string;
  loss_amount_month: string;
  damage_count_month: number;
  loss_count_month: number;
  audit_count_month: number;
  manual_count_total: number;
  opening_count_total: number;
  total_revenue_loss: string;
}

interface InvItem {
  id: number;
  item_name: string;
  item_code: string;
  current_stock: string;
  available_stock: string;
  average_price: string;
  unit_type: string | null;
}

interface FormState {
  inventoryId: string;
  adjustmentType: string;
  adjustmentDirection: string;
  adjustmentQuantity: string;
  referenceType: string;
  referenceId: string;
  reason: string;
  remarks: string;
  adjustmentDate: string;
}

const defaultForm = (): FormState => ({
  inventoryId: "",
  adjustmentType: "Damage",
  adjustmentDirection: "Decrease",
  adjustmentQuantity: "",
  referenceType: "Manual",
  referenceId: "",
  reason: "",
  remarks: "",
  adjustmentDate: new Date().toISOString().split("T")[0],
});

function fmt2(n: string | number) { return parseFloat(String(n)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmt3(n: string | number) { return parseFloat(String(n)).toFixed(2); }
function fmtDate(s: string) { return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }

export default function StockAdjustments() {
  const [, navigate] = useLocation();
  const { data: me, isError } = useGetMe();
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

  useEffect(() => { if (isError) navigate("/login"); }, [isError]);

  const [rows, setRows]       = useState<AdjRow[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);
  const [summary, setSummary]     = useState<Summary | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey(k => k + 1);
  const limit = 20;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const [search,            setSearch]            = useState("");
  const [adjustmentType,    setAdjustmentType]    = useState("all");
  const [adjustmentDir,     setAdjustmentDir]     = useState("all");
  const [referenceType,     setReferenceType]     = useState("all");
  const [fromDate,          setFromDate]          = useState("");
  const [toDate,            setToDate]            = useState("");
  const [minLoss,           setMinLoss]           = useState("");
  const [maxLoss,           setMaxLoss]           = useState("");

  const [showModal,  setShowModal]  = useState(false);
  const [editTarget, setEditTarget] = useState<AdjRow | null>(null);
  const [form,       setForm]       = useState<FormState>(defaultForm());
  const [errors,     setErrors]     = useState<Partial<FormState>>({});
  const [submitting, setSubmitting] = useState(false);

  const [invItems, setInvItems]     = useState<InvItem[]>([]);
  const [selItem,  setSelItem]      = useState<InvItem | null>(null);
  const [invSearch, setInvSearch]   = useState("");
  const [invOpen,   setInvOpen]     = useState(false);
  const invRef = useRef<HTMLDivElement>(null);

  const [styleOrders,  setStyleOrders]  = useState<{ id: number; orderCode: string; styleName: string }[]>([]);
  const [swatchOrders, setSwatchOrders] = useState<{ id: number; orderCode: string; swatchName: string }[]>([]);

  const [deleteTarget, setDeleteTarget] = useState<AdjRow | null>(null);
  const [deleting,     setDeleting]     = useState(false);

  const refreshSummary = () => {
    customFetch("/api/inventory/adjustments/summary").then((r: unknown) => {
      setSummary((r as { data: Summary }).data);
    }).catch(() => {});
  };

  useEffect(() => {
    setLoading(true);
    const q = new URLSearchParams({
      search, adjustmentType, adjustmentDirection: adjustmentDir,
      referenceType, fromDate, toDate, minLoss, maxLoss,
      page: String(page), limit: String(limit),
    });
    let cancelled = false;
    customFetch(`/api/inventory/adjustments?${q}`)
      .then((r: unknown) => {
        if (cancelled) return;
        const res = r as { data: AdjRow[]; total: number };
        setRows(res.data ?? []);
        setTotal(res.total ?? 0);
      })
      .catch(() => { if (!cancelled) setRows([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    refreshSummary();
    return () => { cancelled = true; };
  }, [search, adjustmentType, adjustmentDir, referenceType, fromDate, toDate, minLoss, maxLoss, page, refreshKey]);

  useEffect(() => {
    customFetch("/api/inventory/items?limit=500&page=1").then((r: unknown) => {
      setInvItems(((r as { data: InvItem[] }).data ?? []));
    }).catch(() => {});
    customFetch("/api/style-orders?limit=100&page=1").then((r: unknown) => {
      setStyleOrders((r as { data: { id: number; orderCode: string; styleName: string }[] }).data ?? []);
    }).catch(() => {});
    customFetch("/api/swatch-orders?limit=100&page=1").then((r: unknown) => {
      setSwatchOrders((r as { data: { id: number; orderCode: string; swatchName: string }[] }).data ?? []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (invRef.current && !invRef.current.contains(e.target as Node)) setInvOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredInv = invItems.filter(it =>
    it.item_name.toLowerCase().includes(invSearch.toLowerCase()) ||
    it.item_code.toLowerCase().includes(invSearch.toLowerCase())
  ).slice(0, 30);

  const setField = (k: keyof FormState, v: string) => setForm(f => ({
    ...f,
    [k]: v,
    ...(k === "referenceType" ? { referenceId: "" } : {}),
  }));

  const previewLoss = (() => {
    if (!selItem || form.adjustmentDirection !== "Decrease") return null;
    if (!LOSS_TYPES.has(form.adjustmentType)) return null;
    const qty = parseFloat(form.adjustmentQuantity);
    if (!qty || qty <= 0) return null;
    const avg = parseFloat(selItem.average_price) || 0;
    return { qty, avg, loss: qty * avg };
  })();

  const openCreate = () => {
    setEditTarget(null);
    setForm(defaultForm());
    setSelItem(null);
    setInvSearch("");
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (row: AdjRow) => {
    setEditTarget(row);
    const it = invItems.find(i => i.id === row.inventory_id) ?? null;
    setSelItem(it);
    setInvSearch(it ? `${it.item_code} — ${it.item_name}` : "");
    setForm({
      inventoryId: String(row.inventory_id),
      adjustmentType: row.adjustment_type,
      adjustmentDirection: row.adjustment_direction,
      adjustmentQuantity: fmt3(row.adjustment_quantity),
      referenceType: row.reference_type,
      referenceId: row.reference_id ?? "",
      reason: row.reason ?? "",
      remarks: row.remarks ?? "",
      adjustmentDate: row.adjustment_date,
    });
    setErrors({});
    setShowModal(true);
  };

  const validate = () => {
    const e: Partial<FormState> = {};
    if (!form.inventoryId) e.inventoryId = "Select an item";
    if (!form.adjustmentQuantity || parseFloat(form.adjustmentQuantity) <= 0) e.adjustmentQuantity = "Enter a valid quantity";
    if (!form.adjustmentDate) e.adjustmentDate = "Enter a date";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const body = {
        inventoryId: Number(form.inventoryId),
        adjustmentType: form.adjustmentType,
        adjustmentDirection: form.adjustmentDirection,
        adjustmentQuantity: parseFloat(form.adjustmentQuantity),
        referenceType: form.referenceType,
        referenceId: form.referenceId || undefined,
        reason: form.reason || undefined,
        remarks: form.remarks || undefined,
        adjustmentDate: form.adjustmentDate,
      };
      if (editTarget) {
        await customFetch(`/api/inventory/adjustments/${editTarget.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        toast({ title: "Adjustment updated" });
      } else {
        await customFetch("/api/inventory/adjustments", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        toast({ title: "Stock adjustment applied successfully and inventory updated" });
      }
      setShowModal(false);
      refresh();
    } catch (e: unknown) {
      toast({ title: (e as { message?: string })?.message ?? "Failed to save", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await customFetch(`/api/inventory/adjustments/${deleteTarget.id}`, { method: "DELETE" });
      toast({ title: "Adjustment deleted and stock restored" });
      setDeleteTarget(null);
      refresh();
    } catch (e: unknown) {
      toast({ title: (e as { message?: string })?.message ?? "Delete failed", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const clearFilters = () => {
    setSearch(""); setAdjustmentType("all"); setAdjustmentDir("all");
    setReferenceType("all"); setFromDate(""); setToDate("");
    setMinLoss(""); setMaxLoss(""); setPage(1);
  };
  const hasFilters = search || adjustmentType !== "all" || adjustmentDir !== "all" ||
    referenceType !== "all" || fromDate || toDate || minLoss || maxLoss;

  const actor = (me as { name?: string; email?: string } | undefined)?.name ?? "";
  const role  = (me as { role?: string } | undefined)?.role ?? "";

  return (
    <div className="min-h-screen" style={{ background: "#F8F6F0" }}>
      <TopNavbar username={actor} role={role} onLogout={handleLogout} isLoggingOut={false} />

      <div className="py-6 px-6 max-w-screen-2xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ background: `${G}20` }}>
              <SlidersHorizontal className="h-5 w-5" style={{ color: G }} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Stock Adjustments</h1>
              <p className="text-sm text-gray-500 mt-0.5">Damage, loss, and manual corrections with full audit trail</p>
            </div>
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm"
            style={{ background: `linear-gradient(135deg, ${G}, #A8943E)` }}>
            <Plus className="h-4 w-4" /> New Adjustment
          </button>
        </div>

        {/* Summary Panel */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Damage Loss (Month)", value: `₹${fmt2(summary.damage_loss_month)}`, sub: `${summary.damage_count_month} entries`, icon: PackageX, color: "text-red-600", bg: "bg-red-50" },
              { label: "Loss Amount (Month)", value: `₹${fmt2(summary.loss_amount_month)}`, sub: `${summary.loss_count_month} entries`, icon: TrendingDown, color: "text-orange-600", bg: "bg-orange-50" },
              { label: "Audit Corrections", value: String(summary.audit_count_month), sub: "This month", icon: ClipboardList, color: "text-purple-600", bg: "bg-purple-50" },
              { label: "Total Revenue Loss", value: `₹${fmt2(summary.total_revenue_loss)}`, sub: `${summary.manual_count_total} manual · ${summary.opening_count_total} opening`, icon: BarChart2, color: "text-gray-700", bg: "bg-gray-50" },
            ].map(s => (
              <div key={s.label} className={`${card} p-4 flex items-start gap-3`}>
                <div className={`p-2 rounded-xl ${s.bg} flex-shrink-0`}>
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 truncate">{s.label}</p>
                  <p className={`text-lg font-bold ${s.color} leading-tight`}>{s.value}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{s.sub}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className={`${card} p-4`}>
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input type="text" placeholder="Search item or reason…" value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-8 pr-3 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30" />
            </div>

            {[
              { label: "All Types", value: adjustmentType, set: setAdjustmentType, opts: ADJ_TYPES },
            ].map(({ label, value, set, opts }) => (
              <div key={label} className="relative">
                <select value={value} onChange={e => { set(e.target.value); setPage(1); }}
                  className="appearance-none pl-3 pr-8 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 bg-white min-w-[160px]">
                  <option value="all">{label}</option>
                  {opts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              </div>
            ))}

            <div className="relative">
              <select value={adjustmentDir} onChange={e => { setAdjustmentDir(e.target.value); setPage(1); }}
                className="appearance-none pl-3 pr-8 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 bg-white min-w-[140px]">
                <option value="all">All Directions</option>
                <option value="Increase">Increase</option>
                <option value="Decrease">Decrease</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative">
              <select value={referenceType} onChange={e => { setReferenceType(e.target.value); setPage(1); }}
                className="appearance-none pl-3 pr-8 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 bg-white min-w-[140px]">
                <option value="all">All Ref Types</option>
                {REF_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            </div>

            <div className="flex items-center gap-1 border border-gray-200 rounded-xl px-2 py-1 bg-white">
              <CalendarRange className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
              <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }}
                className="text-xs border-0 outline-none bg-transparent w-[110px] text-gray-900" />
              <span className="text-gray-300 text-xs">—</span>
              <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }}
                className="text-xs border-0 outline-none bg-transparent w-[110px] text-gray-900" />
            </div>

            <div className="flex items-center gap-1 border border-gray-200 rounded-xl px-2 py-1.5 bg-white">
              <span className="text-xs text-gray-400">Loss ₹</span>
              <input type="number" placeholder="Min" value={minLoss} onChange={e => { setMinLoss(e.target.value); setPage(1); }}
                className="w-[60px] text-xs border-0 outline-none bg-transparent text-gray-900" />
              <span className="text-gray-300">—</span>
              <input type="number" placeholder="Max" value={maxLoss} onChange={e => { setMaxLoss(e.target.value); setPage(1); }}
                className="w-[60px] text-xs border-0 outline-none bg-transparent text-gray-900" />
            </div>

            {hasFilters && (
              <button onClick={clearFilters}
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
                  <th className={thCls}>Item</th>
                  <th className={thCls}>Type</th>
                  <th className={thCls}>Direction</th>
                  <th className={thCls}>Quantity</th>
                  <th className={thCls}>Avg Price</th>
                  <th className={thCls}>Revenue Loss</th>
                  <th className={thCls}>Reference</th>
                  <th className={thCls}>Date</th>
                  <th className={thCls}>Reason</th>
                  <th className={thCls}>Adjusted By</th>
                  {isAdmin && <th className={thCls}>Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={isAdmin ? 12 : 11} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-8 w-8 rounded-full border-2 border-[#C6AF4B] border-t-transparent animate-spin" />
                      <span className="text-sm text-gray-700">Loading…</span>
                    </div>
                  </td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={isAdmin ? 12 : 11} className="px-4 py-16 text-center">
                    <SlidersHorizontal className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-700 font-medium">No adjustments found</p>
                    <p className="text-xs text-gray-400 mt-1">Create a stock adjustment to get started</p>
                  </td></tr>
                ) : rows.map((row, idx) => {
                  const loss = parseFloat(row.revenue_loss_amount);
                  return (
                    <tr key={row.id} className="hover:bg-[#C6AF4B]/5 transition-colors">
                      <td className={tdCls}><span className="text-xs text-gray-400">{(page-1)*limit+idx+1}</span></td>
                      <td className={tdCls}>
                        <div className="text-sm font-medium text-gray-900">{row.item_name}</div>
                        <div className="text-xs text-gray-400 font-mono">{row.item_code}</div>
                      </td>
                      <td className={tdCls}>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${TYPE_COLOR[row.adjustment_type] ?? "bg-gray-100 text-gray-600"}`}>
                          {row.adjustment_type}
                        </span>
                      </td>
                      <td className={tdCls}>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${DIR_COLOR[row.adjustment_direction] ?? "bg-gray-100 text-gray-600"}`}>
                          {row.adjustment_direction === "Increase" ? "+" : "−"} {row.adjustment_direction}
                        </span>
                      </td>
                      <td className={tdCls}>
                        <span className="text-sm font-mono font-semibold" style={{ color: G }}>
                          {fmt3(row.adjustment_quantity)} <span className="text-xs text-gray-400 font-normal">{row.unit_type ?? ""}</span>
                        </span>
                      </td>
                      <td className={tdCls}><span className="text-xs text-gray-700">₹{fmt2(row.average_price_at_adjustment)}</span></td>
                      <td className={tdCls}>
                        {loss > 0 ? (
                          <span className="text-sm font-semibold text-red-600">₹{fmt2(row.revenue_loss_amount)}</span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className={tdCls}>
                        <div className="text-xs font-mono text-gray-700">{row.reference_type}</div>
                        {row.reference_id && <div className="text-[11px] text-gray-400">{row.reference_id}</div>}
                      </td>
                      <td className={tdCls}><span className="text-xs text-gray-700">{fmtDate(row.adjustment_date)}</span></td>
                      <td className={tdCls}>
                        {row.reason ? (
                          <div className="text-xs text-gray-700 max-w-[140px] truncate" title={row.reason}>{row.reason}</div>
                        ) : row.remarks ? (
                          <div className="text-xs text-gray-400 max-w-[140px] truncate italic">{row.remarks}</div>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      <td className={tdCls}><span className="text-xs text-gray-500">{row.adjusted_by ?? "—"}</span></td>
                      {isAdmin && (
                        <td className={tdCls}>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => openEdit(row)}
                              className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
                              title="Edit">
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setDeleteTarget(row)}
                              className="p-1.5 rounded-lg border border-red-100 text-red-500 hover:bg-red-50 transition-colors"
                              title="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
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

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <span className="text-xs text-gray-500">Showing {Math.min((page-1)*limit+1, total)}–{Math.min(page*limit, total)} of {total}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pg = totalPages <= 5 ? i + 1 : Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                  return (
                    <button key={pg} onClick={() => setPage(pg)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium border transition-colors ${pg === page ? "border-[#C6AF4B] text-white" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}
                      style={pg === page ? { background: G } : {}}>
                      {pg}
                    </button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className={`${card} w-full max-w-2xl max-h-[90vh] overflow-y-auto`}>
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">{editTarget ? "Edit Adjustment" : "New Stock Adjustment"}</h2>
                <p className="text-xs text-gray-500 mt-0.5">All changes update inventory in real-time</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Item selector */}
              <div ref={invRef}>
                <label className={labelCls}>Inventory Item <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input
                    className={`${inputCls} pl-8 ${errors.inventoryId ? "border-red-400" : ""}`}
                    placeholder="Search item name or code…"
                    value={invSearch}
                    onChange={e => { setInvSearch(e.target.value); setInvOpen(true); }}
                    onFocus={() => setInvOpen(true)}
                  />
                  {errors.inventoryId && <p className="text-xs text-red-500 mt-1">{errors.inventoryId}</p>}
                  {invOpen && filteredInv.length > 0 && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-[200px] overflow-y-auto">
                      {filteredInv.map(it => (
                        <button key={it.id} type="button"
                          className="w-full text-left px-3 py-2.5 hover:bg-[#C6AF4B]/8 transition-colors flex items-center justify-between gap-2"
                          onClick={() => {
                            setSelItem(it);
                            setField("inventoryId", String(it.id));
                            setInvSearch(`${it.item_code} — ${it.item_name}`);
                            setInvOpen(false);
                          }}>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{it.item_name}</div>
                            <div className="text-xs text-gray-400 font-mono">{it.item_code}</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-xs text-gray-700">Avail: <span className="font-semibold">{fmt3(it.available_stock)}</span></div>
                            <div className="text-[11px] text-gray-400">{it.unit_type ?? ""}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selItem && (
                  <div className="mt-2 p-3 rounded-xl bg-[#C6AF4B]/8 border border-[#C6AF4B]/20 flex gap-4 text-xs">
                    <div><span className="text-gray-500">Current Stock:</span> <span className="font-semibold text-gray-900">{fmt3(selItem.current_stock)} {selItem.unit_type}</span></div>
                    <div><span className="text-gray-500">Available:</span> <span className="font-semibold text-emerald-700">{fmt3(selItem.available_stock)} {selItem.unit_type}</span></div>
                    <div><span className="text-gray-500">Avg Price:</span> <span className="font-semibold text-gray-900">₹{fmt2(selItem.average_price)}</span></div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Adjustment Type <span className="text-red-500">*</span></label>
                  <select value={form.adjustmentType} onChange={e => setField("adjustmentType", e.target.value)} className={inputCls}>
                    {ADJ_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Direction <span className="text-red-500">*</span></label>
                  <select value={form.adjustmentDirection} onChange={e => setField("adjustmentDirection", e.target.value)} className={inputCls}>
                    <option value="Decrease">Decrease (Remove from stock)</option>
                    <option value="Increase">Increase (Add to stock)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Quantity <span className="text-red-500">*</span></label>
                  <input type="number" step="0.001" min="0.001"
                    className={`${inputCls} ${errors.adjustmentQuantity ? "border-red-400" : ""}`}
                    placeholder="0.000"
                    value={form.adjustmentQuantity}
                    onChange={e => setField("adjustmentQuantity", e.target.value)} />
                  {errors.adjustmentQuantity && <p className="text-xs text-red-500 mt-1">{errors.adjustmentQuantity}</p>}
                </div>
                <div>
                  <label className={labelCls}>Date <span className="text-red-500">*</span></label>
                  <input type="date"
                    className={`${inputCls} ${errors.adjustmentDate ? "border-red-400" : ""}`}
                    value={form.adjustmentDate}
                    onChange={e => setField("adjustmentDate", e.target.value)} />
                </div>
              </div>

              {/* Real-time loss preview */}
              {previewLoss && (
                <div className="p-4 rounded-xl border border-red-200 bg-red-50 flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-red-700">Estimated Revenue Loss</p>
                    <div className="text-xs text-red-600 mt-1 space-y-0.5">
                      <p>{form.adjustmentType} of <strong>{fmt3(previewLoss.qty)} {selItem?.unit_type ?? "units"}</strong></p>
                      <p>× Avg Price <strong>₹{fmt2(previewLoss.avg)}</strong></p>
                      <p className="text-base font-bold text-red-700 mt-1">= ₹{fmt2(previewLoss.loss)}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Reference Type</label>
                  <select value={form.referenceType} onChange={e => setField("referenceType", e.target.value)} className={inputCls}>
                    {REF_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Reference ID</label>
                  {form.referenceType === "Style" ? (
                    <div className="relative">
                      <select
                        value={form.referenceId}
                        onChange={e => setField("referenceId", e.target.value)}
                        className={`${inputCls} appearance-none pr-8 text-gray-900`}>
                        <option value="">— Select Style Order —</option>
                        {styleOrders.map(o => (
                          <option key={o.id} value={o.orderCode}>{o.orderCode} — {o.styleName}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                    </div>
                  ) : form.referenceType === "Swatch" ? (
                    <div className="relative">
                      <select
                        value={form.referenceId}
                        onChange={e => setField("referenceId", e.target.value)}
                        className={`${inputCls} appearance-none pr-8 text-gray-900`}>
                        <option value="">— Select Swatch Order —</option>
                        {swatchOrders.map(o => (
                          <option key={o.id} value={o.orderCode}>{o.orderCode} — {o.swatchName}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                    </div>
                  ) : (
                    <input type="text" className={inputCls} placeholder="e.g. Audit-001 or Inv-005"
                      value={form.referenceId} onChange={e => setField("referenceId", e.target.value)} />
                  )}
                </div>
              </div>

              <div>
                <label className={labelCls}>Reason</label>
                <input type="text" className={inputCls} placeholder="Short reason for this adjustment"
                  value={form.reason} onChange={e => setField("reason", e.target.value)} />
              </div>

              <div>
                <label className={labelCls}>Remarks</label>
                <textarea rows={2} className={inputCls} placeholder="Any additional notes…"
                  value={form.remarks} onChange={e => setField("remarks", e.target.value)} />
              </div>
            </div>

            <div className="p-6 pt-0 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60 flex items-center gap-2"
                style={{ background: `linear-gradient(135deg, ${G}, #A8943E)` }}>
                {submitting ? (
                  <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : <CheckCircle2 className="h-4 w-4" />}
                {editTarget ? "Save Changes" : "Apply Adjustment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className={`${card} w-full max-w-md p-6`}>
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-xl bg-red-50 flex-shrink-0">
                <Trash2 className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Delete Adjustment?</h3>
                <p className="text-sm text-gray-600 mt-1">
                  This will restore <strong>{fmt3(deleteTarget.adjustment_quantity)} {deleteTarget.unit_type ?? "units"}</strong> of <strong>{deleteTarget.item_name}</strong> to inventory
                  and remove the ledger entry. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting}
                className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 flex items-center gap-2">
                {deleting ? <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> : null}
                Delete & Restore Stock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
