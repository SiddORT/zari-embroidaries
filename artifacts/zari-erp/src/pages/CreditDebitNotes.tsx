import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import {
  FileMinus2, FilePlus2, Plus, Search, X, Loader2, CheckCircle2,
  MoreHorizontal, Trash2, FileCheck2, XCircle, ChevronDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/AppLayout";

const G = "#C6AF4B";

function customFetch<T = any>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("zarierp_token");
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  return fetch(`${base}${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  }).then(async r => {
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);
    return j as T;
  });
}

function fmt(n: any) {
  return parseFloat(String(n ?? 0)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d?: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
}

const NOTE_TYPES = ["Credit Note", "Debit Note"] as const;
const REF_TYPES  = ["Client Invoice", "Vendor Bill", "Manual Entry"] as const;
const STATUSES   = ["Draft", "Applied", "Cancelled"] as const;
const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "JPY", "CNY"];

const CN_REASONS = [
  "Discount Correction", "Overbilling Correction", "Returns Adjustment",
  "Sampling Adjustment", "Manual Reduction",
];
const DN_REASONS = [
  "Additional Billing", "Rate Correction", "Additional Service Charge",
  "Material Recovery Correction", "Manual Increase",
];

const TYPE_PILL: Record<string, string> = {
  "Credit Note": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Debit Note":  "bg-rose-50 text-rose-700 border-rose-200",
};
const STATUS_PILL: Record<string, string> = {
  Draft:     "bg-gray-50 text-gray-600 border-gray-200",
  Applied:   "bg-blue-50 text-blue-700 border-blue-200",
  Cancelled: "bg-gray-100 text-gray-400 border-gray-200",
};

interface CdNote {
  note_id: number;
  note_number: string;
  note_type: string;
  reference_type: string;
  invoice_id: number | null;
  invoice_no: string | null;
  vendor_bill_id: number | null;
  vendor_bill_number: string | null;
  party_id: number | null;
  party_name: string;
  party_type: string;
  currency_code: string;
  note_amount: string;
  base_currency_amount: string;
  reason: string;
  remarks: string;
  note_date: string;
  status: string;
  created_by: string;
  created_at: string;
}

const EMPTY_FORM = {
  note_type: "Credit Note" as string,
  reference_type: "Client Invoice" as string,
  invoice_id: "" as string,
  vendor_bill_id: "" as string,
  party_id: "" as string,
  party_name: "",
  party_type: "Client" as string,
  currency_code: "INR",
  exchange_rate_snapshot: "1",
  note_amount: "",
  reason: "",
  remarks: "",
  note_date: new Date().toISOString().slice(0, 10),
  status: "Applied" as string,
};

export default function CreditDebitNotes() {
  const { toast } = useToast();

  const [notes, setNotes]       = useState<CdNote[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [filterType, setFilterType]     = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState({ ...EMPTY_FORM });

  /* dropdown */
  const [openActionId, setOpenActionId] = useState<number | null>(null);
  const [dropdownPos, setDropdownPos]   = useState<{ top: number; right: number } | null>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  /* reference options */
  const [invoices, setInvoices]       = useState<any[]>([]);
  const [vendorBills, setVendorBills] = useState<any[]>([]);
  const [clients, setClients]         = useState<any[]>([]);
  const [vendors, setVendors]         = useState<any[]>([]);

  /* ── load reference data ──────────────────────────────── */
  useEffect(() => {
    customFetch<any>("/api/invoices?limit=500").then(j => setInvoices(j.data ?? [])).catch(() => {});
    customFetch<any>("/api/clients").then(j => setClients(j.data ?? j ?? [])).catch(() => {});
    customFetch<any>("/api/vendors").then(j => setVendors(j.data ?? j ?? [])).catch(() => {});
    customFetch<any>("/api/vendor-ledger/summary").then(j => setVendorBills(j.data ?? [])).catch(() => {});
  }, []);

  /* ── close dropdown on outside click ─────────────────── */
  useEffect(() => {
    function h(e: MouseEvent) {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setOpenActionId(null); setDropdownPos(null);
      }
    }
    if (openActionId !== null) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [openActionId]);

  function toggleDropdown(e: React.MouseEvent<HTMLButtonElement>, id: number) {
    if (openActionId === id) { setOpenActionId(null); setDropdownPos(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setOpenActionId(id);
  }

  /* ── load notes ───────────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (search) p.set("search", search);
      if (filterType) p.set("type", filterType);
      if (filterStatus) p.set("status", filterStatus);
      const j = await customFetch<any>(`/api/credit-debit-notes?${p}`);
      setNotes(j.data ?? []);
    } catch (e: any) {
      toast({ title: "Error loading notes", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [search, filterType, filterStatus]);

  useEffect(() => { load(); }, [load]);

  /* ── form helpers ─────────────────────────────────────── */
  function setF(k: string, v: string) { setForm(p => ({ ...p, [k]: v })); }

  function openCreateModal() {
    setForm({ ...EMPTY_FORM, note_date: new Date().toISOString().slice(0, 10) });
    setShowModal(true);
  }

  /* auto-fill party when invoice selected */
  useEffect(() => {
    if (form.reference_type !== "Client Invoice" || !form.invoice_id) return;
    const inv = invoices.find(i => String(i.id) === String(form.invoice_id));
    if (!inv) return;
    setForm(p => ({
      ...p,
      party_id: String(inv.client_id ?? ""),
      party_name: inv.clientName ?? inv.client_name ?? "",
      party_type: "Client",
    }));
  }, [form.invoice_id, form.reference_type, invoices]);

  /* auto-fill party when vendor bill selected */
  useEffect(() => {
    if (form.reference_type !== "Vendor Bill" || !form.vendor_bill_id) return;
    const bill = vendorBills.find(v => String(v.id) === String(form.vendor_bill_id));
    if (!bill) return;
    setForm(p => ({
      ...p,
      party_id: String(bill.vendor_id ?? ""),
      party_name: bill.vendor_name ?? "",
      party_type: "Vendor",
    }));
  }, [form.vendor_bill_id, form.reference_type, vendorBills]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        invoice_id: form.invoice_id || null,
        vendor_bill_id: form.vendor_bill_id || null,
        party_id: form.party_id || null,
        note_amount: parseFloat(form.note_amount),
        exchange_rate_snapshot: parseFloat(form.exchange_rate_snapshot),
      };
      const res = await customFetch<any>("/api/credit-debit-notes", {
        method: "POST", body: JSON.stringify(payload),
      });
      toast({ title: res.message ?? "Note created successfully" });
      setShowModal(false);
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function applyNote(note: CdNote) {
    try {
      const res = await customFetch<any>(`/api/credit-debit-notes/${note.note_id}/apply`, { method: "PUT" });
      toast({ title: res.message ?? "Note applied" });
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  async function cancelNote(note: CdNote) {
    if (!confirm(`Cancel ${note.note_number}? This will reverse any balance adjustments.`)) return;
    try {
      const res = await customFetch<any>(`/api/credit-debit-notes/${note.note_id}/cancel`, { method: "PUT" });
      toast({ title: res.message ?? "Note cancelled" });
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  async function deleteNote(note: CdNote) {
    if (!confirm(`Delete ${note.note_number}? This cannot be undone.`)) return;
    try {
      await customFetch(`/api/credit-debit-notes/${note.note_id}`, { method: "DELETE" });
      toast({ title: "Note deleted" });
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  /* ── derived counts ───────────────────────────────────── */
  const totalCN = notes.filter(n => n.note_type === "Credit Note" && n.status === "Applied")
    .reduce((s, n) => s + parseFloat(String(n.base_currency_amount ?? 0)), 0);
  const totalDN = notes.filter(n => n.note_type === "Debit Note" && n.status === "Applied")
    .reduce((s, n) => s + parseFloat(String(n.base_currency_amount ?? 0)), 0);
  const drafts  = notes.filter(n => n.status === "Draft").length;

  const card = "rounded-2xl bg-white border border-[#C6AF4B]/15 shadow-[0_2px_16px_rgba(198,175,75,0.12),0_1px_3px_rgba(0,0,0,0.06)]";
  const sel  = "rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-[#C6AF4B] bg-white";
  const inp  = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6AF4B] focus:ring-2 focus:ring-[#C6AF4B]/20 bg-white";
  const lbl  = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5";

  const reasons = form.note_type === "Credit Note" ? CN_REASONS : DN_REASONS;

  return (
    <AppLayout>
      <div className="py-6 px-6 max-w-screen-2xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl" style={{ background: `${G}18` }}>
              <FileMinus2 size={20} style={{ color: G }} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Credit / Debit Notes</h1>
              <p className="text-sm text-gray-400 mt-0.5">Invoice corrections, adjustments &amp; balance notes</p>
            </div>
          </div>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm"
            style={{ backgroundColor: G }}
          >
            <Plus size={15} /> Create Note
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total Notes", val: notes.length, sub: "all time", color: "text-gray-900", raw: true },
            { label: "Credit Notes Applied", val: `₹${fmt(totalCN)}`, sub: "balance reduced", color: "text-emerald-600", raw: false },
            { label: "Debit Notes Applied",  val: `₹${fmt(totalDN)}`, sub: "balance increased", color: "text-rose-600", raw: false },
            { label: "Pending Drafts", val: drafts, sub: "awaiting application", color: "text-amber-600", raw: true },
          ].map(c => (
            <div key={c.label} className={`${card} p-4`}>
              <p className="text-xs text-gray-400 mb-1">{c.label}</p>
              <p className={`text-lg font-bold ${c.color}`}>{c.raw ? c.val : c.val}</p>
              <p className="text-xs text-gray-300 mt-0.5">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className={`${card} p-4 flex flex-wrap items-center gap-3`}>
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search note number, party, reason…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#C6AF4B]"
            />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className={sel}>
            <option value="">All Types</option>
            {NOTE_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={sel}>
            <option value="">All Status</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          {(search || filterType || filterStatus) && (
            <button
              onClick={() => { setSearch(""); setFilterType(""); setFilterStatus(""); }}
              className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition"
            >Clear</button>
          )}
        </div>

        {/* Table */}
        <div className={`${card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#C6AF4B]/15">
                  {["#", "Note No.", "Type", "Reference", "Invoice / Bill", "Party", "Amount", "Currency", "Date", "Status", "Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      {Array.from({ length: 11 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : notes.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-16 text-center">
                      <FileMinus2 size={40} className="mx-auto text-gray-200 mb-3" />
                      <p className="text-gray-400 text-sm">No notes found. Create your first credit or debit note.</p>
                      <button onClick={openCreateModal}
                        className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                        style={{ backgroundColor: G }}>
                        <Plus size={14} /> Create Note
                      </button>
                    </td>
                  </tr>
                ) : notes.map((n, idx) => (
                  <tr key={n.note_id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                    <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                    <td className="px-4 py-3 font-mono font-bold text-xs" style={{ color: G }}>{n.note_number}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${TYPE_PILL[n.note_type] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                        {n.note_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{n.reference_type}</td>
                    <td className="px-4 py-3 text-xs text-gray-700 font-mono">
                      {n.invoice_no ?? n.vendor_bill_number ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 max-w-[120px] truncate">{n.party_name || "—"}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-900 tabular-nums">₹{fmt(n.base_currency_amount)}</td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-500">{n.currency_code}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(n.note_date)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_PILL[n.status] ?? STATUS_PILL.Draft}`}>
                        {n.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={e => toggleDropdown(e, n.note_id)}
                        className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Actions dropdown — portal */}
      {openActionId !== null && dropdownPos && (() => {
        const n = notes.find(x => x.note_id === openActionId);
        if (!n) return null;
        return createPortal(
          <div
            ref={actionMenuRef}
            className="fixed z-[9999] bg-white border border-gray-200 rounded-xl shadow-xl min-w-[170px] py-1"
            style={{ top: dropdownPos.top, right: dropdownPos.right }}
          >
            {n.status === "Draft" && (
              <button
                onClick={() => { setOpenActionId(null); applyNote(n); }}
                className="w-full text-left px-3 py-2 text-xs text-blue-700 hover:bg-blue-50 flex items-center gap-2.5"
              >
                <FileCheck2 className="h-3.5 w-3.5" /> Apply Note
              </button>
            )}
            {n.status !== "Cancelled" && (
              <button
                onClick={() => { setOpenActionId(null); cancelNote(n); }}
                className="w-full text-left px-3 py-2 text-xs text-orange-600 hover:bg-orange-50 flex items-center gap-2.5"
              >
                <XCircle className="h-3.5 w-3.5" /> Cancel Note
              </button>
            )}
            {n.status === "Draft" && (
              <>
                <div className="mx-2 my-1 border-t border-gray-100" />
                <button
                  onClick={() => { setOpenActionId(null); deleteNote(n); }}
                  className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2.5"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </>
            )}
            {n.status === "Applied" && n.status !== "Cancelled" && (
              <div className="px-3 py-2 text-xs text-gray-400">Note is applied</div>
            )}
          </div>,
          document.body
        );
      })()}

      {/* Create Note Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={() => setShowModal(false)}>
          <div className="rounded-2xl bg-white border border-[#C6AF4B]/15 shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-base font-bold text-gray-900">Create Credit / Debit Note</h2>
                <p className="text-xs text-gray-400 mt-0.5">All Applied notes immediately update outstanding balances</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={15} /></button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5">
              {/* Note type selector */}
              <div>
                <label className={lbl}>Note Type *</label>
                <div className="flex gap-3">
                  {NOTE_TYPES.map(t => (
                    <button
                      key={t} type="button"
                      onClick={() => { setF("note_type", t); setF("reason", ""); }}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                        form.note_type === t
                          ? t === "Credit Note"
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                            : "border-rose-500 bg-rose-50 text-rose-700"
                          : "border-gray-200 text-gray-500 hover:border-gray-300"
                      }`}
                    >
                      {t === "Credit Note" ? <FileMinus2 size={15} /> : <FilePlus2 size={15} />}
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reference type + date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Reference Type *</label>
                  <select value={form.reference_type}
                    onChange={e => { setF("reference_type", e.target.value); setF("invoice_id", ""); setF("vendor_bill_id", ""); setF("party_id", ""); setF("party_name", ""); }}
                    className={inp}>
                    {REF_TYPES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Note Date *</label>
                  <input type="date" required value={form.note_date}
                    onChange={e => setF("note_date", e.target.value)} className={inp} />
                </div>
              </div>

              {/* Reference selector */}
              {form.reference_type === "Client Invoice" && (
                <div>
                  <label className={lbl}>Select Invoice *</label>
                  <select value={form.invoice_id} onChange={e => setF("invoice_id", e.target.value)} className={inp} required>
                    <option value="">— Select Invoice —</option>
                    {invoices.filter(i => i.invoiceDirection === "Client").map(i => (
                      <option key={i.id} value={i.id}>
                        {i.invoiceNo} — {i.clientName || "—"} (Pending: ₹{fmt(i.pendingAmount)})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {form.reference_type === "Vendor Bill" && (
                <div>
                  <label className={lbl}>Select Vendor Bill *</label>
                  <select value={form.vendor_bill_id} onChange={e => setF("vendor_bill_id", e.target.value)} className={inp} required>
                    <option value="">— Select Vendor Bill —</option>
                    {vendorBills.map((v: any) => (
                      <option key={v.id} value={v.id}>
                        {v.vendor_invoice_number} — {v.vendor_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {form.reference_type === "Manual Entry" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>Party Type</label>
                    <select value={form.party_type} onChange={e => { setF("party_type", e.target.value); setF("party_id", ""); setF("party_name", ""); }} className={inp}>
                      <option>Client</option>
                      <option>Vendor</option>
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Party</label>
                    <select value={form.party_id}
                      onChange={e => {
                        const id = e.target.value;
                        const list = form.party_type === "Client" ? clients : vendors;
                        const found = list.find((x: any) => String(x.id) === id);
                        setF("party_id", id);
                        setF("party_name", found?.name ?? found?.vendorName ?? "");
                      }} className={inp}>
                      <option value="">— Select —</option>
                      {(form.party_type === "Client" ? clients : vendors).map((x: any) => (
                        <option key={x.id} value={x.id}>{x.name ?? x.vendorName}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Party info (auto-filled) */}
              {form.party_name && form.reference_type !== "Manual Entry" && (
                <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-xs text-gray-600 flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-500" />
                  Party auto-filled: <strong>{form.party_name}</strong> ({form.party_type})
                </div>
              )}

              {/* Amount + currency */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className={lbl}>Note Amount *</label>
                  <input type="number" min="0.01" step="0.01" required
                    value={form.note_amount} onChange={e => setF("note_amount", e.target.value)} className={inp}
                    placeholder="0.00" />
                </div>
                <div>
                  <label className={lbl}>Currency</label>
                  <select value={form.currency_code} onChange={e => setF("currency_code", e.target.value)} className={inp}>
                    {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              {form.currency_code !== "INR" && (
                <div>
                  <label className={lbl}>Exchange Rate (1 {form.currency_code} = ? INR)</label>
                  <input type="number" min="0.0001" step="0.0001" value={form.exchange_rate_snapshot}
                    onChange={e => setF("exchange_rate_snapshot", e.target.value)} className={inp} />
                  <p className="text-xs text-gray-400 mt-1">
                    INR equivalent: ₹{fmt(parseFloat(form.note_amount || "0") * parseFloat(form.exchange_rate_snapshot || "1"))}
                  </p>
                </div>
              )}

              {/* Reason */}
              <div>
                <label className={lbl}>Reason *</label>
                <select value={form.reason} onChange={e => setF("reason", e.target.value)} className={inp} required>
                  <option value="">— Select Reason —</option>
                  {reasons.map(r => <option key={r}>{r}</option>)}
                  <option value="__other">Other (specify in remarks)</option>
                </select>
              </div>

              {/* Remarks */}
              <div>
                <label className={lbl}>Remarks</label>
                <textarea value={form.remarks} onChange={e => setF("remarks", e.target.value)}
                  rows={2} placeholder="Additional details…"
                  className={`${inp} resize-none`} />
              </div>

              {/* Status */}
              <div>
                <label className={lbl}>Save As</label>
                <div className="flex gap-3">
                  {(["Draft", "Applied"] as const).map(s => (
                    <button key={s} type="button" onClick={() => setF("status", s)}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                        form.status === s
                          ? s === "Applied"
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-400 bg-gray-50 text-gray-700"
                          : "border-gray-200 text-gray-400 hover:border-gray-300"
                      }`}>
                      {s === "Applied" ? "Apply Now" : "Save as Draft"}
                    </button>
                  ))}
                </div>
                {form.status === "Applied" && (
                  <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                    <CheckCircle2 size={11} /> Outstanding balances will be updated immediately upon saving.
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-1 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ backgroundColor: G }}>
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  {saving ? "Saving…" : "Create Note"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
