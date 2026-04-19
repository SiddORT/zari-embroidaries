import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import {
  Search, ChevronDown, CalendarRange, X, AlertTriangle,
  Bookmark, CheckCircle2, XCircle, RefreshCw, ArrowRightLeft,
  Plus, Trash2, Shield, Flame, PackageOpen, MoreHorizontal,
} from "lucide-react";
import { useGetMe, getGetMeQueryKey, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import TopNavbar from "@/components/layout/TopNavbar";
import { useToast } from "@/hooks/use-toast";

const G    = "#C6AF4B";
const card = "rounded-2xl bg-white border border-[#C6AF4B]/15 shadow-[0_2px_16px_rgba(198,175,75,0.12),0_1px_3px_rgba(0,0,0,0.06)]";
const thCls = "px-3 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide whitespace-nowrap";
const tdCls = "px-3 py-3 text-sm text-gray-900";

const STATUS_META: Record<string, { color: string; Icon: React.ElementType }> = {
  Active:    { color: "bg-amber-100 text-amber-700",  Icon: Bookmark },
  Converted: { color: "bg-blue-100 text-blue-700",    Icon: ArrowRightLeft },
  Released:  { color: "bg-green-100 text-green-700",  Icon: CheckCircle2 },
  Cancelled: { color: "bg-red-100 text-red-700",      Icon: XCircle },
};

const TYPE_COLOR: Record<string, string> = {
  Style:  "bg-indigo-50 text-indigo-700",
  Swatch: "bg-purple-50 text-purple-700",
};

interface Reservation {
  id: number;
  item_id: number;
  inventory_id: number;
  item_name: string;
  item_code: string;
  unit_type: string | null;
  reservation_type: string;
  reference_id: number;
  reference_code: string | null;
  reference_name: string | null;
  reserved_quantity: string;
  status: string;
  remarks: string | null;
  reserved_by: string | null;
  reservation_date: string;
  available_stock: string;
  created_at: string;
}

interface InvItem {
  id: number;
  item_name: string;
  item_code: string;
  unit_type: string | null;
  available_stock: string;
}

interface OrderOption {
  id: number;
  orderCode: string;
  label: string;
  clientName: string | null;
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function StatusBadge({ s }: { s: string }) {
  const meta = STATUS_META[s] ?? { color: "bg-gray-100 text-gray-600", Icon: Bookmark };
  const { color, Icon } = meta;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${color}`}>
      <Icon className="h-3 w-3" />{s.toUpperCase()}
    </span>
  );
}

export default function Reservations() {
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

  const [rows, setRows]     = useState<Reservation[]>([]);
  const [total, setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage]     = useState(1);
  const limit = 20;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const [search,          setSearch]          = useState("");
  const [reservationType, setReservationType] = useState("all");
  const [status,          setStatus]          = useState("all");
  const [fromDate,        setFromDate]        = useState("");
  const [toDate,          setToDate]          = useState("");

  const [openActionId, setOpenActionId] = useState<number | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const [actioning, setActioning] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ resv: Reservation; action: "release" | "cancel" | "delete" } | null>(null);
  const [convertModal, setConvertModal] = useState<{
    resv: Reservation; consumed: string; released: string; wastage: string; submitting: boolean;
  } | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [invItems, setInvItems] = useState<InvItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [styleOrders, setStyleOrders] = useState<OrderOption[]>([]);
  const [swatchOrders, setSwatchOrders] = useState<OrderOption[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [form, setForm] = useState({
    inventoryId: "" as number | "",
    reservationType: "Style",
    referenceId: "",
    reservedQuantity: "",
    remarks: "",
    reservationDate: new Date().toISOString().slice(0, 10),
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (isError) navigate("/login"); }, [isError, navigate]);

  useEffect(() => {
    if (!openActionId) return;
    const handler = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setOpenActionId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openActionId]);

  const buildQs = useCallback(() => {
    const p = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search)               p.set("search",          search);
    if (reservationType !== "all") p.set("reservationType", reservationType);
    if (status !== "all")     p.set("status",           status);
    if (fromDate)             p.set("fromDate",         fromDate);
    if (toDate)               p.set("toDate",           toDate);
    return p.toString();
  }, [search, reservationType, status, fromDate, toDate, page]);

  const loadData = useCallback(() => {
    if (!token) return;
    setLoading(true);
    customFetch(`/api/inventory/reservations?${buildQs()}&_t=${Date.now()}`)
      .then((r: unknown) => {
        const d = r as { rows: Reservation[]; total: number };
        setRows(d.rows);
        setTotal(d.total);
      })
      .catch(() => toast({ title: "Failed to load reservations", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [token, buildQs, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadInvItems = () => {
    if (!token || invItems.length) return;
    setLoadingItems(true);
    customFetch(`/api/inventory/items?limit=500&_t=${Date.now()}`)
      .then((r: unknown) => {
        const d = r as { data: InvItem[] };
        setInvItems(d.data ?? []);
      })
      .catch(() => {})
      .finally(() => setLoadingItems(false));
  };

  const loadOrders = () => {
    if (!token || (styleOrders.length && swatchOrders.length)) return;
    setLoadingOrders(true);
    Promise.all([
      customFetch(`/api/style-orders?limit=500&_t=${Date.now()}`),
      customFetch(`/api/swatch-orders?limit=500&_t=${Date.now()}`),
    ])
      .then(([sr, sw]) => {
        const sd = sr as { data: Array<{ id: number; orderCode: string; styleName: string; clientName: string | null }> };
        const wd = sw as { data: Array<{ id: number; orderCode: string; swatchName: string; clientName: string | null }> };
        setStyleOrders((sd.data ?? []).map(o => ({ id: o.id, orderCode: o.orderCode, label: o.styleName, clientName: o.clientName })));
        setSwatchOrders((wd.data ?? []).map(o => ({ id: o.id, orderCode: o.orderCode, label: o.swatchName, clientName: o.clientName })));
      })
      .catch(() => {})
      .finally(() => setLoadingOrders(false));
  };

  const openForm = () => { loadInvItems(); loadOrders(); setShowForm(true); };

  const handleSubmit = async () => {
    if (!form.inventoryId || !form.referenceId || !form.reservedQuantity || !form.reservationDate) {
      toast({ title: "Please fill all required fields", variant: "destructive" }); return;
    }
    setSubmitting(true);
    try {
      await customFetch("/api/inventory/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventoryId: Number(form.inventoryId),
          reservationType: form.reservationType,
          referenceId: Number(form.referenceId),
          reservedQuantity: form.reservedQuantity,
          remarks: form.remarks || null,
          reservationDate: form.reservationDate,
        }),
      });
      toast({ title: "Reservation created successfully" });
      setShowForm(false);
      setForm({ inventoryId: "", reservationType: "Style", referenceId: "", reservedQuantity: "", remarks: "", reservationDate: new Date().toISOString().slice(0, 10) });
      loadData();
    } catch (err: any) {
      toast({ title: err?.message || "Failed to create reservation", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (resv: Reservation, action: "release" | "cancel" | "delete") => {
    setActioning(resv.id);
    try {
      if (action === "delete") {
        await customFetch(`/api/inventory/reservations/${resv.id}`, { method: "DELETE" });
      } else {
        await customFetch(`/api/inventory/reservations/${resv.id}/${action}`, { method: "PATCH" });
      }
      const labels: Record<string, string> = { release: "Released", cancel: "Cancelled", delete: "Deleted" };
      toast({ title: `Reservation ${labels[action]}` });
      setConfirmAction(null);
      loadData();
    } catch (err: any) {
      toast({ title: err?.message || `Failed to ${action}`, variant: "destructive" });
    } finally {
      setActioning(null);
    }
  };

  const handleConvert = async () => {
    if (!convertModal) return;
    const { resv, consumed, released, wastage } = convertModal;
    const c = parseFloat(consumed) || 0;
    const r = parseFloat(released) || 0;
    const w = parseFloat(wastage) || 0;
    const reserved = parseFloat(resv.reserved_quantity);
    if (Math.abs(c + r + w - reserved) > 0.001) {
      toast({ title: "Consumed + Released + Wastage must equal the reserved quantity", variant: "destructive" });
      return;
    }
    if (c < 0 || r < 0 || w < 0) {
      toast({ title: "Quantities cannot be negative", variant: "destructive" });
      return;
    }
    setConvertModal(m => m ? { ...m, submitting: true } : null);
    try {
      await customFetch(`/api/inventory/reservations/${resv.id}/convert`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consumedQty: c, releasedQty: r, wastageQty: w }),
      });
      toast({ title: "Reservation converted successfully" });
      setConvertModal(null);
      loadData();
    } catch (err: any) {
      toast({ title: err?.message || "Failed to convert reservation", variant: "destructive" });
      setConvertModal(m => m ? { ...m, submitting: false } : null);
    }
  };

  const selectedItem = invItems.find(i => i.id === Number(form.inventoryId));

  const ACTION_META: Record<string, { label: string; btnCls: string }> = {
    release: { label: "Release",  btnCls: "bg-green-600 hover:bg-green-700 text-white" },
    cancel:  { label: "Cancel",   btnCls: "bg-orange-500 hover:bg-orange-600 text-white" },
    delete:  { label: "Delete",   btnCls: "bg-red-600 hover:bg-red-700 text-white" },
  };

  return (
    <div className="min-h-screen" style={{ background: "#F8F6F0" }}>
      <TopNavbar username={(me as any)?.name ?? ""} role={(me as any)?.role ?? ""} onLogout={handleLogout} isLoggingOut={false} />
      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ background: `${G}20` }}>
              <Bookmark className="h-5 w-5" style={{ color: G }} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Material Reservations</h1>
              <p className="text-sm text-gray-500 mt-0.5">Reserve inventory for styles and swatches</p>
            </div>
          </div>
          <button onClick={openForm}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm"
            style={{ background: `linear-gradient(135deg, ${G}, #A8943E)` }}>
            <Plus className="h-4 w-4" /> New Reservation
          </button>
        </div>

        {/* Filters */}
        <div className={`${card} p-4`}>
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input type="text" placeholder="Search item name or code…" value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-8 pr-3 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30" />
            </div>

            <div className="relative">
              <select value={reservationType} onChange={e => { setReservationType(e.target.value); setPage(1); }}
                className="appearance-none pl-3 pr-8 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 bg-white min-w-[150px]">
                <option value="all">All Types</option>
                <option value="Style">Style</option>
                <option value="Swatch">Swatch</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative">
              <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
                className="appearance-none pl-3 pr-8 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 bg-white min-w-[150px]">
                <option value="all">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Released">Released</option>
                <option value="Converted">Converted</option>
                <option value="Cancelled">Cancelled</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            </div>

            <div className="flex items-center gap-1 border border-gray-200 rounded-xl px-2 py-1 bg-white">
              <CalendarRange className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
              <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }}
                className="text-xs text-gray-900 border-0 outline-none bg-transparent w-[110px]" />
              <span className="text-gray-300 text-xs">—</span>
              <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }}
                className="text-xs text-gray-900 border-0 outline-none bg-transparent w-[110px]" />
            </div>

            {(search || reservationType !== "all" || status !== "all" || fromDate || toDate) && (
              <button onClick={() => { setSearch(""); setReservationType("all"); setStatus("all"); setFromDate(""); setToDate(""); setPage(1); }}
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
                  <th className={thCls}>Reference No.</th>
                  <th className={thCls}>Reserved Qty</th>
                  <th className={thCls}>Available Stock</th>
                  <th className={thCls}>Date</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls}>Reserved By</th>
                  <th className={thCls}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={10} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-8 w-8 rounded-full border-2 border-[#C6AF4B] border-t-transparent animate-spin" />
                      <span className="text-sm text-gray-700">Loading…</span>
                    </div>
                  </td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-16 text-center">
                    <Bookmark className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-700 font-medium">No reservations found</p>
                    <p className="text-xs text-gray-400 mt-1">Create a reservation to reserve materials for a style or swatch</p>
                  </td></tr>
                ) : rows.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-[#C6AF4B]/5 transition-colors">
                    <td className={tdCls}><span className="text-xs text-gray-400">{(page-1)*limit+idx+1}</span></td>
                    <td className={tdCls}>
                      <div className="text-sm font-medium text-gray-900">{r.item_name}</div>
                      <div className="text-xs text-gray-400 font-mono">{r.item_code}</div>
                      {r.remarks && <div className="text-xs text-gray-400 italic mt-0.5">{r.remarks}</div>}
                    </td>
                    <td className={tdCls}>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${TYPE_COLOR[r.reservation_type] ?? "bg-gray-100 text-gray-600"}`}>
                        {r.reservation_type}
                      </span>
                    </td>
                    <td className={tdCls}>
                      <div className="text-sm font-mono font-semibold text-gray-800">
                        {r.reference_code ?? `#${r.reference_id}`}
                      </div>
                      {r.reference_name && (
                        <div className="text-[11px] text-gray-400 truncate max-w-[120px]">{r.reference_name}</div>
                      )}
                    </td>
                    <td className={tdCls}>
                      <span className="text-sm font-mono font-semibold" style={{ color: G }}>
                        {parseFloat(r.reserved_quantity).toFixed(3)} {r.unit_type || ""}
                      </span>
                    </td>
                    <td className={tdCls}>
                      <span className={`text-sm font-mono ${parseFloat(r.available_stock) <= 0 ? "text-red-600 font-bold" : "text-gray-700"}`}>
                        {parseFloat(r.available_stock).toFixed(3)}
                      </span>
                    </td>
                    <td className={tdCls}><span className="text-xs">{fmtDate(r.reservation_date)}</span></td>
                    <td className={tdCls}><StatusBadge s={r.status} /></td>
                    <td className={tdCls}><span className="text-xs text-gray-500">{r.reserved_by || "—"}</span></td>
                    <td className={tdCls}>
                      <div className="relative" ref={openActionId === r.id ? actionMenuRef : undefined}>
                        <button
                          onClick={() => setOpenActionId(openActionId === r.id ? null : r.id)}
                          className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>

                        {openActionId === r.id && (
                          <div className="absolute right-0 z-30 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl min-w-[160px] py-1">

                            {r.status === "Active" && (
                              <button
                                onClick={() => { setOpenActionId(null); setConvertModal({ resv: r, consumed: parseFloat(r.reserved_quantity).toFixed(3), released: "0", wastage: "0", submitting: false }); }}
                                className="w-full text-left px-3 py-2 text-xs text-blue-700 hover:bg-blue-50 flex items-center gap-2.5">
                                <ArrowRightLeft className="h-3.5 w-3.5" /> Convert
                              </button>
                            )}

                            {r.status === "Active" && isAdmin && (
                              <button
                                onClick={() => { setOpenActionId(null); setConfirmAction({ resv: r, action: "release" }); }}
                                className="w-full text-left px-3 py-2 text-xs text-green-700 hover:bg-green-50 flex items-center gap-2.5">
                                <RefreshCw className="h-3.5 w-3.5" /> Release
                              </button>
                            )}

                            {r.status === "Active" && isAdmin && (
                              <button
                                onClick={() => { setOpenActionId(null); setConfirmAction({ resv: r, action: "cancel" }); }}
                                className="w-full text-left px-3 py-2 text-xs text-orange-600 hover:bg-orange-50 flex items-center gap-2.5">
                                <XCircle className="h-3.5 w-3.5" /> Cancel
                              </button>
                            )}

                            {isAdmin && (
                              <>
                                {(r.status === "Active") && <div className="mx-2 my-1 border-t border-gray-100" />}
                                <button
                                  onClick={() => { setOpenActionId(null); setConfirmAction({ resv: r, action: "delete" }); }}
                                  className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2.5">
                                  <Trash2 className="h-3.5 w-3.5" /> Delete
                                </button>
                              </>
                            )}

                            {!isAdmin && r.status !== "Active" && (
                              <div className="px-3 py-2 text-xs text-gray-400">No actions available</div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {total > limit && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <span className="text-xs text-gray-700">
                Showing {(page-1)*limit+1}–{Math.min(page*limit, total)} of {total}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
                  className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40">
                  <ChevronDown className="h-4 w-4 text-gray-700 -rotate-90" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pg = Math.max(1, Math.min(totalPages-4, page-2)) + i;
                  return (
                    <button key={pg} onClick={() => setPage(pg)}
                      className={`min-w-[32px] h-8 rounded-lg text-xs font-medium ${pg===page ? "text-white" : "text-gray-700 hover:bg-gray-100"}`}
                      style={pg===page ? { background: G } : {}}>
                      {pg}
                    </button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}
                  className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40">
                  <ChevronDown className="h-4 w-4 text-gray-700 rotate-90" />
                </button>
              </div>
            </div>
          )}
          {total > 0 && total <= limit && (
            <div className="px-4 py-3 border-t border-gray-100">
              <span className="text-xs text-gray-500">{total} record{total !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
      </div>

      {/* New Reservation Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`${card} w-full max-w-lg`}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Bookmark className="h-5 w-5" style={{ color: G }} />
                <h2 className="text-base font-bold text-gray-900">New Reservation</h2>
              </div>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Inventory Item <span className="text-red-500">*</span></label>
                <select value={form.inventoryId}
                  onChange={e => setForm(f => ({ ...f, inventoryId: e.target.value ? parseInt(e.target.value) : "" }))}
                  className="w-full appearance-none pl-3 pr-8 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 bg-white">
                  <option value="">{loadingItems ? "Loading items…" : "Select item…"}</option>
                  {invItems.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.item_name} ({i.item_code}) — {parseFloat(i.available_stock).toFixed(3)} avail.
                    </option>
                  ))}
                </select>
                {selectedItem && (
                  <p className="text-xs mt-1 text-amber-600 font-medium">
                    Available stock: {parseFloat(selectedItem.available_stock).toFixed(3)} {selectedItem.unit_type || ""}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Reservation Type <span className="text-red-500">*</span></label>
                  <select value={form.reservationType}
                    onChange={e => setForm(f => ({ ...f, reservationType: e.target.value, referenceId: "" }))}
                    className="w-full appearance-none pl-3 pr-8 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 bg-white">
                    <option value="Style">Style</option>
                    <option value="Swatch">Swatch</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {form.reservationType === "Style" ? "Style Order" : "Swatch Order"} <span className="text-red-500">*</span>
                  </label>
                  <select value={form.referenceId}
                    onChange={e => setForm(f => ({ ...f, referenceId: e.target.value }))}
                    className="w-full appearance-none pl-3 pr-8 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 bg-white">
                    <option value="">
                      {loadingOrders ? "Loading…" : `Select ${form.reservationType === "Style" ? "style" : "swatch"} order…`}
                    </option>
                    {(form.reservationType === "Style" ? styleOrders : swatchOrders).map(o => (
                      <option key={o.id} value={o.id}>
                        {o.orderCode} — {o.label}{o.clientName ? ` (${o.clientName})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Reserved Quantity <span className="text-red-500">*</span></label>
                  <input type="number" min="0.001" step="0.001" value={form.reservedQuantity}
                    onChange={e => setForm(f => ({ ...f, reservedQuantity: e.target.value }))}
                    placeholder="0.000"
                    className={`w-full px-3 py-2 text-sm text-gray-900 rounded-xl border focus:outline-none focus:ring-2 text-right
                      ${selectedItem && parseFloat(form.reservedQuantity) > parseFloat(selectedItem.available_stock)
                        ? "border-red-400 focus:ring-red-200" : "border-gray-200 focus:ring-[#C6AF4B]/30"}`} />
                  {selectedItem && parseFloat(form.reservedQuantity) > parseFloat(selectedItem.available_stock) && (
                    <p className="text-[11px] text-red-500 mt-0.5">Exceeds available stock</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Reservation Date <span className="text-red-500">*</span></label>
                  <input type="date" value={form.reservationDate}
                    onChange={e => setForm(f => ({ ...f, reservationDate: e.target.value }))}
                    className="w-full px-3 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Remarks</label>
                <input type="text" value={form.remarks}
                  onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                  placeholder="Optional notes…"
                  className="w-full px-3 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setShowForm(false)} disabled={submitting}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: `linear-gradient(135deg, ${G}, #A8943E)` }}>
                {submitting ? "Creating…" : "Create Reservation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Confirm Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`${card} w-full max-w-sm p-6`}>
            <div className="flex items-start gap-3 mb-4">
              <div className={`p-2 rounded-lg flex-shrink-0 ${
                confirmAction.action === "delete" ? "bg-red-100" :
                confirmAction.action === "release" ? "bg-green-100" : "bg-orange-100"
              }`}>
                {confirmAction.action === "delete" ? <Trash2 className="h-5 w-5 text-red-600" /> :
                 confirmAction.action === "release" ? <RefreshCw className="h-5 w-5 text-green-600" /> :
                 <XCircle className="h-5 w-5 text-orange-600" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  {confirmAction.action === "delete" ? "Delete Reservation?" :
                   confirmAction.action === "release" ? "Release Reservation?" : "Cancel Reservation?"}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {confirmAction.resv.item_name} — {parseFloat(confirmAction.resv.reserved_quantity).toFixed(3)} {confirmAction.resv.unit_type || "units"} for {confirmAction.resv.reservation_type} {confirmAction.resv.reference_code ?? `#${confirmAction.resv.reference_id}`}.
                  {confirmAction.action === "release" && " Reserved qty will be returned to available stock."}
                  {confirmAction.action === "cancel" && " Reserved qty will be returned to available stock."}
                  {confirmAction.action === "delete" && " This will permanently remove this record."}
                </p>
              </div>
            </div>
            {confirmAction.action === "release" && !isAdmin && (
              <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg mb-3">
                <Shield className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-700">Admin permission required to release reservations.</p>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmAction(null)} disabled={actioning !== null}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50">
                No
              </button>
              <button
                onClick={() => handleAction(confirmAction.resv, confirmAction.action)}
                disabled={actioning !== null}
                className={`px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 ${ACTION_META[confirmAction.action].btnCls}`}>
                {actioning !== null ? "Processing…" : ACTION_META[confirmAction.action].label}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert to Consumption Modal */}
      {convertModal && (() => {
        const reserved = parseFloat(convertModal.resv.reserved_quantity);
        const c = parseFloat(convertModal.consumed) || 0;
        const r = parseFloat(convertModal.released) || 0;
        const w = parseFloat(convertModal.wastage) || 0;
        const allocated = c + r + w;
        const remaining = +(reserved - allocated).toFixed(3);
        const cOver = c > reserved;
        const rOver = r > reserved;
        const wOver = w > reserved;
        const valid = Math.abs(remaining) < 0.001 && c >= 0 && r >= 0 && w >= 0 && !cOver && !rOver && !wOver;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className={`${card} w-full max-w-md`}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-100">
                    <ArrowRightLeft className="h-4 w-4 text-blue-600" />
                  </div>
                  <h2 className="text-sm font-bold text-gray-900">Convert to Consumption</h2>
                </div>
                <button onClick={() => setConvertModal(null)} className="p-1.5 rounded-lg hover:bg-gray-100">
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-4">
                {/* Item info */}
                <div className="bg-gray-50 rounded-xl px-4 py-3">
                  <p className="text-sm font-semibold text-gray-900">{convertModal.resv.item_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {convertModal.resv.reservation_type} {convertModal.resv.reference_code ?? `#${convertModal.resv.reference_id}`} &middot; Reserved:{" "}
                    <span className="font-bold" style={{ color: G }}>{reserved.toFixed(3)}</span>{" "}
                    {convertModal.resv.unit_type || ""}
                  </p>
                </div>

                {/* Qty split rows */}
                <div className="space-y-3">
                  {/* Consumed */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 w-32 flex-shrink-0">
                      <div className="p-1 rounded bg-blue-50"><ArrowRightLeft className="h-3.5 w-3.5 text-blue-600" /></div>
                      <span className="text-xs font-medium text-gray-700">Consumed</span>
                    </div>
                    <input type="number" min="0" step="0.001"
                      value={convertModal.consumed}
                      onChange={e => setConvertModal(m => m ? { ...m, consumed: e.target.value } : null)}
                      className={`flex-1 px-3 py-1.5 text-sm text-gray-900 text-right rounded-lg border focus:outline-none focus:ring-2 ${cOver ? "border-red-400 focus:ring-red-200" : "border-gray-200 focus:ring-blue-200"}`} />
                    <span className="text-xs text-gray-400 w-12 flex-shrink-0">{convertModal.resv.unit_type || ""}</span>
                  </div>
                  <p className="text-[11px] text-blue-600 -mt-1 pl-36">Material actually used in production — consumption will deduct stock separately.</p>

                  {/* Released */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 w-32 flex-shrink-0">
                      <div className="p-1 rounded bg-green-50"><PackageOpen className="h-3.5 w-3.5 text-green-600" /></div>
                      <span className="text-xs font-medium text-gray-700">Released</span>
                    </div>
                    <input type="number" min="0" step="0.001"
                      value={convertModal.released}
                      onChange={e => setConvertModal(m => m ? { ...m, released: e.target.value } : null)}
                      className={`flex-1 px-3 py-1.5 text-sm text-gray-900 text-right rounded-lg border focus:outline-none focus:ring-2 ${rOver ? "border-red-400 focus:ring-red-200" : "border-gray-200 focus:ring-green-200"}`} />
                    <span className="text-xs text-gray-400 w-12 flex-shrink-0">{convertModal.resv.unit_type || ""}</span>
                  </div>
                  <p className="text-[11px] text-green-600 -mt-1 pl-36">Unused material — freed back to available stock.</p>

                  {/* Wastage */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 w-32 flex-shrink-0">
                      <div className="p-1 rounded bg-red-50"><Flame className="h-3.5 w-3.5 text-red-500" /></div>
                      <span className="text-xs font-medium text-gray-700">Wastage</span>
                    </div>
                    <input type="number" min="0" step="0.001"
                      value={convertModal.wastage}
                      onChange={e => setConvertModal(m => m ? { ...m, wastage: e.target.value } : null)}
                      className={`flex-1 px-3 py-1.5 text-sm text-gray-900 text-right rounded-lg border focus:outline-none focus:ring-2 ${wOver ? "border-red-400 focus:ring-red-200" : "border-gray-200 focus:ring-red-200"}`} />
                    <span className="text-xs text-gray-400 w-12 flex-shrink-0">{convertModal.resv.unit_type || ""}</span>
                  </div>
                  <p className="text-[11px] text-red-500 -mt-1 pl-36">Material damaged or discarded — written off from stock.</p>
                </div>

                {/* Running total */}
                <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${valid ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                  <span className="text-xs font-medium text-gray-600">Total allocated</span>
                  <span className={`text-sm font-bold ${valid ? "text-green-700" : "text-red-600"}`}>
                    {allocated.toFixed(3)} / {reserved.toFixed(3)} {convertModal.resv.unit_type || ""}
                    {!valid && remaining !== 0 && (
                      <span className="ml-1 text-[11px] font-normal">({remaining > 0 ? `${remaining.toFixed(3)} unallocated` : `${Math.abs(remaining).toFixed(3)} over`})</span>
                    )}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
                <button onClick={() => setConvertModal(null)} disabled={convertModal.submitting}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={handleConvert} disabled={!valid || convertModal.submitting}
                  className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: valid ? "linear-gradient(135deg, #3B82F6, #2563EB)" : undefined, backgroundColor: valid ? undefined : "#9CA3AF" }}>
                  {convertModal.submitting ? "Converting…" : "Confirm Conversion"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
