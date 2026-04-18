import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Search, Plus, ChevronDown, ChevronLeft, ChevronRight,
  ShoppingCart, CheckCircle2, XCircle, Clock, AlertTriangle,
  Eye, Trash2, X, PackageCheck,
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

const STATUS_MAP: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  Draft:               { label: "Draft",               color: "bg-gray-100 text-gray-700",    Icon: Clock },
  Approved:            { label: "Approved",             color: "bg-blue-100 text-blue-700",    Icon: CheckCircle2 },
  "Partially Received":{ label: "Partially Received",   color: "bg-amber-100 text-amber-700",  Icon: PackageCheck },
  Closed:              { label: "Closed",               color: "bg-green-100 text-green-700",  Icon: CheckCircle2 },
  Cancelled:           { label: "Cancelled",            color: "bg-red-100 text-red-700",      Icon: XCircle },
};

const REF_BADGE: Record<string, { label: string; color: string }> = {
  Inventory: { label: "Inventory", color: "bg-blue-50 text-blue-700" },
  Swatch:    { label: "Swatch",    color: "bg-purple-50 text-purple-700" },
  Style:     { label: "Style",     color: "bg-indigo-50 text-indigo-700" },
  Manual:    { label: "Manual",    color: "bg-gray-100 text-gray-600" },
};

interface PO {
  id: number;
  po_number: string;
  vendor_name: string;
  status: string;
  reference_type: string;
  reference_id: number | null;
  po_date: string;
  item_count: number;
  total_ordered_qty: string;
  total_received_qty: string;
  created_by: string;
  created_at: string;
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function PurchaseOrderList() {
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

  const [rows, setRows]   = useState<PO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage]   = useState(1);
  const limit = 10;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const [search,        setSearch]        = useState("");
  const [status,        setStatus]        = useState("all");
  const [referenceType, setReferenceType] = useState("all");
  const [sort,          setSort]          = useState("newest");

  const [deleteConfirm, setDeleteConfirm] = useState<PO | null>(null);
  const [actioning, setActioning] = useState(false);

  useEffect(() => { if (isError) navigate("/login"); }, [isError, navigate]);

  const buildQs = useCallback(() => {
    const p = new URLSearchParams({ sort, page: String(page), limit: String(limit) });
    if (search)        p.set("search",        search);
    if (status !== "all") p.set("status",     status);
    if (referenceType !== "all") p.set("referenceType", referenceType);
    return p.toString();
  }, [search, status, referenceType, sort, page]);

