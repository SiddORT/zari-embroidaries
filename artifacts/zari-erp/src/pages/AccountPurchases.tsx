import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Search, Plus, ShoppingCart, FileText, Receipt, MoreHorizontal,
  CreditCard, Eye, Trash2, X, CheckCircle2, Clock, AlertTriangle,
  ChevronDown, Package, DollarSign, TrendingDown, Filter,
  TrendingUp, Wallet, BarChart3, RefreshCw, ArrowRight,
} from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react";
import TopNavbar from "@/components/layout/TopNavbar";
import { useToast } from "@/hooks/use-toast";

/* ── styles ─────────────────────────────────────────── */
const CARD  = "rounded-2xl bg-white border border-[#C6AF4B]/15 shadow-[0_2px_16px_rgba(198,175,75,0.12),0_1px_3px_rgba(0,0,0,0.06)]";
const TH    = "px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap";
const TD    = "px-3 py-3 text-sm text-gray-800";
const INP   = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30";
const LBL   = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5";
const G     = "#C6AF4B";

const PAYMENT_TYPES = ["Bank Transfer", "UPI", "NEFT", "RTGS", "Cash", "Cheque", "Other"];
const DEFAULT_CATEGORIES = [
  "Courier Charges", "Office Expenses", "Sampling Misc Expenses",
  "Transport Charges", "Packaging Expenses", "Utility Expenses", "Other",
];

