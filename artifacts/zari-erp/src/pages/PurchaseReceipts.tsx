import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Search, ChevronDown, ChevronLeft, ChevronRight,
  FileText, CheckCircle2, XCircle, Clock, CalendarRange,
  Trash2, Eye, X, AlertTriangle, PackageCheck, Receipt,
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
  Open:      { label: "OPEN",      color: "bg-gray-100 text-gray-700",   Icon: Clock },
  Received:  { label: "RECEIVED",  color: "bg-green-100 text-green-700", Icon: CheckCircle2 },
  Cancelled: { label: "CANCELLED", color: "bg-red-100 text-red-700",     Icon: XCircle },
};

const REF_BADGE: Record<string, { label: string; color: string }> = {
  Inventory: { label: "Inventory", color: "bg-blue-50 text-blue-700" },
  Swatch:    { label: "Swatch",    color: "bg-purple-50 text-purple-700" },
  Style:     { label: "Style",     color: "bg-indigo-50 text-indigo-700" },
  Manual:    { label: "Manual",    color: "bg-gray-100 text-gray-600" },
};

interface PR {
  id: number;
  pr_number: string;
  vendor_name: string;
  received_date: string;
  status: string;
  po_number: string | null;
  reference_type: string | null;
  po_swatch_id: number | null;
  po_style_id: number | null;
  item_count: number;
  total_qty: string;
  created_by: string | null;
  created_at: string;
  vendor_invoice_number: string | null;
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function PurchaseReceipts() {
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

  const [rows, setRows]   = useState<PR[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage]   = useState(1);
  const limit = 10;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const [poNumbers,     setPoNumbers]     = useState<string[]>([]);
  const [search,        setSearch]        = useState("");
  const [poNumber,      setPoNumber]      = useState("");
  const [status,        setStatus]        = useState("all");
  const [referenceType, setReferenceType] = useState("all");
  const [fromDate,      setFromDate]      = useState("");
  const [toDate,        setToDate]        = useState("");
  const [sort,          setSort]          = useState("newest");

  const [deleteConfirm, setDeleteConfirm] = useState<PR | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<PR | null>(null);
  const [actioning, setActioning] = useState(false);

  useEffect(() => { if (isError) navigate("/login"); }, [isError, navigate]);

  useEffect(() => {
    if (!token) return;
    customFetch(`/api/procurement/po-numbers?_t=${Date.now()}`)
      .then((r: unknown) => setPoNumbers(r as string[]))
      .catch(() => {});
  }, [token]);

  const buildQs = useCallback(() => {
    const p = new URLSearchParams({ sort, page: String(page), limit: String(limit) });
    if (search)        p.set("search",        search);
    if (poNumber)      p.set("poNumber",      poNumber);
    if (status !== "all") p.set("status",     status);
    if (referenceType !== "all") p.set("referenceType", referenceType);
    if (fromDate)      p.set("fromDate",      fromDate);
    if (toDate)        p.set("toDate",        toDate);
    return p.toString();
  }, [search, poNumber, status, referenceType, fromDate, toDate, sort, page]);

  const loadData = useCallback((bust = false) => {
    if (!token) return;
    setLoading(true);
    const ts = bust ? `&_t=${Date.now()}` : "";
    customFetch(`/api/procurement/purchase-receipts?${buildQs()}${ts}`)
      .then((r: unknown) => {
        const res = r as { data: PR[]; total: number };
        setRows(res.data);
        setTotal(res.total);
      })
      .catch(() => toast({ title: "Failed to load purchase receipts", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [token, buildQs, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCancel = async (pr: PR) => {
    setActioning(true);
    try {
      await customFetch(`/api/procurement/purchase-receipts/${pr.id}/cancel`, { method: "POST" });
      toast({ title: "Purchase receipt cancelled" });
      setCancelConfirm(null);
      loadData(true);
    } catch (e: unknown) {
      toast({ title: (e as { message?: string })?.message ?? "Failed to cancel", variant: "destructive" });
    } finally {
      setActioning(false);
    }
  };

  const handleDelete = async (pr: PR) => {
    setActioning(true);
    try {
      await customFetch(`/api/procurement/purchase-receipts/${pr.id}`, { method: "DELETE" });
      toast({ title: "Purchase receipt deleted" });
      setDeleteConfirm(null);
      loadData(true);
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    } finally {
      setActioning(false);
    }
  };

  const StatusBadge = ({ s }: { s: string }) => {
    const info = STATUS_MAP[s] ?? STATUS_MAP.Open;
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

      <div className="py-6 px-6 max-w-screen-2xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5" style={{ color: G }} />
              <h1 className="text-xl font-bold text-gray-900">Purchase Receipts</h1>
            </div>
            <p className="text-sm text-gray-700 mt-0.5">All receipts from approved purchase orders</p>
          </div>
          <button
            onClick={() => navigate("/procurement/purchase-receipts/new")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: `linear-gradient(135deg, ${G}, ${G_DIM})` }}>
            <PackageCheck className="h-4 w-4" /> New Receipt
          </button>
        </div>

        {/* Filters */}
        <div className={`${card} p-4`}>
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input type="text" placeholder="Search PR number or vendor…" value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-8 pr-3 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30" />
            </div>
            <div className="relative">
              <select value={poNumber} onChange={e => { setPoNumber(e.target.value); setPage(1); }}
                className="appearance-none pl-3 pr-8 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 bg-white min-w-[200px]">
                <option value="">All PO Numbers</option>
                {poNumbers.map(pn => (
                  <option key={pn} value={pn}>{pn}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative">
              <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
                className="appearance-none pl-3 pr-8 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 bg-white min-w-[140px]">
                <option value="all">All Status</option>
                <option value="Open">Open</option>
                <option value="Received">Received</option>
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

            <div className="flex items-center gap-1 border border-gray-200 rounded-xl px-2 py-1 bg-white">
              <CalendarRange className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
              <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }}
                className="text-xs text-gray-900 border-0 outline-none bg-transparent w-[110px]" />
              <span className="text-gray-300 text-xs">—</span>
              <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }}
                className="text-xs text-gray-900 border-0 outline-none bg-transparent w-[110px]" />
            </div>

            <div className="relative ml-auto">
              <select value={sort} onChange={e => setSort(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 bg-white">
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            </div>

            {(search || poNumber || status !== "all" || referenceType !== "all" || fromDate || toDate) && (
              <button onClick={() => { setSearch(""); setPoNumber(""); setStatus("all"); setReferenceType("all"); setFromDate(""); setToDate(""); setPage(1); }}
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
                  <th className={thCls}>PR Number</th>
                  <th className={thCls}>PO Number</th>
                  <th className={thCls}>Source</th>
                  <th className={thCls}>Vendor</th>
                  <th className={thCls}>Items</th>
                  <th className={thCls}>Total Qty</th>
                  <th className={thCls}>Date</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls}>Vendor Invoice</th>
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
                    <FileText className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-700 font-medium">No purchase receipts found</p>
                    <p className="text-xs text-gray-400 mt-1">Create a receipt from an approved purchase order</p>
                  </td></tr>
                ) : rows.map((pr, idx) => {
                  const ref = REF_BADGE[pr.reference_type ?? "Manual"] ?? REF_BADGE.Manual;
                  return (
                    <tr key={pr.id} className="hover:bg-[#C6AF4B]/5 transition-colors">
                      <td className={tdCls}><span className="text-xs text-gray-400">{(page-1)*limit+idx+1}</span></td>
                      <td className={tdCls}>
                        <button onClick={() => navigate(`/procurement/purchase-receipts/${pr.id}`)}
                          className="font-mono text-sm font-semibold hover:underline" style={{ color: G }}>
                          {pr.pr_number}
                        </button>
                      </td>
                      <td className={tdCls}>
                        {pr.po_number ? (
                          <button onClick={() => navigate(`/procurement/purchase-orders/${pr.id}`)}
                            className="font-mono text-xs text-gray-600 hover:underline">
                            {pr.po_number}
                          </button>
                        ) : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className={tdCls}>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${ref.color}`}>
                          {ref.label}
                        </span>
                      </td>
                      <td className={tdCls}><span className="text-xs">{pr.vendor_name}</span></td>
                      <td className={tdCls}>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700">
                          {pr.item_count} item{pr.item_count !== 1 ? "s" : ""}
                        </span>
                      </td>
                      <td className={tdCls}><span className="text-xs font-mono">{parseFloat(pr.total_qty || "0").toFixed(3)}</span></td>
                      <td className={tdCls}><span className="text-xs">{fmtDate(pr.received_date)}</span></td>
                      <td className={tdCls}><StatusBadge s={pr.status} /></td>
                      <td className={tdCls}>
                        {pr.vendor_invoice_number ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700">
                            <Receipt className="h-3 w-3" /> {pr.vendor_invoice_number}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className={tdCls}>
                        <div className="flex items-center gap-1">
                          <button onClick={() => navigate(`/procurement/purchase-receipts/${pr.id}`)}
                            className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors">
                            <Eye className="h-3 w-3" /> View
                          </button>
                          {pr.status !== "Cancelled" && (
                            <button onClick={() => setCancelConfirm(pr)}
                              className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border border-orange-200 text-orange-600 hover:bg-orange-50 transition-colors">
                              <XCircle className="h-3 w-3" /> Cancel
                            </button>
                          )}
                          {isAdmin && (
                            <button onClick={() => setDeleteConfirm(pr)}
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

      {/* Cancel Confirm */}
      {cancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`${card} w-full max-w-sm p-6`}>
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-orange-100 rounded-lg flex-shrink-0"><AlertTriangle className="h-5 w-5 text-orange-600" /></div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Cancel Purchase Receipt?</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Cancel <span className="font-semibold">{cancelConfirm.pr_number}</span>?
                  {cancelConfirm.status === "Received" && " This will reverse all inventory changes made by this receipt."}
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCancelConfirm(null)} disabled={actioning}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50">No</button>
              <button onClick={() => handleCancel(cancelConfirm)} disabled={actioning}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50">
                {actioning ? "Cancelling…" : "Yes, Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`${card} w-full max-w-sm p-6`}>
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-lg flex-shrink-0"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Delete Purchase Receipt?</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Permanently delete <span className="font-semibold">{deleteConfirm.pr_number}</span>?
                  {deleteConfirm.status === "Received" && " Inventory changes will be reversed."}
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