  const loadData = useCallback((bust = false) => {
    if (!token) return;
    setLoading(true);
    const ts = bust ? `&_t=${Date.now()}` : "";
    customFetch(`/api/procurement/purchase-orders?${buildQs()}${ts}`)
      .then((r: unknown) => {
        const res = r as { data: PO[]; total: number };
        setRows(res.data);
        setTotal(res.total);
      })
      .catch(() => toast({ title: "Failed to load purchase orders", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [token, buildQs, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDelete = async (po: PO) => {
    setActioning(true);
    try {
      await customFetch(`/api/procurement/purchase-orders/${po.id}`, { method: "DELETE" });
      toast({ title: "Purchase Order deleted" });
      setDeleteConfirm(null);
      loadData(true);
    } catch (e: unknown) {
      toast({ title: (e as { message?: string })?.message ?? "Failed to delete", variant: "destructive" });
    } finally {
      setActioning(false);
    }
  };

  const StatusBadge = ({ s }: { s: string }) => {
    const info = STATUS_MAP[s] ?? STATUS_MAP.Draft;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${info.color}`}>
        <info.Icon className="h-3 w-3" /> {info.label}
      </span>
    );
  };

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
              <ShoppingCart className="h-5 w-5" style={{ color: G }} />
              <h1 className="text-xl font-bold text-gray-900">Purchase Orders</h1>
            </div>
            <p className="text-sm text-gray-700 mt-0.5">All procurement purchase orders across modules</p>
          </div>
          <button
            onClick={() => navigate("/procurement/purchase-orders/new")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: `linear-gradient(135deg, ${G}, ${G_DIM})` }}>
            <Plus className="h-4 w-4" /> New PO
          </button>
        </div>

        {/* Filters */}
        <div className={`${card} p-4`}>
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input type="text" placeholder="Search PO number or vendor…" value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-8 pr-3 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30" />
            </div>

            <div className="relative">
              <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
                className="appearance-none pl-3 pr-8 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 bg-white min-w-[150px]">
                <option value="all">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Approved">Approved</option>
                <option value="Partially Received">Partially Received</option>
                <option value="Closed">Closed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative">
              <select value={referenceType} onChange={e => { setReferenceType(e.target.value); setPage(1); }}
                className="appearance-none pl-3 pr-8 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 bg-white min-w-[130px]">
                <option value="all">All Sources</option>
                <option value="Inventory">Inventory</option>
                <option value="Swatch">Swatch</option>
                <option value="Style">Style</option>
                <option value="Manual">Manual</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative ml-auto">
              <select value={sort} onChange={e => setSort(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 bg-white">
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            </div>

            {(search || status !== "all" || referenceType !== "all") && (
              <button onClick={() => { setSearch(""); setStatus("all"); setReferenceType("all"); setPage(1); }}
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
                  <th className={thCls}>PO Number</th>
                  <th className={thCls}>Source</th>
                  <th className={thCls}>Vendor</th>
                  <th className={thCls}>Items</th>
                  <th className={thCls}>Ordered Qty</th>
                  <th className={thCls}>Received Qty</th>
                  <th className={thCls}>Pending Qty</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls}>Date</th>
                  <th className={thCls}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={11} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-8 w-8 rounded-full border-2 border-[#C6AF4B] border-t-transparent animate-spin" />
                      <span className="text-sm text-gray-700">Loading…</span>
                    </div>
                  </td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={11} className="px-4 py-16 text-center">
                    <ShoppingCart className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-700 font-medium">No purchase orders found</p>
                    <p className="text-xs text-gray-400 mt-1">Click "New PO" to create a purchase order</p>
                  </td></tr>
                ) : rows.map((po, idx) => {
                  const ref = REF_BADGE[po.reference_type] ?? REF_BADGE.Manual;
                  const ordered  = parseFloat(po.total_ordered_qty  || "0");
                  const received = parseFloat(po.total_received_qty || "0");
                  const pending  = Math.max(0, ordered - received);
                  const isCosting = po.reference_type === "Swatch" || po.reference_type === "Style";
                  return (
                    <tr key={po.id} className="hover:bg-[#C6AF4B]/5 transition-colors">
                      <td className={tdCls}><span className="text-xs text-gray-400">{(page-1)*limit+idx+1}</span></td>
                      <td className={tdCls}>
                        <button onClick={() => navigate(`/procurement/purchase-orders/${po.id}`)}
                          className="font-mono text-sm font-semibold hover:underline" style={{ color: G }}>
                          {po.po_number}
                        </button>
                      </td>
                      <td className={tdCls}>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${ref.color}`}>
                          {ref.label}
                        </span>
                        {isCosting && po.reference_id && (
                          <div className="text-[10px] text-gray-400 mt-0.5">#{po.reference_id}</div>
                        )}
                      </td>
                      <td className={tdCls}><span className="text-xs">{po.vendor_name}</span></td>
                      <td className={tdCls}>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700">
                          {po.item_count} item{po.item_count !== 1 ? "s" : ""}
                        </span>
                      </td>
                      <td className={tdCls}><span className="text-xs font-mono">{ordered.toFixed(3)}</span></td>
                      <td className={tdCls}><span className="text-xs font-mono text-green-700">{received.toFixed(3)}</span></td>
                      <td className={tdCls}>
                        <span className={`text-xs font-mono font-semibold ${pending > 0 ? "text-amber-600" : "text-gray-400"}`}>
                          {pending.toFixed(3)}
                        </span>
                      </td>
                      <td className={tdCls}><StatusBadge s={po.status} /></td>
                      <td className={tdCls}><span className="text-xs">{fmtDate(po.po_date ?? po.created_at)}</span></td>
                      <td className={tdCls}>
                        <div className="flex items-center gap-1">
                          <button onClick={() => navigate(`/procurement/purchase-orders/${po.id}`)}
                            className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors">
                            <Eye className="h-3 w-3" /> View
                          </button>
                          {isAdmin && po.status === "Draft" && (
                            <button onClick={() => setDeleteConfirm(po)}
                              className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {total > limit && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <span className="text-xs text-gray-700">
                Showing {(page-1)*limit+1}–{Math.min(page*limit,total)} of {total}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
                  className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40">
                  <ChevronLeft className="h-4 w-4 text-gray-700" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pg = Math.max(1, Math.min(totalPages-4, page-2)) + i;
                  return (
                    <button key={pg} onClick={() => setPage(pg)}
                      className={`min-w-[32px] h-8 rounded-lg text-xs font-medium transition-colors ${pg===page ? "text-white" : "text-gray-700 hover:bg-gray-100"}`}
                      style={pg===page ? { background: G } : {}}>
                      {pg}
                    </button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}
                  className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40">
                  <ChevronRight className="h-4 w-4 text-gray-700" />
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

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`${card} w-full max-w-sm p-6`}>
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-lg flex-shrink-0"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Delete Purchase Order?</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Permanently delete <span className="font-semibold">{deleteConfirm.po_number}</span>?
                  This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(null)} disabled={actioning}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} disabled={actioning}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">
                {actioning ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
