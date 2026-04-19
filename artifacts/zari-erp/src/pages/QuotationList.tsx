import { useState, useEffect, Fragment } from "react";
import { useLocation } from "wouter";
import {
  Search, Plus, ChevronLeft, ChevronRight, FileText,
  Eye, Edit2, Trash2, RefreshCw, ChevronDown, ChevronUp,
  CheckCircle2, GitBranch,
} from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import AppLayout from "@/components/layout/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { useAllClients } from "@/hooks/useClients";

const G = "#C6AF4B";
const card = "rounded-2xl bg-white border border-[#C6AF4B]/15 shadow-[0_2px_16px_rgba(198,175,75,0.12),0_1px_3px_rgba(0,0,0,0.06)]";
const thCls = "px-3 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide whitespace-nowrap";
const tdCls = "px-3 py-3 align-middle text-sm";
const inputCls = "w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 text-gray-900 bg-white";

const STATUS_COLORS: Record<string, string> = {
  "Draft":                 "bg-gray-100 text-gray-600",
  "Sent":                  "bg-blue-100 text-blue-700",
  "Client Reviewing":      "bg-indigo-100 text-indigo-700",
  "Correction Requested":  "bg-yellow-100 text-yellow-700",
  "Revised":               "bg-amber-100 text-amber-700",
  "Approved":              "bg-emerald-100 text-emerald-700",
  "Rejected":              "bg-red-100 text-red-600",
  "Converted to Style":    "bg-purple-100 text-purple-700",
  "Converted to Swatch":   "bg-teal-100 text-teal-700",
};

const ALL_STATUSES = [
  "Draft", "Sent", "Client Reviewing", "Correction Requested",
  "Revised", "Approved", "Rejected", "Converted to Style", "Converted to Swatch",
];

interface QuotRow {
  id: number;
  quotation_number: string;
  client_id: number | null;
  client_name: string | null;
  requirement_summary: string | null;
  total_amount: string;
  status: string;
  latest_status: string;
  has_approval: boolean;
  revision_count: number;
  design_count: number;
  created_at: string;
}

interface RevisionRow {
  id: number;
  quotation_number: string;
  revision_number: number;
  status: string;
  total_amount: string;
  created_at: string;
}

