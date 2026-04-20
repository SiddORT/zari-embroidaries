import { useState, useEffect, useCallback } from "react";
import {
  Search, Plus, FileText, Eye, Trash2, X, CheckCircle2,
  Clock, AlertTriangle, DollarSign, Filter, RefreshCw,
  Paperclip, Download, Edit2, TrendingDown,
} from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react";
import TopNavbar from "@/components/layout/TopNavbar";
import { useToast } from "@/hooks/use-toast";

/* ── styles ─────────────────────────────────────────── */
const CARD = "rounded-2xl bg-white border border-[#C6AF4B]/15 shadow-[0_2px_16px_rgba(198,175,75,0.12),0_1px_3px_rgba(0,0,0,0.06)]";
const TH   = "px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap";
const TD   = "px-3 py-3 text-sm text-gray-800";
const INP  = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30";
const LBL  = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5";
const G    = "#C6AF4B";

const DEFAULT_CATEGORIES = [
  "Courier Charges", "Office Expenses", "Packaging Expenses",
  "Sampling Misc Expenses", "Transport Charges", "Utility Expenses", "Other",
];
const CURRENCIES     = ["INR", "USD", "EUR", "GBP", "AED", "JPY"];
const PAYMENT_TYPES  = ["Cash", "Bank Transfer", "UPI", "Cheque", "Online", "Other"];
const PAYMENT_STATUS = ["Unpaid", "Partially Paid", "Paid"];
const REF_TYPES      = ["Manual", "Purchase Order", "Purchase Receipt", "Vendor Bill", "Other"];

const STATUS_STYLES: Record<string, string> = {
  Unpaid:           "bg-red-100 text-red-700",
  "Partially Paid": "bg-amber-100 text-amber-700",
  Paid:             "bg-green-100 text-green-700",
};

