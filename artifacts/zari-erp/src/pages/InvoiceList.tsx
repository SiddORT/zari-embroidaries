import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { Plus, Search, FileText, Filter, ChevronDown, Eye, Trash2, Edit2, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/AppLayout";
import InvoicePreviewModal from "@/components/InvoicePreviewModal";

const G = "#C6AF4B";

function customFetch<T = any>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("zarierp_token");
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  return fetch(`${base}${url}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options?.headers },
  }).then(async r => {
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);
    return j as T;
  });
}

const DIRECTIONS = ["Client", "Vendor"] as const;
const TYPES = ["Proforma", "Advance", "Partial", "Final Invoice", "Custom"] as const;
const STATUSES = ["Draft", "Generated", "Sent", "Partially Paid", "Paid", "Overdue", "Cancelled"] as const;
const REF_TYPES = ["Swatch", "Style", "Quotation", "Purchase Receipt", "Shipping", "Artwork", "Manual"] as const;

const STATUS_COLORS: Record<string, string> = {
  Draft:           "bg-gray-50 text-gray-600 border-gray-200",
  Generated:       "bg-blue-50 text-blue-700 border-blue-200",
  Sent:            "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Partially Paid":"bg-amber-50 text-amber-700 border-amber-200",
  Paid:            "bg-emerald-50 text-emerald-700 border-emerald-200",
  Overdue:         "bg-red-50 text-red-700 border-red-200",
  Cancelled:       "bg-gray-100 text-gray-400 border-gray-200",
};

const DIR_COLORS: Record<string, string> = {
  Client: "bg-purple-50 text-purple-700 border-purple-200",
  Vendor: "bg-orange-50 text-orange-700 border-orange-200",
};

function fmt(n: string | number | null | undefined) {
  const v = parseFloat(String(n ?? 0));
  return isNaN(v) ? "0.00" : v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); } catch { return d; }
}

interface Invoice {
  id: number;
  invoiceNo: string;
  invoiceDirection: string;
  invoiceType: string;
  invoiceStatus: string;
  clientName: string;
  clientId: number | null;
  vendorId: number | null;
  referenceType: string;
  referenceId: string;
  currencyCode: string;
  totalAmount: string;
  receivedAmount: string;
  pendingAmount: string;
  invoiceDate: string;
  dueDate: string;
  remarks: string;
  createdAt: string;
}

export default function InvoiceList() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterDir, setFilterDir] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterRefType, setFilterRefType] = useState("");
  const [filterOrderId, setFilterOrderId] = useState("");
  const [orderOptions, setOrderOptions] = useState<{ value: string; label: string }[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewInvId, setPreviewInvId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterDir) params.set("direction", filterDir);
      if (filterType) params.set("type", filterType);
      if (filterStatus) params.set("status", filterStatus);
      if (filterRefType) params.set("refType", filterRefType);
      if (filterOrderId.trim()) params.set("refId", filterOrderId.trim());
      const j = await customFetch<any>(`/api/invoices?${params}`);
      setInvoices(j.data ?? []);
    } catch (e: any) {
      toast({ title: "Error loading invoices", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [search, filterDir, filterType, filterStatus, filterRefType, filterOrderId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (filterRefType !== "Swatch" && filterRefType !== "Style") {
      setOrderOptions([]);
      return;
    }
    setLoadingOrders(true);
    const endpoint = filterRefType === "Swatch" ? "/api/swatch-orders?limit=200" : "/api/style-orders?limit=200";
    customFetch<any>(endpoint)
      .then(j => {
        const rows = j.data ?? [];
        const opts = filterRefType === "Swatch"
          ? rows.map((r: any) => ({ value: r.orderCode, label: `${r.orderCode} — ${r.swatchName ?? ""}`.trim() }))
          : rows.map((r: any) => ({ value: r.orderCode, label: `${r.orderCode} — ${r.styleName ?? ""}`.trim() }));
        setOrderOptions(opts);
      })
      .catch(() => setOrderOptions([]))
      .finally(() => setLoadingOrders(false));
  }, [filterRefType]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await customFetch(`/api/invoices/${deleteTarget.id}`, { method: "DELETE" });
      toast({ title: "Invoice deleted" });
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  const card = "bg-white rounded-2xl border border-gray-100 shadow-sm";
  const sel = "rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-[#C6AF4B] bg-white";

  const totalPending = invoices.reduce((s, i) => s + parseFloat(String(i.pendingAmount ?? 0)), 0);
  const totalReceived = invoices.reduce((s, i) => s + parseFloat(String(i.receivedAmount ?? 0)), 0);
  const totalValue = invoices.reduce((s, i) => s + parseFloat(String(i.totalAmount ?? 0)), 0);

  return (
    <AppLayout>
      <div className="py-6 px-6 max-w-screen-2xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Invoices</h1>
            <p className="text-sm text-gray-400 mt-0.5">Manage client & vendor invoices</p>
          </div>
          <button
            onClick={() => navigate("/accounts/invoices/new")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm transition"
            style={{ backgroundColor: G }}
          >
            <Plus size={15} /> New Invoice
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Invoice Value", val: totalValue, color: "text-gray-900" },
            { label: "Amount Received", val: totalReceived, color: "text-emerald-600" },
            { label: "Amount Pending", val: totalPending, color: "text-amber-600" },
          ].map(c => (
            <div key={c.label} className={`${card} p-4`}>
              <p className="text-xs text-gray-400 mb-1">{c.label}</p>
              <p className={`text-lg font-bold ${c.color}`}>₹{fmt(c.val)}</p>
              <p className="text-xs text-gray-300 mt-0.5">{invoices.length} invoice{invoices.length !== 1 ? "s" : ""}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className={`${card} p-4 flex flex-wrap items-center gap-3`}>
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search invoice no, client, reference…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#C6AF4B]"
            />
          </div>
          <select value={filterDir} onChange={e => setFilterDir(e.target.value)} className={sel}>
            <option value="">All Directions</option>
            {DIRECTIONS.map(d => <option key={d}>{d}</option>)}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className={sel}>
            <option value="">All Types</option>
            {TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={sel}>
            <option value="">All Status</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={filterRefType} onChange={e => { setFilterRefType(e.target.value); setFilterOrderId(""); }} className={sel}>
            <option value="">All Order Types</option>
            {REF_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
          {filterRefType && (filterRefType === "Swatch" || filterRefType === "Style") && (
            <select
              value={filterOrderId}
              onChange={e => setFilterOrderId(e.target.value)}
              disabled={loadingOrders}
              className={`${sel} min-w-[180px] ${loadingOrders ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <option value="">{loadingOrders ? "Loading orders…" : `All ${filterRefType} Orders`}</option>
              {orderOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
          {filterRefType && filterRefType !== "Swatch" && filterRefType !== "Style" && (
            <input
              value={filterOrderId}
              onChange={e => setFilterOrderId(e.target.value)}
              placeholder={`${filterRefType} reference ID…`}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-[#C6AF4B] w-44"
            />
          )}
          {(filterDir || filterType || filterStatus || filterRefType || filterOrderId || search) && (
            <button
              onClick={() => { setSearch(""); setFilterDir(""); setFilterType(""); setFilterStatus(""); setFilterRefType(""); setFilterOrderId(""); }}
              className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition"
            >
              Clear
            </button>
          )}
        </div>

        {/* Table */}
        <div className={`${card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Sr.", "Invoice No", "Direction", "Type", "Client / Vendor", "Reference", "Currency", "Total", "Received", "Pending", "Date", "Due Date", "Status", "Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      {Array.from({ length: 14 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="py-16 text-center">
                      <FileText size={40} className="mx-auto text-gray-200 mb-3" />
                      <p className="text-gray-400 text-sm">No invoices found. Create your first invoice.</p>
                      <button
                        onClick={() => navigate("/accounts/invoices/new")}
                        className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                        style={{ backgroundColor: G }}
                      >
                        <Plus size={14} /> New Invoice
                      </button>
                    </td>
                  </tr>
                ) : invoices.map((inv, idx) => (
                  <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                    <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/accounts/invoices/${inv.id}`)}
                        className="font-mono font-bold hover:underline text-sm"
                        style={{ color: G }}
                      >
                        {inv.invoiceNo}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${DIR_COLORS[inv.invoiceDirection] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                        {inv.invoiceDirection}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{inv.invoiceType}</td>
                    <td className="px-4 py-3 text-gray-700 text-xs max-w-[120px] truncate">{inv.clientName || "—"}</td>
                    <td className="px-4 py-3">
                      {inv.referenceId ? (
                        <span className="text-xs text-gray-500">
                          <span className="text-gray-300">{inv.referenceType} / </span>{inv.referenceId}
                        </span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{inv.currencyCode}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900 text-xs">₹{fmt(inv.totalAmount)}</td>
                    <td className="px-4 py-3 text-emerald-600 font-medium text-xs">₹{fmt(inv.receivedAmount)}</td>
                    <td className="px-4 py-3 text-amber-600 font-medium text-xs">₹{fmt(inv.pendingAmount)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(inv.invoiceDate)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(inv.dueDate)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[inv.invoiceStatus] ?? STATUS_COLORS.Draft}`}>
                        {inv.invoiceStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => navigate(`/accounts/invoices/${inv.id}`)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
                          title="View"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => navigate(`/accounts/invoices/${inv.id}/edit`)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => setPreviewInvId(inv.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition"
                          title="Preview & Download PDF"
                        >
                          <Printer size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(inv)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Invoice Preview / Download Modal */}
      {previewInvId !== null && (
        <InvoicePreviewModal
          invoiceId={previewInvId}
          onClose={() => setPreviewInvId(null)}
        />
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-gray-900 mb-2">Delete Invoice</h3>
            <p className="text-sm text-gray-600 mb-5">
              Are you sure you want to delete <strong>{deleteTarget.invoiceNo}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition">Cancel</button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition disabled:opacity-60"
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
