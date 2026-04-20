import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useGetMe } from "@workspace/api-client-react";
import { Plus, Trash2, Loader2, Pencil, X, Check, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface CostingPaymentRecord {
  id: number;
  vendor_id: number;
  vendor_name: string | null;
  reference_type: string;
  reference_id: number;
  payment_type: string | null;
  payment_mode: string | null;
  payment_amount: string;
  payment_status: string | null;
  transaction_id: string | null;
  payment_date: string | null;
  remarks: string | null;
  created_at: string;
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  Pending:    "bg-amber-100 text-amber-700 border-amber-200",
  Processing: "bg-blue-100 text-blue-700 border-blue-200",
  Completed:  "bg-green-100 text-green-700 border-green-200",
  Failed:     "bg-red-100 text-red-700 border-red-200",
};

const DEFAULT_FORM = {
  paymentType:   "Partial",
  paymentMode:   "",
  paymentAmount: "",
  paymentStatus: "Pending",
  transactionId: "",
  paymentDate:   new Date().toISOString().slice(0, 10),
  remarks:       "",
};

interface Props {
  referenceType: "outsource_job" | "custom_charge";
  referenceId: number;
  vendorId: number;
  vendorName: string;
  swatchOrderId?: number;
  styleOrderId?: number;
}

export default function CostingPaymentsPanel({
  referenceType, referenceId, vendorId, vendorName, swatchOrderId, styleOrderId,
}: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: meData } = useGetMe();
  const isAdmin = (meData as any)?.role === "admin";

  const [collapsed, setCollapsed] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(DEFAULT_FORM);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);

  const queryKey = ["costing-payments", referenceType, referenceId];
  const { data: payments = [], isLoading } = useQuery<CostingPaymentRecord[]>({
    queryKey,
    queryFn: async () => {
      const res = await customFetch<{ data: CostingPaymentRecord[] }>(
        `/api/costing/costing-payments?referenceType=${referenceType}&referenceId=${referenceId}`
      );
      return res.data ?? [];
    },
  });

  const totalPaid = payments.reduce((s, p) => s + parseFloat(p.payment_amount || "0"), 0);
  const hasCompleted = payments.some(p => p.payment_status === "Completed");

  async function handleSave() {
    if (!form.paymentAmount || parseFloat(form.paymentAmount) <= 0) {
      toast({ title: "Enter a valid payment amount", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      await customFetch("/api/costing/costing-payments", {
        method: "POST",
        body: JSON.stringify({
          vendorId, vendorName, referenceType, referenceId,
          swatchOrderId: swatchOrderId ?? null,
          styleOrderId: styleOrderId ?? null,
          paymentType:   form.paymentType   || null,
          paymentMode:   form.paymentMode   || null,
          paymentAmount: form.paymentAmount,
          paymentStatus: form.paymentStatus || "Pending",
          transactionId: form.transactionId || null,
          paymentDate:   form.paymentDate   || null,
          remarks:       form.remarks       || null,
        }),
      });
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["costing-payments-totals"] });
      setForm(DEFAULT_FORM);
      setShowForm(false);
      toast({ title: "Payment recorded" });
    } catch (e: any) {
      toast({ title: e?.message ?? "Error saving payment", variant: "destructive" });
    } finally { setSaving(false); }
  }

  function startEdit(p: CostingPaymentRecord) {
    setEditingId(p.id);
    setEditForm({
      paymentType:   p.payment_type   ?? "Partial",
      paymentMode:   p.payment_mode   ?? "",
      paymentAmount: p.payment_amount ?? "",
      paymentStatus: p.payment_status ?? "Pending",
      transactionId: p.transaction_id ?? "",
      paymentDate:   p.payment_date   ? p.payment_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      remarks:       p.remarks        ?? "",
    });
  }

  async function handleUpdate() {
    if (!editingId) return;
    setUpdatingId(editingId);
    try {
      await customFetch(`/api/costing/costing-payments/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({
          paymentType:   editForm.paymentType   || null,
          paymentMode:   editForm.paymentMode   || null,
          paymentAmount: editForm.paymentAmount,
          paymentStatus: editForm.paymentStatus || null,
          transactionId: editForm.transactionId || null,
          paymentDate:   editForm.paymentDate   || null,
          remarks:       editForm.remarks       || null,
        }),
      });
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["costing-payments-totals"] });
      setEditingId(null);
      toast({ title: "Payment updated" });
    } catch (e: any) {
      toast({ title: e?.message ?? "Error updating payment", variant: "destructive" });
    } finally { setUpdatingId(null); }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      await customFetch(`/api/costing/costing-payments/${id}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["costing-payments-totals"] });
      toast({ title: "Payment deleted" });
    } catch (e: any) {
      toast({ title: e?.message ?? "Error deleting payment", variant: "destructive" });
    } finally { setDeletingId(null); }
  }

  const inpCls = "mt-0.5 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-amber-400";
  const lblCls = "text-[10px] text-gray-900 font-medium";

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/60 overflow-hidden">
      {/* Collapsible header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200/60">
        <button
          onClick={() => setCollapsed(v => !v)}
          className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 hover:text-gray-800 transition-colors"
        >
          {collapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          Payments{payments.length > 0 ? ` (${payments.length})` : ""}
          {totalPaid > 0 && !collapsed && (
            <span className="ml-1 text-gray-400 font-normal">— Total Paid: ₹{totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          )}
        </button>
        {!collapsed && !hasCompleted && (
          <button
            onClick={() => { setShowForm(v => !v); setEditingId(null); }}
            className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-gray-900 text-[#C9B45C] hover:bg-black transition-colors"
          >
            <Plus className="h-3 w-3" /> Add Payment
          </button>
        )}
        {!collapsed && hasCompleted && (
          <span className="text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-green-200 bg-green-50 text-green-700">
            Payment Completed
          </span>
        )}
      </div>

      {!collapsed && showForm && !hasCompleted && (
        <div className="mx-3 my-2 p-3 bg-white rounded-xl border border-gray-200 space-y-2.5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div>
              <label className={lblCls}>Type</label>
              <select value={form.paymentType} onChange={e => setForm(f => ({ ...f, paymentType: e.target.value }))} className={inpCls}>
                <option>Advance</option>
                <option>Partial</option>
                <option>Full</option>
              </select>
            </div>
            <div>
              <label className={lblCls}>Mode</label>
              <select value={form.paymentMode} onChange={e => setForm(f => ({ ...f, paymentMode: e.target.value }))} className={inpCls}>
                <option value="">Select</option>
                <option>Cash</option>
                <option>Bank Transfer</option>
                <option>UPI</option>
                <option>Cheque</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className={lblCls}>Amount (₹) *</label>
              <input type="number" min="0" step="0.01" value={form.paymentAmount}
                onChange={e => setForm(f => ({ ...f, paymentAmount: e.target.value }))}
                className={inpCls} placeholder="0.00" />
            </div>
            <div>
              <label className={lblCls}>Status</label>
              <select value={form.paymentStatus} onChange={e => setForm(f => ({ ...f, paymentStatus: e.target.value }))} className={inpCls}>
                <option>Pending</option>
                <option>Processing</option>
                <option>Completed</option>
                <option>Failed</option>
              </select>
            </div>
            <div>
              <label className={lblCls}>Transaction ID</label>
              <input value={form.transactionId} onChange={e => setForm(f => ({ ...f, transactionId: e.target.value }))}
                className={inpCls} placeholder="TXN/REF number" />
            </div>
            <div>
              <label className={lblCls}>Payment Date</label>
              <input type="date" value={form.paymentDate} onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))} className={inpCls} />
            </div>
          </div>
          <div>
            <label className={lblCls}>Remarks</label>
            <input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
              className={inpCls} placeholder="Optional notes" />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-900 text-[#C9B45C] hover:bg-black disabled:opacity-60 transition-colors">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Save Payment
            </button>
            <button onClick={() => setShowForm(false)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5">Cancel</button>
          </div>
        </div>
      )}

      {!collapsed && isLoading ? (
        <div className="py-3 text-center px-3"><Loader2 className="h-4 w-4 animate-spin mx-auto text-gray-400" /></div>
      ) : !collapsed && payments.length === 0 ? (
        <p className="text-[10px] text-gray-400 text-center py-2 px-3">No payments recorded yet.</p>
      ) : !collapsed ? (
        <div className="space-y-1 p-3">
          {payments.map(p => (
            editingId === p.id ? (
              <div key={p.id} className="p-3 bg-white rounded-xl border border-amber-200 space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide">Edit Payment</span>
                  <button onClick={() => setEditingId(null)} className="p-0.5 rounded hover:bg-gray-100 text-gray-400"><X className="h-3 w-3" /></button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div>
                    <label className={lblCls}>Type</label>
                    <select value={editForm.paymentType} onChange={e => setEditForm(f => ({ ...f, paymentType: e.target.value }))} className={inpCls}>
                      <option>Advance</option>
                      <option>Partial</option>
                      <option>Full</option>
                    </select>
                  </div>
                  <div>
                    <label className={lblCls}>Mode</label>
                    <select value={editForm.paymentMode} onChange={e => setEditForm(f => ({ ...f, paymentMode: e.target.value }))} className={inpCls}>
                      <option value="">Select</option>
                      <option>Cash</option>
                      <option>Bank Transfer</option>
                      <option>UPI</option>
                      <option>Cheque</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className={lblCls}>Amount (₹)</label>
                    <input type="number" min="0" step="0.01" value={editForm.paymentAmount}
                      onChange={e => setEditForm(f => ({ ...f, paymentAmount: e.target.value }))} className={inpCls} />
                  </div>
                  <div>
                    <label className={lblCls}>Status</label>
                    <select value={editForm.paymentStatus} onChange={e => setEditForm(f => ({ ...f, paymentStatus: e.target.value }))} className={inpCls}>
                      <option>Pending</option>
                      <option>Processing</option>
                      <option>Completed</option>
                      <option>Failed</option>
                    </select>
                  </div>
                  <div>
                    <label className={lblCls}>Transaction ID</label>
                    <input value={editForm.transactionId} onChange={e => setEditForm(f => ({ ...f, transactionId: e.target.value }))} className={inpCls} />
                  </div>
                  <div>
                    <label className={lblCls}>Payment Date</label>
                    <input type="date" value={editForm.paymentDate} onChange={e => setEditForm(f => ({ ...f, paymentDate: e.target.value }))} className={inpCls} />
                  </div>
                </div>
                <div>
                  <label className={lblCls}>Remarks</label>
                  <input value={editForm.remarks} onChange={e => setEditForm(f => ({ ...f, remarks: e.target.value }))} className={inpCls} placeholder="Optional notes" />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button onClick={handleUpdate} disabled={updatingId === p.id}
                    className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60 transition-colors">
                    {updatingId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Update
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5">Cancel</button>
                </div>
              </div>
            ) : (
              <div key={p.id} className="flex items-start gap-2 px-2.5 py-2 bg-white rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-0.5 min-w-0">
                  <div>
                    <p className="text-[9px] text-gray-400 uppercase tracking-wide font-semibold">Type / Mode</p>
                    <p className="text-[10px] text-gray-700 font-medium">{p.payment_type ?? "—"} {p.payment_mode ? `· ${p.payment_mode}` : ""}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-400 uppercase tracking-wide font-semibold">Amount</p>
                    <p className="text-[10px] font-bold text-amber-700">₹{parseFloat(p.payment_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-400 uppercase tracking-wide font-semibold">Status</p>
                    <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded-full border font-semibold ${PAYMENT_STATUS_COLORS[p.payment_status ?? ""] ?? "bg-gray-100 text-gray-500 border-gray-200"}`}>
                      {p.payment_status ?? "—"}
                    </span>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-400 uppercase tracking-wide font-semibold">Date / TXN</p>
                    <p className="text-[10px] text-gray-600">
                      {p.payment_date ? new Date(p.payment_date).toLocaleDateString("en-IN") : "—"}
                      {p.transaction_id ? ` · ${p.transaction_id}` : ""}
                    </p>
                  </div>
                  {p.remarks && (
                    <div className="col-span-2 sm:col-span-4">
                      <p className="text-[9px] text-gray-400">Note: {p.remarks}</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button onClick={() => startEdit(p)}
                    className="p-1 rounded hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors" title="Edit">
                    <Pencil className="h-3 w-3" />
                  </button>
                  {isAdmin && (
                    <button onClick={() => handleDelete(p.id)} disabled={deletingId === p.id}
                      className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50" title="Delete">
                      {deletingId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </button>
                  )}
                </div>
              </div>
            )
          ))}
        </div>
      ) : null}
    </div>
  );
}