/* ── helpers ─────────────────────────────────────────── */
function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtAmt(n: number | string | null, sym = "₹") {
  const v = parseFloat(String(n ?? 0));
  return isNaN(v) ? "—" : `${sym}${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function badge(label: string, cls: string) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>;
}

const PO_STATUS: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700", Approved: "bg-blue-100 text-blue-700",
  "Partially Received": "bg-amber-100 text-amber-700", Closed: "bg-green-100 text-green-700",
  Cancelled: "bg-red-100 text-red-700",
};
const BILL_STATUS: Record<string, string> = {
  Unpaid: "bg-red-100 text-red-700", "Partially Paid": "bg-amber-100 text-amber-700",
  Paid: "bg-green-100 text-green-700", Adjusted: "bg-purple-100 text-purple-700",
};
const EXP_STATUS: Record<string, string> = {
  Unpaid: "bg-red-100 text-red-700", "Partially Paid": "bg-amber-100 text-amber-700", Paid: "bg-green-100 text-green-700",
};

/* ── Dropdown portal ─────────────────────────────────── */
function DropdownMenu({ items }: { items: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }[] }) {
  return (
    <div className="py-1 min-w-[150px]">
      {items.map(it => (
        <button key={it.label} onClick={it.onClick}
          className={`flex items-center gap-2 w-full px-3 py-2 text-sm font-medium transition-colors ${it.danger ? "text-red-600 hover:bg-red-50" : "text-gray-700 hover:bg-gray-50"}`}>
          {it.icon}{it.label}
        </button>
      ))}
    </div>
  );
}

/* ── Payment Modal ───────────────────────────────────── */
function PaymentModal({
  title, totalAmount, onClose, onSave,
}: {
  title: string; totalAmount: number; onClose: () => void; onSave: (data: any) => Promise<void>;
}) {
  const [form, setForm] = useState({
    payment_amount: String(totalAmount.toFixed(2)),
    payment_date: new Date().toISOString().slice(0, 10),
    payment_type: "Bank Transfer",
    transaction_reference: "",
    remarks: "",
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  async function submit() {
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
      <div className={`${CARD} w-[480px] p-6`}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LBL}>Payment Amount *</label>
              <input type="number" value={form.payment_amount} onChange={e => setForm(f => ({ ...f, payment_amount: e.target.value }))} className={INP} min="0.01" step="0.01" />
            </div>
            <div>
              <label className={LBL}>Payment Date *</label>
              <input type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} className={INP} />
            </div>
          </div>
          <div>
            <label className={LBL}>Payment Type</label>
            <select value={form.payment_type} onChange={e => setForm(f => ({ ...f, payment_type: e.target.value }))} className={INP}>
              {PAYMENT_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={LBL}>Transaction Reference</label>
            <input value={form.transaction_reference} onChange={e => setForm(f => ({ ...f, transaction_reference: e.target.value }))} className={INP} placeholder="UTR / Cheque No." />
          </div>
          <div>
            <label className={LBL}>Remarks</label>
            <input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} className={INP} />
          </div>
        </div>
        <div className="flex gap-3 mt-5 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition"
            style={{ background: G }}>
            {saving ? "Saving…" : "Record Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   TAB 1 — PURCHASE ORDERS
══════════════════════════════════════════════════════ */
function PurchaseOrdersTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("");
  const [refTypeF, setRefTypeF] = useState("");
  const [total, setTotal] = useState(0);
  const [dropPos, setDropPos] = useState<{ top: number; right: number } | null>(null);
  const [dropId, setDropId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusF) params.set("status", statusF);
      if (refTypeF) params.set("ref_type", refTypeF);
      const j = await customFetch<any>(`/api/account-purchases/purchase-orders?${params}`);
      setRows(j.data ?? []); setTotal(j.total ?? 0);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [search, statusF, refTypeF]);

  useEffect(() => { load(); }, [load]);

  function openDrop(e: React.MouseEvent, id: number) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDropPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    setDropId(id);
  }

  const totalPOAmount = rows.reduce((s, r) => s + parseFloat(r.po_amount ?? "0"), 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total POs", val: total, sub: "all time", icon: <ShoppingCart size={18} className="text-[#C6AF4B]" /> },
          { label: "Total PO Value", val: fmtAmt(totalPOAmount), sub: "current page", icon: <DollarSign size={18} className="text-blue-500" /> },
          { label: "Open POs", val: rows.filter(r => !["Closed","Cancelled"].includes(r.status)).length, sub: "pending closure", icon: <Clock size={18} className="text-amber-500" /> },
        ].map(s => (
          <div key={s.label} className={`${CARD} p-4 flex items-start gap-3`}>
            <div className="p-2 rounded-xl bg-gray-50">{s.icon}</div>
            <div><p className="text-xs text-gray-500 font-medium">{s.label}</p><p className="text-xl font-bold text-gray-900 mt-0.5">{s.val}</p><p className="text-xs text-gray-400">{s.sub}</p></div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className={`${CARD} p-4 flex items-center gap-3 flex-wrap`}>
        <div className="flex-1 min-w-[200px] relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search PO number, vendor…" className={`${INP} pl-9`} />
        </div>
        <select value={statusF} onChange={e => setStatusF(e.target.value)} className={`${INP} w-40`}>
          <option value="">All Status</option>
          {["Draft","Approved","Partially Received","Closed","Cancelled"].map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={refTypeF} onChange={e => setRefTypeF(e.target.value)} className={`${INP} w-36`}>
          <option value="">All References</option>
          {["Swatch","Style","Manual","Inventory"].map(r => <option key={r}>{r}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className={`${CARD} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-100 bg-gray-50/60">
              <tr>
                {["PO Number","Vendor","Reference","PO Amount","Ordered Qty","Received Qty","Pending Qty","Status","PO Date",""].map(h => (
                  <th key={h} className={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={10} className="py-12 text-center text-sm text-gray-400">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={10} className="py-12 text-center text-sm text-gray-400">No purchase orders found</td></tr>
              ) : rows.map((r, i) => (
                <tr key={r.id} className="hover:bg-gray-50/40 transition">
                  <td className={TD}><span className="font-mono text-xs font-semibold text-[#C6AF4B]">{r.po_number}</span></td>
                  <td className={TD}>{r.vendor_name}</td>
                  <td className={TD}>
                    <div className="flex items-center gap-1">
                      <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">{r.reference_type}</span>
                      {(r.swatch_order_code || r.style_order_code) && (
                        <span className="text-xs text-gray-500">{r.swatch_order_code || r.style_order_code}</span>
                      )}
                    </div>
                  </td>
                  <td className={`${TD} font-semibold`}>{fmtAmt(r.po_amount)}</td>
                  <td className={TD}>{parseFloat(r.total_ordered_qty).toFixed(2)}</td>
                  <td className={TD}><span className="text-green-700">{parseFloat(r.total_received_qty).toFixed(2)}</span></td>
                  <td className={TD}><span className="text-amber-600">{parseFloat(r.pending_qty).toFixed(2)}</span></td>
                  <td className={TD}>{badge(r.status, PO_STATUS[r.status] ?? "bg-gray-100 text-gray-600")}</td>
                  <td className={TD}>{fmtDate(r.po_date)}</td>
                  <td className={TD}>
                    <div className="relative">
                      <button onClick={e => openDrop(e, r.id)} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
                        <MoreHorizontal size={14} className="text-gray-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dropdown portal */}
      {dropId !== null && dropPos && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => { setDropId(null); setDropPos(null); }} />
          <div className={`${CARD} fixed z-[9999]`} style={{ top: dropPos.top, right: dropPos.right }}>
            <DropdownMenu items={[
              { label: "View Details", icon: <Eye size={14} />, onClick: () => { window.location.href = `/procurement/purchase-orders`; setDropId(null); setDropPos(null); } },
            ]} />
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   TAB 2 — VENDOR BILLS
══════════════════════════════════════════════════════ */
function VendorBillsTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("");
  const [total, setTotal] = useState(0);
  const [payModal, setPayModal] = useState<any | null>(null);
  const [dropPos, setDropPos] = useState<{ top: number; right: number } | null>(null);
  const [dropId, setDropId] = useState<number | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusF) params.set("status", statusF);
      const j = await customFetch<any>(`/api/account-purchases/vendor-bills?${params}`);
      setRows(j.data ?? []); setTotal(j.total ?? 0);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [search, statusF]);

  useEffect(() => { load(); }, [load]);

  function openDrop(e: React.MouseEvent, id: number) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDropPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    setDropId(id);
  }

  const totalBillAmt  = rows.reduce((s, r) => s + parseFloat(r.vendor_invoice_amount ?? "0"), 0);
  const totalPaid     = rows.reduce((s, r) => s + parseFloat(r.paid_amount ?? "0"), 0);
  const totalPending  = rows.reduce((s, r) => s + parseFloat(r.pending_amount ?? "0"), 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Bills", val: total, cls: "text-gray-900", icon: <FileText size={18} className="text-[#C6AF4B]" /> },
          { label: "Total Billed", val: fmtAmt(totalBillAmt), cls: "text-gray-900", icon: <DollarSign size={18} className="text-blue-500" /> },
          { label: "Total Paid", val: fmtAmt(totalPaid), cls: "text-green-700", icon: <CheckCircle2 size={18} className="text-green-500" /> },
          { label: "Total Pending", val: fmtAmt(totalPending), cls: "text-red-600", icon: <AlertTriangle size={18} className="text-red-400" /> },
        ].map(s => (
          <div key={s.label} className={`${CARD} p-4 flex items-start gap-3`}>
            <div className="p-2 rounded-xl bg-gray-50">{s.icon}</div>
            <div><p className="text-xs text-gray-500 font-medium">{s.label}</p><p className={`text-xl font-bold mt-0.5 ${s.cls}`}>{s.val}</p></div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className={`${CARD} p-4 flex items-center gap-3`}>
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search bill number, vendor…" className={`${INP} pl-9`} />
        </div>
        <select value={statusF} onChange={e => setStatusF(e.target.value)} className={`${INP} w-44`}>
          <option value="">All Status</option>
          {["Unpaid","Partially Paid","Paid","Adjusted"].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className={`${CARD} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-100 bg-gray-50/60">
              <tr>
                {["Bill Number","Vendor","Linked PO","Bill Amount","Paid","Pending","Status","Bill Date",""].map(h => (
                  <th key={h} className={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={9} className="py-12 text-center text-sm text-gray-400">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="py-12 text-center">
                  <FileText size={32} className="mx-auto text-gray-200 mb-2" />
                  <p className="text-sm text-gray-400">No vendor bills found. Bills are created via Purchase Receipt → Upload Vendor Invoice.</p>
                </td></tr>
              ) : rows.map(r => (
                <tr key={r.id} className="hover:bg-gray-50/40 transition">
                  <td className={TD}><span className="font-mono text-xs font-semibold text-[#C6AF4B]">{r.vendor_invoice_number}</span></td>
                  <td className={TD}>{r.vendor_name}</td>
                  <td className={TD}>{r.linked_po_number ? <span className="text-xs font-mono text-indigo-700">{r.linked_po_number}</span> : <span className="text-gray-300">—</span>}</td>
                  <td className={`${TD} font-semibold`}>{fmtAmt(r.vendor_invoice_amount)}</td>
                  <td className={TD}><span className="text-green-700 font-semibold">{fmtAmt(r.paid_amount)}</span></td>
                  <td className={TD}><span className="text-red-600 font-semibold">{fmtAmt(r.pending_amount)}</span></td>
                  <td className={TD}>{badge(r.status, BILL_STATUS[r.status] ?? "bg-gray-100 text-gray-600")}</td>
                  <td className={TD}>{fmtDate(r.vendor_invoice_date)}</td>
                  <td className={TD}>
                    <button onClick={e => openDrop(e, r.id)} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
                      <MoreHorizontal size={14} className="text-gray-500" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dropdown portal */}
      {dropId !== null && dropPos && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => { setDropId(null); setDropPos(null); }} />
          <div className={`${CARD} fixed z-[9999]`} style={{ top: dropPos.top, right: dropPos.right }}>
            <DropdownMenu items={[
              {
                label: "Record Payment", icon: <CreditCard size={14} />,
                onClick: () => {
                  const bill = rows.find(r => r.id === dropId);
                  if (bill) setPayModal(bill);
                  setDropId(null); setDropPos(null);
                },
              },
              ...(rows.find(r => r.id === dropId)?.vendor_invoice_file ? [{
                label: "View Attachment", icon: <Eye size={14} />,
                onClick: () => {
                  const bill = rows.find(r => r.id === dropId);
                  if (bill?.vendor_invoice_file) window.open(`/api${bill.vendor_invoice_file}`, "_blank");
                  setDropId(null); setDropPos(null);
                },
              }] : []),
            ]} />
          </div>
        </>,
        document.body
      )}

      {/* Payment modal */}
      {payModal && (
        <PaymentModal
          title={`Record Payment — ${payModal.vendor_invoice_number}`}
          totalAmount={parseFloat(payModal.pending_amount ?? payModal.vendor_invoice_amount ?? "0")}
          onClose={() => setPayModal(null)}
          onSave={async data => {
            await customFetch(`/api/account-purchases/vendor-bills/${payModal.id}/payment`, {
              method: "POST", body: JSON.stringify(data),
            });
            toast({ title: "Payment recorded successfully" });
            load();
          }}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   TAB 3 — OTHER EXPENSES
══════════════════════════════════════════════════════ */
function OtherExpensesTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("");
  const [categoryF, setCategoryF] = useState("");
  const [vendorF, setVendorF] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [total, setTotal] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [editRow, setEditRow] = useState<any | null>(null);
  const [payModal, setPayModal] = useState<any | null>(null);
  const [dropPos, setDropPos] = useState<{ top: number; right: number } | null>(null);
  const [dropId, setDropId] = useState<number | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search)    params.set("search", search);
      if (statusF)   params.set("status", statusF);
      if (categoryF) params.set("category", categoryF);
      if (vendorF)   params.set("vendor_id", vendorF);
      if (fromDate)  params.set("from_date", fromDate);
      if (toDate)    params.set("to_date", toDate);
      const j = await customFetch<any>(`/api/account-purchases/expenses?${params}`);
      setRows(j.data ?? []); setTotal(j.total ?? 0);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [search, statusF, categoryF, vendorF, fromDate, toDate]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    customFetch<any>("/api/vendors?limit=500").then(j => setVendors(j.data ?? [])).catch(() => {});
    customFetch<any>("/api/account-purchases/expenses/categories").then(j => setCategories(j.data ?? DEFAULT_CATEGORIES)).catch(() => {});
  }, []);

  function openDrop(e: React.MouseEvent, id: number) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDropPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    setDropId(id);
  }

  async function deleteExp(id: number) {
    if (!confirm("Delete this expense?")) return;
    try {
      await customFetch(`/api/account-purchases/expenses/${id}`, { method: "DELETE" });
      toast({ title: "Deleted" }); load();
    } catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
  }

  const totalAmt    = rows.reduce((s, r) => s + parseFloat(r.amount ?? "0"), 0);
  const totalPaid   = rows.reduce((s, r) => s + parseFloat(r.paid_amount ?? "0"), 0);
  const totalUnpaid = rows.filter(r => r.payment_status !== "Paid").length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Expenses", val: total, cls: "text-gray-900", icon: <Receipt size={18} className="text-[#C6AF4B]" /> },
          { label: "Total Amount", val: fmtAmt(totalAmt), cls: "text-gray-900", icon: <TrendingDown size={18} className="text-blue-500" /> },
          { label: "Total Paid", val: fmtAmt(totalPaid), cls: "text-green-700", icon: <CheckCircle2 size={18} className="text-green-500" /> },
          { label: "Pending Settlement", val: totalUnpaid, cls: "text-red-600", icon: <Clock size={18} className="text-red-400" /> },
        ].map(s => (
          <div key={s.label} className={`${CARD} p-4 flex items-start gap-3`}>
            <div className="p-2 rounded-xl bg-gray-50">{s.icon}</div>
            <div><p className="text-xs text-gray-500 font-medium">{s.label}</p><p className={`text-xl font-bold mt-0.5 ${s.cls}`}>{s.val}</p></div>
          </div>
        ))}
      </div>

      {/* Filters + Add */}
      <div className={`${CARD} p-4 flex items-center gap-3 flex-wrap`}>
        <div className="flex-1 min-w-[180px] relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search expenses…" className={`${INP} pl-9`} />
        </div>
        <select value={categoryF} onChange={e => setCategoryF(e.target.value)} className={`${INP} w-44`}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={vendorF} onChange={e => setVendorF(e.target.value)} className={`${INP} w-40`}>
          <option value="">All Vendors</option>
          {vendors.map(v => <option key={v.id} value={v.id}>{v.brand_name}</option>)}
        </select>
        <select value={statusF} onChange={e => setStatusF(e.target.value)} className={`${INP} w-36`}>
          <option value="">All Status</option>
          {["Unpaid","Partially Paid","Paid"].map(s => <option key={s}>{s}</option>)}
        </select>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className={`${INP} w-36`} />
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className={`${INP} w-36`} />
        <button onClick={() => { setEditRow(null); setShowCreate(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white whitespace-nowrap"
          style={{ background: G }}>
          <Plus size={15} /> Add Expense
        </button>
      </div>

      {/* Table */}
      <div className={`${CARD} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-100 bg-gray-50/60">
              <tr>
                {["Exp No.","Category","Vendor","Reference","Amount","Paid","Status","Date",""].map(h => (
                  <th key={h} className={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={9} className="py-12 text-center text-sm text-gray-400">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="py-12 text-center">
                  <Receipt size={32} className="mx-auto text-gray-200 mb-2" />
                  <p className="text-sm text-gray-400">No expenses yet. Click Add Expense to record one.</p>
                  <button onClick={() => { setEditRow(null); setShowCreate(true); }}
                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                    style={{ background: G }}>
                    <Plus size={14} /> Add Expense
                  </button>
                </td></tr>
              ) : rows.map(r => (
                <tr key={r.expense_id} className="hover:bg-gray-50/40 transition">
                  <td className={TD}><span className="font-mono text-xs font-semibold text-[#C6AF4B]">{r.expense_number}</span></td>
                  <td className={TD}><span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-semibold">{r.expense_category}</span></td>
                  <td className={TD}>{r.vendor_name || <span className="text-gray-300">—</span>}</td>
                  <td className={TD}>{r.reference_type !== "Manual" ? <span className="text-xs text-gray-500">{r.reference_type}{r.reference_id ? ` #${r.reference_id}` : ""}</span> : <span className="text-gray-300">—</span>}</td>
                  <td className={`${TD} font-semibold`}>{fmtAmt(r.amount, r.currency_code === "INR" ? "₹" : r.currency_code + " ")}</td>
                  <td className={TD}><span className="text-green-700 font-semibold">{fmtAmt(r.paid_amount)}</span></td>
                  <td className={TD}>{badge(r.payment_status, EXP_STATUS[r.payment_status] ?? "bg-gray-100 text-gray-600")}</td>
                  <td className={TD}>{fmtDate(r.expense_date)}</td>
                  <td className={TD}>
                    <button onClick={e => openDrop(e, r.expense_id)} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
                      <MoreHorizontal size={14} className="text-gray-500" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dropdown */}
      {dropId !== null && dropPos && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => { setDropId(null); setDropPos(null); }} />
          <div className={`${CARD} fixed z-[9999]`} style={{ top: dropPos.top, right: dropPos.right }}>
            <DropdownMenu items={[
              {
                label: "Record Payment", icon: <CreditCard size={14} />,
                onClick: () => { const exp = rows.find(r => r.expense_id === dropId); if (exp) setPayModal(exp); setDropId(null); setDropPos(null); },
              },
              {
                label: "Edit", icon: <FileText size={14} />,
                onClick: () => { const exp = rows.find(r => r.expense_id === dropId); if (exp) { setEditRow(exp); setShowCreate(true); } setDropId(null); setDropPos(null); },
              },
              {
                label: "Delete", icon: <Trash2 size={14} />, danger: true,
                onClick: () => { deleteExp(dropId!); setDropId(null); setDropPos(null); },
              },
            ]} />
          </div>
        </>,
        document.body
      )}

      {/* Create / Edit Modal */}
      {showCreate && (
        <ExpenseModal
          vendors={vendors}
          categories={categories}
          initial={editRow}
          onClose={() => { setShowCreate(false); setEditRow(null); }}
          onSave={async data => {
            if (editRow) {
              await customFetch(`/api/account-purchases/expenses/${editRow.expense_id}`, { method: "PUT", body: JSON.stringify(data) });
              toast({ title: "Expense updated" });
            } else {
              await customFetch("/api/account-purchases/expenses", { method: "POST", body: JSON.stringify(data) });
              toast({ title: "Expense recorded successfully and added to vendor ledger" });
            }
            // Refresh categories
            customFetch<any>("/api/account-purchases/expenses/categories").then(j => setCategories(j.data ?? DEFAULT_CATEGORIES)).catch(() => {});
            load();
          }}
        />
      )}

      {/* Payment modal */}
      {payModal && (
        <PaymentModal
          title={`Record Payment — ${payModal.expense_number}`}
          totalAmount={parseFloat(payModal.amount ?? "0") - parseFloat(payModal.paid_amount ?? "0")}
          onClose={() => setPayModal(null)}
          onSave={async data => {
            await customFetch(`/api/account-purchases/expenses/${payModal.expense_id}/payment`, {
              method: "POST", body: JSON.stringify(data),
            });
            toast({ title: "Payment recorded" });
            load();
          }}
        />
      )}
    </div>
  );
}

/* ── Expense Create / Edit Modal ─────────────────────── */
function ExpenseModal({
  vendors, categories, initial, onClose, onSave,
}: {
  vendors: any[]; categories: string[]; initial: any | null;
  onClose: () => void; onSave: (data: any) => Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    expense_category: initial?.expense_category ?? "",
    custom_category: "",
    vendor_id: String(initial?.vendor_id ?? ""),
    vendor_name: initial?.vendor_name ?? "",
    reference_type: initial?.reference_type ?? "Manual",
    reference_id: initial?.reference_id ?? "",
    amount: String(initial?.amount ?? ""),
    currency_code: initial?.currency_code ?? "INR",
    payment_status: initial?.payment_status ?? "Unpaid",
    payment_type: initial?.payment_type ?? "Bank Transfer",
    expense_date: initial?.expense_date?.slice(0, 10) ?? today,
    remarks: initial?.remarks ?? "",
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function submit() {
    const cat = form.expense_category === "__custom__" ? form.custom_category : form.expense_category;
    if (!cat) { toast({ title: "Category is required", variant: "destructive" }); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast({ title: "Amount must be > 0", variant: "destructive" }); return; }
    if (!form.expense_date) { toast({ title: "Date is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const vendor = vendors.find(v => String(v.id) === form.vendor_id);
      await onSave({ ...form, expense_category: cat, vendor_name: vendor?.brand_name || form.vendor_name });
      onClose();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
      <div className={`${CARD} w-[580px] max-h-[90vh] overflow-y-auto p-6`}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900">{initial ? "Edit Expense" : "Add Expense"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={LBL}>Expense Category *</label>
              <select value={form.expense_category} onChange={e => setF("expense_category", e.target.value)} className={INP}>
                <option value="">— Select Category —</option>
                {categories.map(c => <option key={c}>{c}</option>)}
                <option value="__custom__">+ Add Custom Category</option>
              </select>
              {form.expense_category === "__custom__" && (
                <input value={form.custom_category} onChange={e => setF("custom_category", e.target.value)} className={`${INP} mt-2`} placeholder="Enter new category name" />
              )}
            </div>
            <div>
              <label className={LBL}>Vendor (optional)</label>
              <select value={form.vendor_id} onChange={e => setF("vendor_id", e.target.value)} className={INP}>
                <option value="">— No Vendor —</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.brand_name}</option>)}
              </select>
            </div>
            <div>
              <label className={LBL}>Currency</label>
              <select value={form.currency_code} onChange={e => setF("currency_code", e.target.value)} className={INP}>
                {["INR","USD","EUR","GBP","AED"].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={LBL}>Amount *</label>
              <input type="number" value={form.amount} onChange={e => setF("amount", e.target.value)} className={INP} min="0.01" step="0.01" placeholder="0.00" />
            </div>
            <div>
              <label className={LBL}>Expense Date *</label>
              <input type="date" value={form.expense_date} onChange={e => setF("expense_date", e.target.value)} className={INP} />
            </div>
            <div>
              <label className={LBL}>Reference Type</label>
              <select value={form.reference_type} onChange={e => setF("reference_type", e.target.value)} className={INP}>
                {["Manual","Swatch","Style","Purchase Order"].map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className={LBL}>Reference ID</label>
              <input value={form.reference_id} onChange={e => setF("reference_id", e.target.value)} className={INP} placeholder="Order code / PO number" />
            </div>
            <div>
              <label className={LBL}>Payment Status</label>
              <select value={form.payment_status} onChange={e => setF("payment_status", e.target.value)} className={INP}>
                {["Unpaid","Partially Paid","Paid"].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={LBL}>Payment Type</label>
              <select value={form.payment_type} onChange={e => setF("payment_type", e.target.value)} className={INP}>
                {PAYMENT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className={LBL}>Remarks</label>
              <textarea value={form.remarks} onChange={e => setF("remarks", e.target.value)} rows={2} className={`${INP} resize-none`} placeholder="Optional notes…" />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-5 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition"
            style={{ background: G }}>
            {saving ? "Saving…" : initial ? "Update Expense" : "Save Expense"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   PURCHASE SUMMARY DASHBOARD
══════════════════════════════════════════════════════ */
interface SummaryData {
  purchaseOrders:   { totalCount: number; totalAmount: number; pendingAmount: number; completedAmount: number };
  purchaseReceipts: { totalCount: number; receivedValue: number; pendingValue: number; closedValue: number };
  vendorBills:      { totalCount: number; totalAmount: number; paidAmount: number; pendingAmount: number };
  paidToVendors:    { totalCount: number; totalPaid: number };
  pendingPayables:  { totalPending: number; billPending: number; expPending: number };
  otherExpenses:    { totalCount: number; totalAmount: number; paidAmount: number; pendingAmount: number };
}

function PurchaseSummaryDashboard({ onTabChange }: { onTabChange: (tab: string) => void }) {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate]     = useState("");
  const [vendorId, setVendorId] = useState("");
  const [vendors, setVendors]   = useState<any[]>([]);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate)  params.set("from_date", fromDate);
      if (toDate)    params.set("to_date",   toDate);
      if (vendorId)  params.set("vendor_id", vendorId);
      const j = await customFetch<any>(`/api/account-purchases/summary?${params}`);
      setSummary(j.data ?? null);
      toast({ title: "Enhanced purchase summary loaded successfully" });
    } catch { /* silent */ } finally { setLoading(false); }
  }, [fromDate, toDate, vendorId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    customFetch<any>("/api/vendors?limit=500").then(j => setVendors(j.data ?? [])).catch(() => {});
  }, []);

  const s = summary;

  function SummaryCard({
    title, icon, iconBg, rows, badge, viewTab, viewLabel,
  }: {
    title: string;
    icon: React.ReactNode;
    iconBg: string;
    rows: { label: string; value: string; color?: string }[];
    badge?: string;
    viewTab?: string;
    viewLabel?: string;
  }) {
    return (
      <div className={`${CARD} p-5 flex flex-col gap-3`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${iconBg}`}>{icon}</div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
              {badge && <span className="mt-0.5 inline-block text-[10px] px-2 py-0.5 rounded-full bg-[#C6AF4B]/10 text-[#8a7a2e] font-semibold">{badge}</span>}
            </div>
          </div>
          {loading && <RefreshCw size={13} className="text-gray-300 animate-spin mt-1" />}
        </div>
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.label} className="flex items-center justify-between">
              <span className="text-xs text-gray-500">{r.label}</span>
              <span className={`text-sm font-bold ${r.color ?? "text-gray-900"}`}>{r.value}</span>
            </div>
          ))}
        </div>
        {viewTab && (
          <button
            onClick={() => onTabChange(viewTab)}
            className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-[#C6AF4B] hover:text-[#a8922e] transition self-start"
          >
            {viewLabel ?? "View"} <ArrowRight size={12} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5 mb-8">
      {/* Filters */}
      <div className={`${CARD} p-4 flex items-center gap-3 flex-wrap`}>
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <Filter size={13} /> Filters
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">From</span>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className={`${INP} w-36`} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">To</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className={`${INP} w-36`} />
        </div>
        <select value={vendorId} onChange={e => setVendorId(e.target.value)} className={`${INP} w-44`}>
          <option value="">All Vendors</option>
          {vendors.map(v => <option key={v.id} value={v.id}>{v.brand_name}</option>)}
        </select>
        <button
          onClick={() => { setFromDate(""); setToDate(""); setVendorId(""); }}
          className="text-xs text-gray-400 hover:text-gray-600 px-3 py-2 rounded-xl border border-gray-200 transition"
        >
          Clear
        </button>
      </div>

      {/* Row 1 */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard
          title="Purchase Orders"
          icon={<ShoppingCart size={18} className="text-[#C6AF4B]" />}
          iconBg="bg-[#C6AF4B]/10"
          badge={s ? `${s.purchaseOrders.totalCount} POs` : "—"}
          rows={[
            { label: "Total PO Amount",    value: fmtAmt(s?.purchaseOrders.totalAmount ?? 0) },
            { label: "Pending PO Amount",  value: fmtAmt(s?.purchaseOrders.pendingAmount ?? 0),   color: "text-amber-600" },
            { label: "Completed PO Amount",value: fmtAmt(s?.purchaseOrders.completedAmount ?? 0), color: "text-green-700" },
          ]}
          viewTab="po"
          viewLabel="View Purchase Orders"
        />
        <SummaryCard
          title="Purchase Receipts"
          icon={<Package size={18} className="text-blue-500" />}
          iconBg="bg-blue-50"
          badge={s ? `${s.purchaseReceipts.totalCount} Receipts` : "—"}
          rows={[
            { label: "Received Value",      value: fmtAmt(s?.purchaseReceipts.receivedValue ?? 0) },
            { label: "Pending Delivery",    value: fmtAmt(s?.purchaseReceipts.pendingValue ?? 0),  color: "text-amber-600" },
            { label: "Closed Receipt Value",value: fmtAmt(s?.purchaseReceipts.closedValue ?? 0),   color: "text-green-700" },
          ]}
          viewTab="po"
          viewLabel="View Purchase Receipts"
        />
        <SummaryCard
          title="Vendor Bills"
          icon={<FileText size={18} className="text-indigo-500" />}
          iconBg="bg-indigo-50"
          badge={s ? `${s.vendorBills.totalCount} Bills` : "—"}
          rows={[
            { label: "Total Bill Amount", value: fmtAmt(s?.vendorBills.totalAmount ?? 0) },
            { label: "Paid Amount",       value: fmtAmt(s?.vendorBills.paidAmount ?? 0),   color: "text-green-700" },
            { label: "Pending Amount",    value: fmtAmt(s?.vendorBills.pendingAmount ?? 0), color: "text-red-600" },
          ]}
          viewTab="bills"
          viewLabel="View Vendor Bills"
        />
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard
          title="Total Paid to Vendors"
          icon={<Wallet size={18} className="text-green-600" />}
          iconBg="bg-green-50"
          badge={s ? `${s.paidToVendors.totalCount} Payments` : "—"}
          rows={[
            { label: "Total Paid Amount", value: fmtAmt(s?.paidToVendors.totalPaid ?? 0), color: "text-green-700" },
          ]}
        />
        <SummaryCard
          title="Pending Vendor Payables"
          icon={<AlertTriangle size={18} className="text-red-500" />}
          iconBg="bg-red-50"
          rows={[
            { label: "Total Pending",       value: fmtAmt(s?.pendingPayables.totalPending ?? 0), color: "text-red-600" },
            { label: "Unpaid Vendor Bills", value: fmtAmt(s?.pendingPayables.billPending ?? 0),  color: "text-red-500" },
            { label: "Unpaid Expenses",     value: fmtAmt(s?.pendingPayables.expPending ?? 0),   color: "text-amber-600" },
          ]}
        />
        <SummaryCard
          title="Other Expenses"
          icon={<BarChart3 size={18} className="text-purple-500" />}
          iconBg="bg-purple-50"
          badge={s ? `${s.otherExpenses.totalCount} Expenses` : "—"}
          rows={[
            { label: "Total Expense Amount", value: fmtAmt(s?.otherExpenses.totalAmount ?? 0) },
            { label: "Paid Expense Amount",  value: fmtAmt(s?.otherExpenses.paidAmount ?? 0),   color: "text-green-700" },
            { label: "Pending Amount",       value: fmtAmt(s?.otherExpenses.pendingAmount ?? 0), color: "text-red-600" },
          ]}
          viewTab="expenses"
          viewLabel="View Other Expenses"
        />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════ */
const TABS = [
  { id: "po",       label: "Purchase Orders", icon: <ShoppingCart size={15} /> },
  { id: "bills",    label: "Vendor Bills",    icon: <FileText size={15} /> },
  { id: "expenses", label: "Other Expenses",  icon: <Receipt size={15} /> },
];

export default function AccountPurchases() {
  const initialTab = new URLSearchParams(window.location.search).get("tab") ?? "po";
  const [activeTab, setActiveTab] = useState(initialTab);
  const { data: me, isError } = useGetMe();

  if (isError || !(me as any)?.id) {
    return <div className="flex items-center justify-center h-screen text-gray-400">Please log in.</div>;
  }

  return (
    <div className="min-h-screen bg-[#F7F5F0]">
      <TopNavbar />
      <div className="max-w-screen-xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="p-2.5 rounded-xl bg-[#C6AF4B]/10">
            <Package size={22} className="text-[#C6AF4B]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Purchases</h1>
            <p className="text-sm text-gray-500 mt-0.5">Purchase orders, vendor bills & expense management</p>
          </div>
        </div>

        {/* Summary Dashboard */}
        <PurchaseSummaryDashboard onTabChange={setActiveTab} />

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 bg-white border border-[#C6AF4B]/15 rounded-2xl p-1 shadow-sm w-fit">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === t.id
                  ? "text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
              style={activeTab === t.id ? { background: G } : {}}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "po"       && <PurchaseOrdersTab />}
        {activeTab === "bills"    && <VendorBillsTab />}
        {activeTab === "expenses" && <OtherExpensesTab />}
      </div>
    </div>
  );
}