function badge(label: string, cls: string) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>;
}
function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtAmt(n: number | string | null, sym = "₹") {
  const v = parseFloat(String(n ?? 0));
  return isNaN(v) ? "—" : `${sym}${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* ── ExpenseModal (Create / Edit) ─────────────────── */
function ExpenseModal({
  initial, vendors, categories, onClose, onSave,
}: {
  initial: any | null;
  vendors: any[];
  categories: string[];
  onClose: () => void;
  onSave: (fd: FormData) => Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    expense_category:  initial?.expense_category ?? "",
    custom_category:   "",
    vendor_id:         String(initial?.vendor_id ?? ""),
    vendor_name:       initial?.vendor_name ?? "",
    reference_type:    initial?.reference_type ?? "Manual",
    reference_id:      initial?.reference_id ?? "",
    amount:            String(initial?.amount ?? ""),
    currency_code:     initial?.currency_code ?? "INR",
    payment_status:    initial?.payment_status ?? "Unpaid",
    payment_type:      initial?.payment_type ?? "",
    expense_date:      initial?.expense_date ?? today,
    remarks:           initial?.remarks ?? "",
  });
  const [file, setFile]   = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const allCategories = Array.from(new Set([...DEFAULT_CATEGORIES, ...categories])).sort();

  async function submit() {
    setError("");
    const cat = form.expense_category === "__custom__" ? form.custom_category.trim() : form.expense_category;
    if (!cat)                         { setError("Please select or enter an expense category."); return; }
    if (!form.expense_date)           { setError("Expense date is required."); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { setError("Amount must be greater than 0."); return; }
    if (!form.currency_code)          { setError("Currency is required."); return; }

    const fd = new FormData();
    fd.append("expense_category", cat);
    fd.append("vendor_id",        form.vendor_id);
    fd.append("vendor_name",      form.vendor_name);
    fd.append("reference_type",   form.reference_type);
    fd.append("reference_id",     form.reference_id);
    fd.append("amount",           form.amount);
    fd.append("currency_code",    form.currency_code);
    fd.append("payment_status",   form.payment_status);
    fd.append("payment_type",     form.payment_type);
    fd.append("expense_date",     form.expense_date);
    fd.append("remarks",          form.remarks);
    if (file) fd.append("attachment", file);

    setSaving(true);
    try {
      await onSave(fd);
    } catch (e: any) {
      setError(e.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className={`${CARD} w-full max-w-2xl max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">
            {initial ? "Edit Expense" : "Add Other Expense"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              <AlertTriangle size={15} /> {error}
            </div>
          )}

          {/* Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LBL}>Expense Category *</label>
              <select className={INP} value={form.expense_category} onChange={e => set("expense_category", e.target.value)}>
                <option value="">Select category…</option>
                {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="__custom__">+ Add new category…</option>
              </select>
            </div>
            {form.expense_category === "__custom__" && (
              <div>
                <label className={LBL}>New Category Name *</label>
                <input className={INP} value={form.custom_category} onChange={e => set("custom_category", e.target.value)} placeholder="e.g. Misc Repairs" />
              </div>
            )}

            {/* Expense Date */}
            <div>
              <label className={LBL}>Expense Date *</label>
              <input type="date" className={INP} value={form.expense_date} onChange={e => set("expense_date", e.target.value)} />
            </div>
          </div>

          {/* Amount + Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LBL}>Amount *</label>
              <input type="number" min="0" step="0.01" className={INP} value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className={LBL}>Currency *</label>
              <select className={INP} value={form.currency_code} onChange={e => set("currency_code", e.target.value)}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Payment */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LBL}>Payment Status</label>
              <select className={INP} value={form.payment_status} onChange={e => set("payment_status", e.target.value)}>
                {PAYMENT_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={LBL}>Payment Type</label>
              <select className={INP} value={form.payment_type} onChange={e => set("payment_type", e.target.value)}>
                <option value="">Select…</option>
                {PAYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Vendor */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LBL}>Vendor (Optional)</label>
              <select className={INP} value={form.vendor_id}
                onChange={e => {
                  const v = vendors.find((x: any) => String(x.id) === e.target.value);
                  set("vendor_id", e.target.value);
                  set("vendor_name", v?.brandName ?? "");
                }}>
                <option value="">— None —</option>
                {vendors.map((v: any) => <option key={v.id} value={String(v.id)}>{v.brandName}</option>)}
              </select>
            </div>

            {/* Reference */}
            <div>
              <label className={LBL}>Reference Type</label>
              <select className={INP} value={form.reference_type} onChange={e => set("reference_type", e.target.value)}>
                {REF_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          {form.reference_type !== "Manual" && (
            <div>
              <label className={LBL}>Reference ID</label>
              <input className={INP} value={form.reference_id} onChange={e => set("reference_id", e.target.value)} placeholder="e.g. PO-2026-00012" />
            </div>
          )}

          {/* Remarks */}
          <div>
            <label className={LBL}>Remarks</label>
            <textarea rows={3} className={INP} value={form.remarks} onChange={e => set("remarks", e.target.value)} placeholder="Optional notes…" />
          </div>

          {/* Attachment */}
          <div>
            <label className={LBL}>Attachment (PDF / JPG / PNG, max 10 MB)</label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-gray-300 text-sm text-gray-600 cursor-pointer hover:border-[#C6AF4B]/50 hover:bg-[#C6AF4B]/5 transition">
                <Paperclip size={14} />
                {file ? file.name : initial?.attachment ? "Replace file…" : "Choose file…"}
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                  onChange={e => setFile(e.target.files?.[0] ?? null)} />
              </label>
              {initial?.attachment && !file && (
                <a href={initial.attachment} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
                  <Download size={13} /> Current file
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition disabled:opacity-60"
            style={{ background: G }}>
            {saving ? "Saving…" : initial ? "Update Expense" : "Save Expense"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── ViewModal ─────────────────────────────────────── */
function ViewModal({ row, onClose }: { row: any; onClose: () => void }) {
  const sym = row.currency_code === "INR" ? "₹" : row.currency_code + " ";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className={`${CARD} w-full max-w-lg`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Other Expense</p>
            <h2 className="text-base font-bold text-gray-900">{row.expense_number}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X size={16} className="text-gray-500" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-3">
          {[
            ["Category",       row.expense_category],
            ["Date",           fmtDate(row.expense_date)],
            ["Amount",         fmtAmt(row.amount, sym)],
            ["Currency",       row.currency_code],
            ["Payment Status", <span key="ps">{badge(row.payment_status, STATUS_STYLES[row.payment_status] ?? "bg-gray-100 text-gray-700")}</span>],
            ["Payment Type",   row.payment_type || "—"],
            ["Vendor",         (row.vendor_display_name ?? row.vendor_name) || "—"],
            ["Reference",      row.reference_type !== "Manual" ? `${row.reference_type} — ${row.reference_id || "—"}` : "Manual"],
            ["Remarks",        row.remarks || "—"],
            ["Created By",     row.created_by],
            ["Created At",     fmtDate(row.created_at)],
          ].map(([label, value]) => (
            <div key={String(label)} className="flex items-start">
              <span className="w-36 text-xs font-semibold text-gray-400 uppercase tracking-wide shrink-0 pt-0.5">{label}</span>
              <span className="text-sm text-gray-800">{value}</span>
            </div>
          ))}
          {row.attachment && (
            <div className="flex items-start">
              <span className="w-36 text-xs font-semibold text-gray-400 uppercase tracking-wide shrink-0 pt-0.5">Attachment</span>
              <a href={row.attachment} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-[#C6AF4B] hover:underline">
                <Download size={13} /> Download file
              </a>
            </div>
          )}
        </div>
        <div className="flex justify-end px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">Close</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════ */
export default function OtherExpenses() {
  const { data: me, isError } = useGetMe();
  const { toast } = useToast();
  const isAdmin = (me as any)?.role === "admin";

  const [rows, setRows]           = useState<any[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(false);
  const [vendors, setVendors]     = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);

  /* filters */
  const [search, setSearch]     = useState("");
  const [statusF, setStatusF]   = useState("");
  const [catF, setCatF]         = useState("");
  const [vendorF, setVendorF]   = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate]     = useState("");

  /* modals */
  const [createModal, setCreateModal] = useState(false);
  const [editRow, setEditRow]         = useState<any | null>(null);
  const [viewRow, setViewRow]         = useState<any | null>(null);

  /* summary stats */
  const totalAmt   = rows.reduce((s, r) => s + parseFloat(r.amount ?? 0), 0);
  const unpaidAmt  = rows.filter(r => r.payment_status === "Unpaid").reduce((s, r) => s + parseFloat(r.amount ?? 0), 0);
  const paidCount  = rows.filter(r => r.payment_status === "Paid").length;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search)   params.set("search",    search);
      if (statusF)  params.set("status",    statusF);
      if (catF)     params.set("category",  catF);
      if (vendorF)  params.set("vendor_id", vendorF);
      if (fromDate) params.set("from_date", fromDate);
      if (toDate)   params.set("to_date",   toDate);
      params.set("limit", "200");
      const data = await customFetch(`/api/other-expenses?${params}`);
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
    } catch (e: any) {
      toast({ title: "Load failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [search, statusF, catF, vendorF, fromDate, toDate]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    customFetch("/api/vendors/all").then((d: any) => setVendors(Array.isArray(d) ? d : [])).catch(() => {});
    customFetch("/api/other-expenses/categories").then((d: any) => setCategories(d ?? [])).catch(() => {});
  }, []);

  async function handleSave(fd: FormData, id?: number) {
    const url = id ? `/api/other-expenses/${id}` : "/api/other-expenses";
    const method = id ? "PUT" : "POST";
    const resp = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${localStorage.getItem("zarierp_token")}` },
      body: fd,
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(err.error ?? "Failed to save");
    }
    const result = await resp.json();
    toast({ title: result.message ?? (id ? "Expense updated" : "Expense saved") });
    setCreateModal(false);
    setEditRow(null);
    load();
    customFetch("/api/other-expenses/categories").then((d: any) => setCategories(d ?? [])).catch(() => {});
  }

  async function handleDelete(id: number, num: string) {
    if (!confirm(`Delete expense ${num}? This cannot be undone.`)) return;
    try {
      await customFetch(`/api/other-expenses/${id}`, { method: "DELETE" });
      toast({ title: "Expense deleted" });
      load();
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  }

  if (isError || !(me as any)?.id) {
    return <div className="flex items-center justify-center h-screen text-gray-400">Please log in.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavbar />
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Other Expenses</h1>
            <p className="text-sm text-gray-500 mt-0.5">{total} record{total !== 1 ? "s" : ""}</p>
          </div>
          <button onClick={() => setCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
            style={{ background: G }}>
            <Plus size={16} /> Add Expense
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Expenses",  value: fmtAmt(totalAmt),  icon: <TrendingDown size={18} className="text-purple-500" />, bg: "bg-purple-50" },
            { label: "Unpaid Amount",   value: fmtAmt(unpaidAmt), icon: <AlertTriangle size={18} className="text-red-500" />,    bg: "bg-red-50" },
            { label: "Paid Entries",    value: `${paidCount} of ${rows.length}`, icon: <CheckCircle2 size={18} className="text-green-500" />, bg: "bg-green-50" },
          ].map(({ label, value, icon, bg }) => (
            <div key={label} className={`${CARD} p-4 flex items-center gap-4`}>
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>{icon}</div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
                <p className="text-lg font-bold text-gray-900 mt-0.5">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className={`${CARD} p-4`}>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[180px]">
              <label className={LBL}>Search</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className={`${INP} pl-8`} placeholder="Expense #, vendor, category…"
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="w-36">
              <label className={LBL}>From Date</label>
              <input type="date" className={INP} value={fromDate} onChange={e => setFromDate(e.target.value)} />
            </div>
            <div className="w-36">
              <label className={LBL}>To Date</label>
              <input type="date" className={INP} value={toDate} onChange={e => setToDate(e.target.value)} />
            </div>
            <div className="w-40">
              <label className={LBL}>Vendor</label>
              <select className={INP} value={vendorF} onChange={e => setVendorF(e.target.value)}>
                <option value="">All Vendors</option>
                {vendors.map((v: any) => <option key={v.id} value={String(v.id)}>{v.brandName}</option>)}
              </select>
            </div>
            <div className="w-44">
              <label className={LBL}>Category</label>
              <select className={INP} value={catF} onChange={e => setCatF(e.target.value)}>
                <option value="">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="w-40">
              <label className={LBL}>Status</label>
              <select className={INP} value={statusF} onChange={e => setStatusF(e.target.value)}>
                <option value="">All Statuses</option>
                {PAYMENT_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <button onClick={() => { setSearch(""); setStatusF(""); setCatF(""); setVendorF(""); setFromDate(""); setToDate(""); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50">
              <Filter size={13} /> Clear
            </button>
            <button onClick={load}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>

        {/* Table */}
        <div className={`${CARD} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50/80 border-b border-gray-100">
                <tr>
                  {["Expense #", "Category", "Vendor", "Amount", "Currency", "Status", "Payment Type", "Date", "Attachment", "Created By", "Actions"].map(h => (
                    <th key={h} className={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={11} className="px-3 py-10 text-center text-sm text-gray-400">Loading…</td></tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-16 text-center">
                      <DollarSign size={32} className="mx-auto mb-3 text-gray-200" />
                      <p className="text-sm text-gray-400">No expenses found. Click <strong>Add Expense</strong> to get started.</p>
                    </td>
                  </tr>
                ) : rows.map(row => (
                  <tr key={row.expense_id} className="hover:bg-gray-50/60 transition-colors">
                    <td className={TD}>
                      <span className="font-mono text-xs font-semibold text-gray-700">{row.expense_number}</span>
                    </td>
                    <td className={TD}>{row.expense_category}</td>
                    <td className={TD}>{(row.vendor_display_name ?? row.vendor_name) || <span className="text-gray-400">—</span>}</td>
                    <td className={`${TD} font-semibold`}>
                      {row.currency_code === "INR" ? "₹" : row.currency_code + " "}
                      {parseFloat(row.amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={TD}>{row.currency_code}</td>
                    <td className={TD}>{badge(row.payment_status, STATUS_STYLES[row.payment_status] ?? "bg-gray-100 text-gray-700")}</td>
                    <td className={TD}>{row.payment_type || <span className="text-gray-400">—</span>}</td>
                    <td className={`${TD} whitespace-nowrap`}>{fmtDate(row.expense_date)}</td>
                    <td className={TD}>
                      {row.attachment ? (
                        <a href={row.attachment} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-[#C6AF4B] hover:underline">
                          <Download size={12} /> File
                        </a>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className={`${TD} text-xs text-gray-500`}>{row.created_by}</td>
                    <td className={TD}>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setViewRow(row)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition" title="View">
                          <Eye size={14} />
                        </button>
                        <button onClick={() => setEditRow(row)}
                          className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-500 transition" title="Edit">
                          <Edit2 size={14} />
                        </button>
                        {isAdmin && (
                          <button onClick={() => handleDelete(row.expense_id, row.expense_number)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition" title="Delete">
                            <Trash2 size={14} />
                          </button>
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

      {/* Modals */}
      {createModal && (
        <ExpenseModal
          initial={null}
          vendors={vendors}
          categories={categories}
          onClose={() => setCreateModal(false)}
          onSave={fd => handleSave(fd)}
        />
      )}
      {editRow && (
        <ExpenseModal
          initial={editRow}
          vendors={vendors}
          categories={categories}
          onClose={() => setEditRow(null)}
          onSave={fd => handleSave(fd, editRow.expense_id)}
        />
      )}
      {viewRow && <ViewModal row={viewRow} onClose={() => setViewRow(null)} />}
    </div>
  );
}
