import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { Plus, Search, FileText, Eye, Trash2, Edit2, Printer, Wallet, X, Loader2, CheckCircle2, MoreHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/AppLayout";
import InvoicePreviewModal from "@/components/InvoicePreviewModal";
import { useAddInvoicePayment } from "@/hooks/useInvoicePayments";

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

const PAYMENT_TYPES_LIST = ["Cash", "Bank Transfer", "UPI", "Cheque", "Online Gateway", "Adjustment", "Other"] as const;
const PAYMENT_STATUSES_LIST = ["Completed", "Processing", "Failed"] as const;
const PAY_ELIGIBLE = ["Sent", "Generated", "Partially Paid", "Overdue"];

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

  const [openActionId, setOpenActionId] = useState<number | null>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setOpenActionId(null);
      }
    }
    if (openActionId !== null) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openActionId]);

  const [payTarget, setPayTarget] = useState<Invoice | null>(null);
  const [payForm, setPayForm] = useState({
    payment_type: "Bank Transfer", payment_amount: "",
    currency_code: "INR", exchange_rate_snapshot: "1",
    transaction_reference: "", payment_status: "Completed",
    payment_date: new Date().toISOString().slice(0, 10), remarks: "",
  });
  const addPmt = useAddInvoicePayment();

  function openPayModal(inv: Invoice) {
    const pending = parseFloat(String(inv.pendingAmount ?? 0));
    setPayForm({
      payment_type: "Bank Transfer",
      payment_amount: pending > 0 ? pending.toFixed(2) : "",
      currency_code: inv.currencyCode || "INR",
      exchange_rate_snapshot: "1",
      transaction_reference: "",
      payment_status: "Completed",
      payment_date: new Date().toISOString().slice(0, 10),
      remarks: "",
    });
    setPayTarget(inv);
  }

  async function handlePaySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!payTarget) return;
    const amt = parseFloat(payForm.payment_amount);
    if (!amt || amt <= 0) return toast({ title: "Enter a valid amount", variant: "destructive" });
    try {
      await addPmt.mutateAsync({
        invoice_id: payTarget.id,
        ...payForm,
        payment_amount: amt,
        exchange_rate_snapshot: parseFloat(payForm.exchange_rate_snapshot),
      });
      toast({ title: "Payment recorded successfully" });
      setPayTarget(null);
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

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

  const card = "rounded-2xl bg-white border border-[#C6AF4B]/15 shadow-[0_2px_16px_rgba(198,175,75,0.12),0_1px_3px_rgba(0,0,0,0.06)]";
  const sel = "rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-[#C6AF4B] bg-white";

  const totalPending = invoices.reduce((s, i) => s + parseFloat(String(i.pendingAmount ?? 0)), 0);
  const totalReceived = invoices.reduce((s, i) => s + parseFloat(String(i.receivedAmount ?? 0)), 0);
  const totalValue = invoices.reduce((s, i) => s + parseFloat(String(i.totalAmount ?? 0)), 0);

  return (
    <AppLayout>
      <div className="py-6 px-6 max-w-screen-2xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl" style={{ background: `${G}18` }}>
              <FileText size={20} style={{ color: G }} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Invoices</h1>
              <p className="text-sm text-gray-400 mt-0.5">Manage client &amp; vendor invoices</p>
            </div>
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
                <tr className="border-b border-[#C6AF4B]/15">
                  {["Sr.", "Invoice No", "Direction", "Type", "Client / Vendor", "Reference", "Currency", "Total", "Received", "Pending", "Date", "Due Date", "Status", "Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 whitespace-nowrap">{h}</th>
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
                      <div className="relative" ref={openActionId === inv.id ? actionMenuRef : undefined}>
                        <button
                          onClick={() => setOpenActionId(openActionId === inv.id ? null : inv.id)}
                          className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>

                        {openActionId === inv.id && (
                          <div className="absolute right-0 z-30 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl min-w-[170px] py-1">
                            <button
                              onClick={() => { setOpenActionId(null); navigate(`/accounts/invoices/${inv.id}`); }}
                              className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2.5"
                            >
                              <Eye className="h-3.5 w-3.5" /> View Invoice
                            </button>
                            <button
                              onClick={() => { setOpenActionId(null); navigate(`/accounts/invoices/${inv.id}/edit`); }}
                              className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2.5"
                            >
                              <Edit2 className="h-3.5 w-3.5" /> Edit Invoice
                            </button>
                            {PAY_ELIGIBLE.includes(inv.invoiceStatus) && (
                              <button
                                onClick={() => { setOpenActionId(null); openPayModal(inv); }}
                                className="w-full text-left px-3 py-2 text-xs text-emerald-700 hover:bg-emerald-50 flex items-center gap-2.5"
                              >
                                <Wallet className="h-3.5 w-3.5" /> Record Payment
                              </button>
                            )}
                            <button
                              onClick={() => { setOpenActionId(null); setPreviewInvId(inv.id); }}
                              className="w-full text-left px-3 py-2 text-xs text-amber-700 hover:bg-amber-50 flex items-center gap-2.5"
                            >
                              <Printer className="h-3.5 w-3.5" /> Preview / PDF
                            </button>
                            <div className="mx-2 my-1 border-t border-gray-100" />
                            <button
                              onClick={() => { setOpenActionId(null); setDeleteTarget(inv); }}
                              className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2.5"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Record Payment Modal */}
      {payTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={() => setPayTarget(null)}>
          <div className="rounded-2xl bg-white border border-[#C6AF4B]/15 shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">Record Payment</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {payTarget.invoiceNo} · Pending: {payTarget.currencyCode} {parseFloat(String(payTarget.pendingAmount ?? 0)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <button onClick={() => setPayTarget(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={15} /></button>
            </div>
            <form onSubmit={handlePaySubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Amount *</label>
                  <input type="number" min="0.01" step="0.01" required value={payForm.payment_amount}
                    onChange={e => setPayForm(p => ({ ...p, payment_amount: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6AF4B] focus:ring-2 focus:ring-[#C6AF4B]/20" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Payment Date *</label>
                  <input type="date" required value={payForm.payment_date}
                    onChange={e => setPayForm(p => ({ ...p, payment_date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6AF4B] focus:ring-2 focus:ring-[#C6AF4B]/20" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Payment Type</label>
                  <select value={payForm.payment_type} onChange={e => setPayForm(p => ({ ...p, payment_type: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6AF4B]">
                    {PAYMENT_TYPES_LIST.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Status</label>
                  <select value={payForm.payment_status} onChange={e => setPayForm(p => ({ ...p, payment_status: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6AF4B]">
                    {PAYMENT_STATUSES_LIST.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Transaction Reference</label>
                <input type="text" placeholder="UTR / Cheque No. / Receipt No."
                  value={payForm.transaction_reference} onChange={e => setPayForm(p => ({ ...p, transaction_reference: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6AF4B] focus:ring-2 focus:ring-[#C6AF4B]/20" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Remarks</label>
                <input type="text" placeholder="Optional note"
                  value={payForm.remarks} onChange={e => setPayForm(p => ({ ...p, remarks: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6AF4B] focus:ring-2 focus:ring-[#C6AF4B]/20" />
              </div>
              <div className="rounded-xl bg-amber-50 border border-[#C6AF4B]/20 px-4 py-3 text-xs flex items-center justify-between">
                <span className="text-gray-500">Pending after this payment:</span>
                <span className={`font-bold ${Math.max(0, parseFloat(String(payTarget.pendingAmount ?? 0)) - parseFloat(payForm.payment_amount || "0")) <= 0 ? "text-emerald-600" : "text-amber-700"}`}>
                  {payTarget.currencyCode} {Math.max(0, parseFloat(String(payTarget.pendingAmount ?? 0)) - parseFloat(payForm.payment_amount || "0")).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setPayTarget(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={addPmt.isPending}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ backgroundColor: G }}>
                  {addPmt.isPending ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                  {addPmt.isPending ? "Saving…" : "Save Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
