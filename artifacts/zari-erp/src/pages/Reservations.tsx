import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Search, ChevronDown, CalendarRange, X, AlertTriangle,
  Bookmark, CheckCircle2, XCircle, RefreshCw, ArrowRightLeft,
  Plus, Trash2, Shield,
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

  const [actioning, setActioning] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ resv: Reservation; action: "release" | "cancel" | "convert" | "delete" } | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [invItems, setInvItems] = useState<InvItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
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
        const d = r as { rows: InvItem[] };
        setInvItems(d.rows);
      })
      .catch(() => {})
      .finally(() => setLoadingItems(false));
  };

  const openForm = () => { loadInvItems(); setShowForm(true); };

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

  const handleAction = async (resv: Reservation, action: "release" | "cancel" | "convert" | "delete") => {
    setActioning(resv.id);
    try {
      if (action === "delete") {
        await customFetch(`/api/inventory/reservations/${resv.id}`, { method: "DELETE" });
      } else {
        await customFetch(`/api/inventory/reservations/${resv.id}/${action}`, { method: "PATCH" });
      }
      const labels: Record<string, string> = { release: "Released", cancel: "Cancelled", convert: "Converted", delete: "Deleted" };
      toast({ title: `Reservation ${labels[action]}` });
      setConfirmAction(null);
      loadData();
    } catch (err: any) {
      toast({ title: err?.message || `Failed to ${action}`, variant: "destructive" });
    } finally {
      setActioning(null);
    }
  };

  const selectedItem = invItems.find(i => i.id === Number(form.inventoryId));

  const ACTION_META: Record<string, { label: string; btnCls: string }> = {
    release: { label: "Release",  btnCls: "bg-green-600 hover:bg-green-700 text-white" },
    cancel:  { label: "Cancel",   btnCls: "bg-orange-500 hover:bg-orange-600 text-white" },
    convert: { label: "Convert to Consumption", btnCls: "bg-blue-600 hover:bg-blue-700 text-white" },
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
                  <th className={thCls}>Reference ID</th>
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
                    <td className={tdCls}><span className="text-sm font-mono text-gray-700">#{r.reference_id}</span></td>
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
                      {r.status === "Active" && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {isAdmin && (
                            <button onClick={() => setConfirmAction({ resv: r, action: "release" })}
                              className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 transition-colors">
                              <RefreshCw className="h-3 w-3" /> Release
                            </button>
                          )}
                          <button onClick={() => setConfirmAction({ resv: r, action: "convert" })}
                            className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors">
                            <ArrowRightLeft className="h-3 w-3" /> Convert
                          </button>
                          {isAdmin && (
                            <>
                              <button onClick={() => setConfirmAction({ resv: r, action: "cancel" })}
                                className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border border-orange-200 text-orange-600 hover:bg-orange-50 transition-colors">
                                <XCircle className="h-3 w-3" /> Cancel
                              </button>
                              <button onClick={() => setConfirmAction({ resv: r, action: "delete" })}
                                className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                      {r.status !== "Active" && isAdmin && (
                        <button onClick={() => setConfirmAction({ resv: r, action: "delete" })}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {r.status !== "Active" && !isAdmin && (
                        <span className="text-xs text-gray-400">—</span>
                      )}
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
                    onChange={e => setForm(f => ({ ...f, reservationType: e.target.value }))}
                    className="w-full appearance-none pl-3 pr-8 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 bg-white">
                    <option value="Style">Style</option>
                    <option value="Swatch">Swatch</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Reference ID <span className="text-red-500">*</span></label>
                  <input type="number" min="1" value={form.referenceId}
                    onChange={e => setForm(f => ({ ...f, referenceId: e.target.value }))}
                    placeholder="Style or Swatch ID"
                    className="w-full px-3 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30" />
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
                confirmAction.action === "release" ? "bg-green-100" :
                confirmAction.action === "convert" ? "bg-blue-100" : "bg-orange-100"
              }`}>
                {confirmAction.action === "delete" ? <Trash2 className="h-5 w-5 text-red-600" /> :
                 confirmAction.action === "release" ? <RefreshCw className="h-5 w-5 text-green-600" /> :
                 confirmAction.action === "convert" ? <ArrowRightLeft className="h-5 w-5 text-blue-600" /> :
                 <XCircle className="h-5 w-5 text-orange-600" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  {confirmAction.action === "delete" ? "Delete Reservation?" :
                   confirmAction.action === "release" ? "Release Reservation?" :
                   confirmAction.action === "convert" ? "Convert to Consumption?" : "Cancel Reservation?"}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {confirmAction.resv.item_name} — {parseFloat(confirmAction.resv.reserved_quantity).toFixed(3)} {confirmAction.resv.unit_type || "units"} for {confirmAction.resv.reservation_type} #{confirmAction.resv.reference_id}.
                  {confirmAction.action === "release" && " Reserved qty will be returned to available stock."}
                  {confirmAction.action === "convert" && " Reserved qty will be freed. Consumption module will deduct stock separately."}
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
    </div>
  );
}