export default function QuotationList() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const token = localStorage.getItem("zarierp_token");
  const { data: user, isLoading: loadingUser } = useGetMe({ enabled: !!token });
  const logoutMutation = useLogout();
  const { data: allClients = [] } = useAllClients();

  const [rows, setRows] = useState<QuotRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;
  const [refreshKey, setRefreshKey] = useState(0);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [clientFilter, setClientFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [revisions, setRevisions] = useState<RevisionRow[]>([]);
  const [loadingRevisions, setLoadingRevisions] = useState(false);

  const isAdmin = user?.role === "admin";
  const refresh = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({
      search, status, fromDate, toDate,
      page: String(page), limit: String(limit),
    });
    if (clientFilter) params.set("clientId", clientFilter);
    customFetch<{ data: QuotRow[]; total: number }>(`/api/quotations?${params}`)
      .then((j) => { if (cancelled) return; setRows(j.data ?? []); setTotal(j.total ?? 0); })
      .catch(() => !cancelled && setRows([]))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [search, status, clientFilter, fromDate, toDate, page, refreshKey]);

  async function toggleExpand(row: QuotRow) {
    if (expandedId === row.id) { setExpandedId(null); setRevisions([]); return; }
    setExpandedId(row.id);
    setRevisions([]);
    setLoadingRevisions(true);
    try {
      const j = await customFetch<{ data: any }>(`/api/quotations/${row.id}`);
      const allRevs: RevisionRow[] = (j.data?.revisions ?? []).map((r: any) => ({
        id: r.id,
        quotation_number: r.quotation_number,
        revision_number: r.revision_number,
        status: r.status,
        total_amount: r.total_amount,
        created_at: r.created_at,
      }));
      setRevisions(allRevs.sort((a, b) => a.revision_number - b.revision_number));
    } catch { setRevisions([]); }
    finally { setLoadingRevisions(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await customFetch(`/api/quotations/${deleteId}`, { method: "DELETE" });
      toast({ title: "Deleted", description: "Quotation deleted." });
      setDeleteId(null);
      if (expandedId === deleteId) { setExpandedId(null); setRevisions([]); }
      refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setDeleting(false); }
  }

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        localStorage.removeItem("zarierp_token");
        qc.removeQueries({ queryKey: getGetMeQueryKey() });
        navigate("/login");
      },
    });
  }

  if (loadingUser) return null;
  if (!user) { navigate("/login"); return null; }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const fmt = (v: string | number | null) => {
    const n = parseFloat(String(v ?? 0));
    return isNaN(n) ? "₹0.00" : `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  };
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <div className="max-w-screen-xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quotations</h1>
            <p className="text-sm text-gray-500 mt-0.5">{total} quotation{total !== 1 ? "s" : ""}</p>
          </div>
          <button
            onClick={() => navigate("/quotation/new")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm transition"
            style={{ background: G }}
          >
            <Plus size={16} /> New Quotation
          </button>
        </div>

        {/* Filters */}
        <div className={`${card} p-4`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {/* Search */}
            <div className="relative xl:col-span-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by number or summary…"
                className={`${inputCls} pl-8`}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            {/* Client */}
            <select className={inputCls} value={clientFilter} onChange={(e) => { setClientFilter(e.target.value); setPage(1); }}>
              <option value="">All Clients</option>
              {allClients.map((c) => (
                <option key={c.id} value={String(c.id)}>{c.brandName}</option>
              ))}
            </select>
            {/* Status */}
            <select className={inputCls} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="all">All Status</option>
              {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {/* From */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">From</label>
              <input type="date" className={inputCls} value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} />
            </div>
            {/* To */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">To</label>
              <input type="date" className={inputCls} value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className={`${card} overflow-hidden`}>
          {loading && (
            <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
              <RefreshCw size={18} className="animate-spin" /> Loading…
            </div>
          )}
          {!loading && rows.length === 0 && (
            <div className="flex flex-col items-center py-16 text-gray-400 gap-2">
              <FileText size={36} strokeWidth={1.2} />
              <p className="text-sm">No quotations found</p>
              <button
                onClick={() => navigate("/quotation/new")}
                className="mt-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: G }}
              >
                Create First Quotation
              </button>
            </div>
          )}
          {!loading && rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className={thCls + " w-10 text-center"}>#</th>
                    <th className={thCls}>Quotation</th>
                    <th className={thCls}>Client</th>
                    <th className={thCls}>Summary</th>
                    <th className={thCls}>Total</th>
                    <th className={thCls}>Latest Status</th>
                    <th className={thCls + " text-center"}>Revisions</th>
                    <th className={thCls}>Created</th>
                    <th className={thCls}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const isExpanded = expandedId === row.id;
                    const srNo = (page - 1) * limit + idx + 1;
                    return (
                      <Fragment key={row.id}>
                        {/* ── Main row ── */}
                        <tr className={`border-b border-gray-100 transition-colors ${isExpanded ? "bg-[#C6AF4B]/[0.05]" : "hover:bg-[#C6AF4B]/[0.03]"}`}>
                          {/* Sr */}
                          <td className={tdCls + " text-center text-gray-400 font-mono text-xs"}>{srNo}</td>
                          {/* Quotation # */}
                          <td className={tdCls}>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => navigate(`/quotation/${row.id}`)}
                                className="font-mono font-semibold text-[#C6AF4B] hover:underline text-sm"
                              >
                                {row.quotation_number}
                              </button>
                              {row.has_approval && (
                                <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" title="Has an approved revision" />
                              )}
                            </div>
                          </td>
                          {/* Client */}
                          <td className={tdCls}>
                            <span className="text-gray-800">{row.client_name || <span className="text-gray-400 italic">—</span>}</span>
                          </td>
                          {/* Summary */}
                          <td className={tdCls}>
                            <span className="text-gray-600 line-clamp-2 max-w-[180px] block">
                              {row.requirement_summary || <span className="text-gray-400 italic">—</span>}
                            </span>
                          </td>
                          {/* Total */}
                          <td className={tdCls}>
                            <span className="font-semibold text-gray-900">{fmt(row.total_amount)}</span>
                          </td>
                          {/* Latest status */}
                          <td className={tdCls}>
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[row.latest_status ?? row.status] ?? "bg-gray-100 text-gray-600"}`}>
                              {row.latest_status ?? row.status}
                            </span>
                          </td>
                          {/* Revisions */}
                          <td className={tdCls + " text-center"}>
                            <button
                              onClick={() => toggleExpand(row)}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition ${
                                isExpanded
                                  ? "bg-[#C6AF4B]/20 text-[#C6AF4B]"
                                  : "bg-gray-100 text-gray-600 hover:bg-[#C6AF4B]/10 hover:text-[#C6AF4B]"
                              }`}
                              title={isExpanded ? "Collapse revisions" : "View revisions"}
                            >
                              <GitBranch size={11} />
                              {row.revision_count}
                              {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                            </button>
                          </td>
                          {/* Date */}
                          <td className={tdCls}>
                            <span className="text-gray-500 text-xs">{fmtDate(row.created_at)}</span>
                          </td>
                          {/* Actions */}
                          <td className={tdCls}>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => navigate(`/quotation/${row.id}`)}
                                className="p-1.5 rounded-lg hover:bg-[#C6AF4B]/10 text-gray-500 hover:text-[#C6AF4B] transition"
                                title="View"
                              >
                                <Eye size={15} />
                              </button>
                              {(row.status === "Draft" || row.status === "Revised") && (
                                <button
                                  onClick={() => navigate(`/quotation/${row.id}/edit`)}
                                  className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-500 hover:text-blue-600 transition"
                                  title="Edit"
                                >
                                  <Edit2 size={15} />
                                </button>
                              )}
                              {isAdmin && (
                                <button
                                  onClick={() => setDeleteId(row.id)}
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-500 transition"
                                  title="Delete"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* ── Revisions sub-panel ── */}
                        {isExpanded && (
                          <tr key={`${row.id}-revisions`} className="border-b border-gray-100">
                            <td colSpan={9} className="px-0 py-0">
                              <div className="bg-gray-50/70 border-t border-[#C6AF4B]/10 px-6 py-3">
                                {loadingRevisions ? (
                                  <div className="flex items-center gap-2 py-3 text-gray-400 text-xs">
                                    <RefreshCw size={13} className="animate-spin" /> Loading revisions…
                                  </div>
                                ) : revisions.length === 0 ? (
                                  <p className="text-xs text-gray-400 py-2">No revisions found.</p>
                                ) : (
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-gray-500 font-semibold uppercase tracking-wide">
                                        <th className="text-left pb-2 pr-4 w-8">Rev</th>
                                        <th className="text-left pb-2 pr-4">Quotation #</th>
                                        <th className="text-left pb-2 pr-4">Status</th>
                                        <th className="text-left pb-2 pr-4">Total</th>
                                        <th className="text-left pb-2 pr-4">Date</th>
                                        <th className="text-left pb-2">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {revisions.map((rev) => {
                                        const isApproved = rev.status === "Approved";
                                        return (
                                          <tr key={rev.id} className={`border-t border-gray-100 ${isApproved ? "bg-emerald-50/60" : ""}`}>
                                            <td className="py-2 pr-4 text-gray-500 font-mono">R{rev.revision_number}</td>
                                            <td className="py-2 pr-4">
                                              <button
                                                onClick={() => navigate(`/quotation/${rev.id}`)}
                                                className="font-mono font-semibold text-[#C6AF4B] hover:underline"
                                              >
                                                {rev.quotation_number}
                                              </button>
                                            </td>
                                            <td className="py-2 pr-4">
                                              <div className="flex items-center gap-1.5">
                                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[rev.status] ?? "bg-gray-100 text-gray-600"}`}>
                                                  {rev.status}
                                                </span>
                                                {isApproved && (
                                                  <CheckCircle2 size={12} className="text-emerald-600" title="Client Approved" />
                                                )}
                                              </div>
                                            </td>
                                            <td className="py-2 pr-4 font-semibold text-gray-800">{fmt(rev.total_amount)}</td>
                                            <td className="py-2 pr-4 text-gray-500">{fmtDate(rev.created_at)}</td>
                                            <td className="py-2">
                                              <div className="flex items-center gap-1">
                                                <button
                                                  onClick={() => navigate(`/quotation/${rev.id}`)}
                                                  className="p-1 rounded hover:bg-[#C6AF4B]/10 text-gray-500 hover:text-[#C6AF4B] transition"
                                                  title="View"
                                                >
                                                  <Eye size={13} />
                                                </button>
                                                {(rev.status === "Draft" || rev.status === "Revised") && (
                                                  <button
                                                    onClick={() => navigate(`/quotation/${rev.id}/edit`)}
                                                    className="p-1 rounded hover:bg-blue-50 text-gray-500 hover:text-blue-600 transition"
                                                    title="Edit"
                                                  >
                                                    <Edit2 size={13} />
                                                  </button>
                                                )}
                                                {isAdmin && (
                                                  <button
                                                    onClick={() => setDeleteId(rev.id)}
                                                    className="p-1 rounded hover:bg-red-50 text-gray-500 hover:text-red-500 transition"
                                                    title="Delete"
                                                  >
                                                    <Trash2 size={13} />
                                                  </button>
                                                )}
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <span className="text-xs text-gray-500">Page {page} of {totalPages} · {total} total</span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className={`${card} max-w-sm w-full p-6`}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Quotation?</h3>
            <p className="text-sm text-gray-600 mb-5">This action cannot be undone. All designs, charges and feedback will be deleted.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-500 text-white hover:bg-red-600 disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
