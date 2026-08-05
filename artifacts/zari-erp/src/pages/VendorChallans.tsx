import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus, Search, X, CheckCircle, XCircle, ArrowRight,
  FileText, ChevronLeft, ChevronRight, Loader2, RefreshCw, Pencil,
} from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import TopNavbar from "@/components/layout/TopNavbar";
import { useMyPermissions } from "@/hooks/useMyPermissions";
import { useFormAccessContext } from "@/contexts/FormAccessContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useToast } from "@/hooks/use-toast";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

const CHALLAN_TYPES = [
  "Material", "Artwork", "Outsource",
  "Toile Artisan", "Pattern Artisan", "Custom Artisan",
  "Packing", "Shipping", "Other Expense",
];
// Only statuses the system actually assigns are offered as filters.
const STATUS_FILTER_OPTIONS = ["Draft", "Verified", "Converted to PO", "Cancelled"];
const DURATION_OPTIONS = [
  { label: "1 Month",  value: 1 },
  { label: "3 Months", value: 3 },
  { label: "6 Months", value: 6 },
  { label: "1 Year",   value: 12 },
];

const STATUS_COLORS: Record<string, string> = {
  "Draft":           "bg-gray-100 text-gray-600",
  "Verified":        "bg-blue-100 text-blue-700",
  "Converted to PO": "bg-violet-100 text-violet-700",
  "Converted to PR": "bg-indigo-100 text-indigo-700",
  "Billed":          "bg-amber-100 text-amber-700",
  "Paid":            "bg-green-100 text-green-700",
  "Cancelled":       "bg-red-100 text-red-600",
};

type Challan = {
  id: number;
  challan_number: string;
  challan_date: string;
  vendor_name: string;
  challan_type: string;
  description: string;
  amount: string;
  status: string;
  linked_po_number: string | null;
  linked_pr_number: string | null;
};

type Vendor = { id: number; brandName: string };

function authHeaders() {
  const token = localStorage.getItem("zarierp_token");
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}${path}`, { ...opts, headers: { ...authHeaders(), ...(opts?.headers ?? {}) } });
  return r;
}

export default function VendorChallans() {
  const { fmt, currency: dc } = useCurrency();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user } = useGetMe();
  const logoutMutation = useLogout();
  const { can } = useMyPermissions();
  const { canEdit, canDelete } = useFormAccessContext();
  const { toast } = useToast();

  async function handleLogout() {
    await logoutMutation.mutateAsync();
    queryClient.removeQueries({ queryKey: getGetMeQueryKey() });
    setLocation("/login");
  }

  const [challans, setChallans]     = useState<Challan[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(false);

  const [search, setSearch]         = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom]     = useState("");
  const [dateTo, setDateTo]         = useState("");

  const [vendors, setVendors]       = useState<Vendor[]>([]);
  const [actionId, setActionId]     = useState<number | null>(null);

  // Row selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Cancel confirmation modal
  const [cancelTarget, setCancelTarget] = useState<number | null>(null);

  // Bulk convert modal state
  const [bulkConvertOpen, setBulkConvertOpen] = useState(false);
  const [bulkConverting, setBulkConverting]   = useState(false);
  const [bulkError, setBulkError]             = useState("");
  const [bulkSuccess, setBulkSuccess]         = useState("");

  // Legacy filter-based convert modal
  const [convertOpen, setConvertOpen]   = useState(false);
  const [cvVendorId, setCvVendorId]     = useState("");
  const [cvType, setCvType]             = useState("");
  const [cvDuration, setCvDuration]     = useState(1);
  const [cvPreview, setCvPreview]       = useState<Challan[]>([]);
  const [cvPreviewing, setCvPreviewing] = useState(false);
  const [cvConverting, setCvConverting] = useState(false);
  const [cvSuccess, setCvSuccess]       = useState("");
  const [cvError, setCvError]           = useState("");

  // Challan Deletion States
  const [deleteChallan, setDeleteChallan] = useState<{ id: number; number: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const LIMIT = 20;

  const fetchVendors = useCallback(async () => {
    const r = await apiFetch("/api/vendors/all");
    if (r.ok) { const d = await r.json(); setVendors(d); }
  }, []);

  const dateRangeInvalid = !!(dateFrom && dateTo && dateFrom > dateTo);

  const fetchChallans = useCallback(async () => {
    if (dateFrom && dateTo && dateFrom > dateTo) { setChallans([]); setTotal(0); return; }
    setLoading(true);
    const params = new URLSearchParams({
      search, vendor: vendorFilter, challanType: typeFilter, status: statusFilter,
      dateFrom, dateTo, page: String(page), limit: String(LIMIT),
    });
    const r = await apiFetch(`/api/vendor-challans?${params}`);
    if (r.ok) { const d = await r.json(); setChallans(d.data); setTotal(d.total); }
    setLoading(false);
  }, [search, vendorFilter, typeFilter, statusFilter, dateFrom, dateTo, page]);

  useEffect(() => { void fetchVendors(); }, [fetchVendors]);
  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [search, vendorFilter, typeFilter, statusFilter, dateFrom, dateTo]);
  useEffect(() => { void fetchChallans(); }, [fetchChallans]);

  async function handleVerify(id: number) {
    setActionId(id);
    const r = await apiFetch(`/api/vendor-challans/${id}/verify`, { method: "PATCH" });
    if (r.ok) void fetchChallans();
    else { const e = await r.json(); alert(e.error ?? "Failed to verify"); }
    setActionId(null);
  }

  async function confirmCancel() {
    if (cancelTarget == null) return;
    const id = cancelTarget;
    setActionId(id);
    const r = await apiFetch(`/api/vendor-challans/${id}/cancel`, { method: "PATCH" });
    if (r.ok) void fetchChallans();
    else { const e = await r.json(); alert(e.error ?? "Failed to cancel"); }
    setActionId(null);
    setCancelTarget(null);
  }

  const handleDelete = (id: number, number: string) => {
    setDeleteChallan({ id, number });
  };

  const confirmDelete = async () => {
    if (!deleteChallan) return;
    setIsDeleting(true);

    try {
      await apiFetch(`/api/vendor-challans/${deleteChallan.id}`, { method: "DELETE" });
      toast({ title: "Challan deleted" });
      setDeleteChallan(null);
      void fetchChallans();
    } catch {
      toast({ title: "Failed to delete challan", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  // Selection helpers
  function toggleRow(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Only Verified challans can be selected for conversion to a PO.
  const selectableIds = challans.filter(c => c.status === "Verified").map(c => c.id);
  const allPageSelected = selectableIds.length > 0 && selectableIds.every(id => selectedIds.has(id));
  const somePageSelected = selectableIds.some(id => selectedIds.has(id));

  function toggleSelectAll() {
    if (allPageSelected) {
      setSelectedIds(prev => { const next = new Set(prev); selectableIds.forEach(id => next.delete(id)); return next; });
    } else {
      setSelectedIds(prev => { const next = new Set(prev); selectableIds.forEach(id => next.add(id)); return next; });
    }
  }

  const selectedChallans = challans.filter(c => selectedIds.has(c.id));
  const selectedTotal = selectedChallans.reduce((s, c) => s + parseFloat(c.amount ?? "0"), 0);

  // Bulk convert
  async function handleBulkConvert() {
    setBulkConverting(true); setBulkError(""); setBulkSuccess("");
    const r = await apiFetch("/api/vendor-challans/convert-selected-to-po", {
      method: "POST",
      body: JSON.stringify({ challanIds: [...selectedIds] }),
    });
    const d = await r.json();
    if (r.ok) {
      setBulkSuccess(`${d.message} — PO #${d.poNumber} created`);
      setSelectedIds(new Set());
      void fetchChallans();
    } else {
      setBulkError(d.error ?? "Failed to convert");
    }
    setBulkConverting(false);
  }

  function closeBulkConvert() {
    setBulkConvertOpen(false); setBulkError(""); setBulkSuccess("");
  }

  // Legacy filter-based convert
  async function handlePreviewPO() {
    if (!cvVendorId || !cvType) { setCvError("Select a vendor and challan type"); return; }
    setCvError(""); setCvPreviewing(true); setCvPreview([]);
    const r = await apiFetch("/api/vendor-challans/preview-po", {
      method: "POST",
      body: JSON.stringify({ vendorId: parseInt(cvVendorId, 10), challanType: cvType, durationMonths: cvDuration }),
    });
    const d = await r.json();
    if (r.ok) { setCvPreview(d.data); if (!d.data.length) setCvError("No eligible Verified challans found for this selection."); }
    else setCvError(d.error ?? "Failed to preview");
    setCvPreviewing(false);
  }

  async function handleConvertToPO() {
    if (!cvPreview.length) return;
    setCvConverting(true); setCvError(""); setCvSuccess("");
    const vendorObj = vendors.find(v => String(v.id) === cvVendorId);
    const r = await apiFetch("/api/vendor-challans/convert-to-po", {
      method: "POST",
      body: JSON.stringify({ vendorId: parseInt(cvVendorId, 10), vendorName: vendorObj?.brandName ?? "", challanType: cvType, durationMonths: cvDuration }),
    });
    const d = await r.json();
    if (r.ok) {
      setCvSuccess(`${d.message} — PO #${d.poNumber} created`);
      void fetchChallans();
      setCvPreview([]);
    } else setCvError(d.error ?? "Failed to convert");
    setCvConverting(false);
  }

  function resetConvert() {
    setCvVendorId(""); setCvType(""); setCvDuration(1); setCvPreview([]);
    setCvError(""); setCvSuccess(""); setConvertOpen(false);
  }

  const totalPages = Math.ceil(total / LIMIT);
  const hasFilters = search || vendorFilter || typeFilter || statusFilter || dateFrom || dateTo;

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavbar
        username={(user as any)?.name ?? (user as any)?.username ?? ""}
        role={(user as any)?.role ?? ""}
        onLogout={handleLogout}
        isLoggingOut={logoutMutation.isPending}
      />

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Vendor Challans</h1>
            <p className="text-sm text-gray-500 mt-0.5">Daily vendor challan entries before PO creation</p>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              <button onClick={() => setConvertOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-colors">
                <ArrowRight className="h-4 w-4" /> Convert to PO
              </button>
              <button onClick={() => setLocation("/procurement/vendor-challans/new")}
                style={{ background: "linear-gradient(135deg, #C6AF4B, #a8922e)" }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-[#111827] transition-all shadow-sm">
                <Plus className="h-4 w-4" /> New Challan
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search challan, vendor, description…"
              className="pl-9 pr-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-xl w-full focus:outline-none focus:ring-2 focus:ring-gray-300 placeholder-gray-400" />
          </div>
          <select value={vendorFilter} onChange={e => setVendorFilter(e.target.value)}
            className="px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300 min-w-36">
            <option value="">All Vendors</option>
            {vendors.map(v => <option key={v.id} value={String(v.id)}>{v.brandName}</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300 min-w-36">
            <option value="">All Types</option>
            {CHALLAN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300 min-w-36">
            <option value="">All Statuses</option>
            {STATUS_FILTER_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <input type="date" value={dateFrom} max={dateTo || undefined} onChange={e => setDateFrom(e.target.value)}
                className={`px-3 py-2 text-sm text-gray-900 border rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300 ${dateRangeInvalid ? "border-red-400" : "border-gray-200"}`} />
              <span className="text-gray-400 text-xs">to</span>
              <input type="date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)}
                className={`px-3 py-2 text-sm text-gray-900 border rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300 ${dateRangeInvalid ? "border-red-400" : "border-gray-200"}`} />
            </div>
            {dateRangeInvalid && (
              <span className="text-xs text-red-600">"From" date must be on or before "To" date</span>
            )}
          </div>
          {hasFilters && (
            <button onClick={() => { setSearch(""); setVendorFilter(""); setTypeFilter(""); setStatusFilter(""); setDateFrom(""); setDateTo(""); }}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100 border border-gray-200 transition-colors">
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
          <button onClick={fetchChallans} className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Table */}
        <div className="mt-4 bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading…
            </div>
          ) : challans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
              <FileText className="h-10 w-10 text-gray-200" />
              <p className="text-sm">No challans found</p>
              <button onClick={() => setLocation("/procurement/vendor-challans/new")}
                className="text-sm text-gray-700 underline">Create your first challan</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {/* Select-all checkbox */}
                    <th className="pl-4 pr-2 py-3 w-8">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        ref={el => { if (el) el.indeterminate = somePageSelected && !allPageSelected; }}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-gray-300 accent-gray-800 cursor-pointer"
                      />
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-12">Sr.</th>
                    {["Challan #", "Date", "Vendor", "Type", "Description", "Amount", "Status", "Linked PO", "Linked PR", "Actions"]
                    .filter((h) => h !== "Actions" || canEdit)
                    .map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))
                    }
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {challans.map((ch, idx) => {
                    const isSelected = selectedIds.has(ch.id);
                    return (
                      <tr key={ch.id}
                        className={`transition-colors group ${isSelected ? "bg-blue-50/60" : "hover:bg-gray-50"}`}>
                        {/* Checkbox — only Verified challans can be converted to a PO */}
                        <td className="pl-4 pr-2 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={ch.status !== "Verified"}
                            onChange={() => toggleRow(ch.id)}
                            title={ch.status !== "Verified" ? "Only Verified challans can be selected for conversion" : "Select challan"}
                            className="h-4 w-4 rounded border-gray-300 accent-gray-800 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                          />
                        </td>
                        {/* Sr. No. */}
                        <td className="px-3 py-3 text-xs text-gray-400 font-mono">
                          {(page - 1) * LIMIT + idx + 1}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => setLocation(`/procurement/vendor-challans/${ch.id}`)}
                            className="font-mono text-xs font-semibold text-gray-900 hover:text-[#C9B45C] transition-colors">
                            {ch.challan_number}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{ch.challan_date}</td>
                        <td className="px-4 py-3 text-xs text-gray-700 max-w-32 truncate">{ch.vendor_name ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{ch.challan_type}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 max-w-48 truncate">{ch.description ?? "—"}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-gray-900 whitespace-nowrap">
                          {ch.amount ? `${fmt(parseFloat(ch.amount))}` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[ch.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {ch.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-violet-600">{ch.linked_po_number ?? "—"}</td>
                        <td className="px-4 py-3 text-xs font-mono text-indigo-600">{ch.linked_pr_number ?? "—"}</td>
                        {canEdit && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {ch.status === "Draft" && canEdit && (
                              <button onClick={() => setLocation(`/procurement/vendor-challans/${ch.id}`)} disabled={actionId === ch.id}
                                title="Edit"
                                className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {ch.status === "Draft" && canEdit && can("procurement:vendor_challans:verify") && (
                              <button onClick={() => handleVerify(ch.id)} disabled={actionId === ch.id}
                                title="Verify"
                                className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-40">
                                {actionId === ch.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                              </button>
                            )}
                            {!["Converted to PO", "Converted to PR", "Billed", "Paid", "Cancelled"].includes(ch.status) && canEdit && (
                              <button onClick={() => setCancelTarget(ch.id)} disabled={actionId === ch.id}
                                title="Cancel"
                                className="p-1.5 rounded-lg text-orange-500 hover:bg-orange-50 transition-colors disabled:opacity-40">
                                <XCircle className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {["Draft", "Cancelled"].includes(ch.status) && canDelete && (
                              <button onClick={() => handleDelete(ch.id, ch.challan_number ?? `#${ch.id}`)} disabled={actionId === ch.id}
                                title="Delete"
                                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                        )}
                       
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {/* Delete Conform for Chalan */}
          <ConfirmModal
            open={!!deleteChallan}
            title="Delete Challan"
            message={ deleteChallan ? `Delete challan ${deleteChallan.number}?\n\nThis cannot be undone.` : ""}
            confirmLabel="Delete"
            cancelLabel="Keep"
            loading={isDeleting}
            danger={true}
            onCancel={() => setDeleteChallan(null)}
            onConfirm={confirmDelete}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>{total} total</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-100 transition-colors">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span>Page {page} of {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-100 transition-colors">
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Sticky Selection Action Bar ─────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
          <div className="flex items-center gap-4 bg-gray-900 text-white rounded-2xl shadow-2xl px-5 py-3 text-sm">
            <span className="font-medium">
              {selectedIds.size} challan{selectedIds.size !== 1 ? "s" : ""} selected
              {selectedTotal > 0 && (
                <span className="ml-2 text-[#C9B45C] font-semibold">
                  {fmt(selectedTotal)}
                </span>
              )}
            </span>
            <div className="w-px h-5 bg-white/20" />
            <button
              onClick={() => { setBulkError(""); setBulkSuccess(""); setBulkConvertOpen(true); }}
              disabled={!canEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: "linear-gradient(135deg, #C6AF4B, #a8922e)" }}>
              <ArrowRight className="h-3.5 w-3.5" /> Convert to PO
            </button>
            <button onClick={() => setSelectedIds(new Set())}
              className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Bulk Convert Confirm Modal ──────────────────────────────────────── */}
      {bulkConvertOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">Convert to Purchase Order</h2>
                <p className="text-xs text-gray-500 mt-0.5">{selectedIds.size} challan{selectedIds.size !== 1 ? "s" : ""} selected for conversion</p>
              </div>
              <button onClick={closeBulkConvert} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {bulkError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl border border-red-100">{bulkError}</p>}
              {bulkSuccess && <p className="text-xs text-green-700 bg-green-50 px-3 py-2 rounded-xl border border-green-100">{bulkSuccess}</p>}

              {!bulkSuccess && (
                <>
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                    Only <strong>Verified</strong> challans from the <strong>same vendor</strong> can be converted. Others will be rejected.
                  </p>

                  <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">Challan #</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">Vendor</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {selectedChallans.map(c => (
                          <tr key={c.id}>
                            <td className="px-3 py-2 font-mono font-semibold text-gray-900">{c.challan_number}</td>
                            <td className="px-3 py-2 text-gray-600 max-w-32 truncate">{c.vendor_name ?? "—"}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-block px-1.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-600"}`}>
                                {c.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-semibold text-gray-900 text-right">
                              {c.amount ? `${fmt(parseFloat(c.amount))}` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t border-gray-100">
                        <tr>
                          <td colSpan={3} className="px-3 py-2 text-xs font-bold text-gray-700 text-right">Total</td>
                          <td className="px-3 py-2 text-xs font-bold text-gray-900 text-right">
                            {fmt(selectedTotal)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={closeBulkConvert} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors">
                {bulkSuccess ? "Close" : "Cancel"}
              </button>
              {!bulkSuccess && (
                <button onClick={handleBulkConvert} disabled={bulkConverting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, #C6AF4B, #a8922e)" }}>
                  {bulkConverting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {bulkConverting ? "Creating PO…" : "Confirm & Create PO"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Legacy Filter-based Convert to PO Modal ─────────────────────────── */}
      {convertOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">Convert Challans to PO</h2>
                <p className="text-xs text-gray-500 mt-0.5">Consolidate Verified challans into a Purchase Order</p>
              </div>
              <button onClick={resetConvert} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Vendor *</label>
                  <select value={cvVendorId} onChange={e => { setCvVendorId(e.target.value); setCvPreview([]); setCvSuccess(""); }}
                    className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300">
                    <option value="">— Select vendor —</option>
                    {vendors.map(v => <option key={v.id} value={String(v.id)}>{v.brandName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Challan Type *</label>
                  <select value={cvType} onChange={e => { setCvType(e.target.value); setCvPreview([]); setCvSuccess(""); }}
                    className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300">
                    <option value="">— Select type —</option>
                    {CHALLAN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Duration Period</label>
                  <select value={cvDuration} onChange={e => { setCvDuration(parseInt(e.target.value, 10)); setCvPreview([]); setCvSuccess(""); }}
                    className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300">
                    {DURATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <button onClick={handlePreviewPO} disabled={cvPreviewing || !cvVendorId || !cvType}
                className="w-full py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
                {cvPreviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {cvPreviewing ? "Fetching…" : "Fetch Eligible Challans"}
              </button>

              {cvError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl border border-red-100">{cvError}</p>}
              {cvSuccess && <p className="text-xs text-green-700 bg-green-50 px-3 py-2 rounded-xl border border-green-100">{cvSuccess}</p>}

              {cvPreview.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    {cvPreview.length} challan{cvPreview.length !== 1 ? "s" : ""} found
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          {["Challan #", "Date", "Description", "Qty", "Rate", "Amount"].map(h => (
                            <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {cvPreview.map((c: any) => (
                          <tr key={c.id}>
                            <td className="px-3 py-2 font-mono font-semibold text-gray-900">{c.challan_number}</td>
                            <td className="px-3 py-2 text-gray-600">{c.challan_date}</td>
                            <td className="px-3 py-2 text-gray-600 max-w-40 truncate">{c.description ?? "—"}</td>
                            <td className="px-3 py-2 text-gray-600">{c.quantity ?? "—"}</td>
                            <td className="px-3 py-2 text-gray-600">{c.rate ?? "—"}</td>
                            <td className="px-3 py-2 font-semibold text-gray-900">
                              {c.amount ? `${fmt(parseFloat(c.amount))}` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t border-gray-100">
                        <tr>
                          <td colSpan={5} className="px-3 py-2 text-xs font-bold text-gray-700 text-right">Total</td>
                          <td className="px-3 py-2 text-xs font-bold text-gray-900">
                            {fmt(cvPreview.reduce((s, c: any) => s + parseFloat(c.amount ?? "0"), 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={resetConvert} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors">
                Close
              </button>
              <button onClick={handleConvertToPO} disabled={cvConverting || cvPreview.length === 0 || !!cvSuccess}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #C6AF4B, #a8922e)" }}>
                {cvConverting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {cvConverting ? "Creating PO…" : "Confirm & Create PO"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel challan confirmation */}
      {cancelTarget != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Cancel Challan</h3>
            </div>
            <div className="px-6 py-5 text-sm text-gray-600">
              Are you sure you want to cancel this challan? This action cannot be undone.
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setCancelTarget(null)} disabled={actionId === cancelTarget}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40">
                Keep Challan
              </button>
              <button onClick={confirmCancel} disabled={actionId === cancelTarget}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition-colors disabled:opacity-40">
                {actionId === cancelTarget ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                {actionId === cancelTarget ? "Cancelling…" : "Cancel Challan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
