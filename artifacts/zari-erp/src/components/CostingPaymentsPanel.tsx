import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useGetMe } from "@workspace/api-client-react";
import { CreditCard, Plus, Trash2, Loader2, ChevronDown, ChevronUp } from "lucide-react";
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

  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
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
    enabled: open,
  });

  const totalPaid = payments.reduce((s, p) => s + parseFloat(p.payment_amount || "0"), 0);

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
      toast({ title: "Vendor payment recorded in vendor ledger" });
    } catch (e: any) {
      toast({ title: e?.message ?? "Error saving payment", variant: "destructive" });
    } finally { setSaving(false); }
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

  return (
    <div className="mt-2">
      <button
        onClick={() => { setOpen(v => !v); }}
        className="flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors"
      >
        <CreditCard className="h-3 w-3" />
        Payments{payments.length > 0 ? ` (${payments.length})` : ""}
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50/60 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
              Payments{totalPaid > 0 ? ` — Total Paid: ₹${totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : ""}
            </p>
            <button
              onClick={() => setShowForm(v => !v)}
              className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-gray-900 text-[#C9B45C] hover:bg-black transition-colors"
            >
              <Plus className="h-3 w-3" /> Add Payment
            </button>
          </div>

          {showForm && (
            <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-2.5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-gray-500 font-medium">Type</label>
                  <select value={form.paymentType} onChange={e => setForm(f => ({ ...f, paymentType: e.target.value }))}
                    className="mt-0.5 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs">
                    <option>Advance</option>
                    <option>Partial</option>
                    <option>Full</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-medium">Mode</label>
                  <select value={form.paymentMode} onChange={e => setForm(f => ({ ...f, paymentMode: e.target.value }))}
                    className="mt-0.5 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs">
                    <option value="">Select</option>
                    <option>Cash</option>
                    <option>Bank Transfer</option>
                    <option>UPI</option>
                    <option>Cheque</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-medium">Amount (₹) *</label>
                  <input type="number" min="0" step="0.01" value={form.paymentAmount}
                    onChange={e => setForm(f => ({ ...f, paymentAmount: e.target.value }))}
                    className="mt-0.5 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                    placeholder="0.00" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-medium">Status</label>
                  <select value={form.paymentStatus} onChange={e => setForm(f => ({ ...f, paymentStatus: e.target.value }))}
                    className="mt-0.5 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs">
                    <option>Pending</option>
                    <option>Processing</option>
                    <option>Completed</option>
                    <option>Failed</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-medium">Transaction ID</label>
                  <input value={form.transactionId} onChange={e => setForm(f => ({ ...f, transactionId: e.target.value }))}
                    className="mt-0.5 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                    placeholder="TXN/REF number" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-medium">Payment Date</label>
                  <input type="date" value={form.paymentDate} onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))}
                    className="mt-0.5 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 font-medium">Remarks</label>
                <input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                  className="mt-0.5 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                  placeholder="Optional notes" />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-900 text-[#C9B45C] hover:bg-black disabled:opacity-60 transition-colors">
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  Save Payment
                </button>
                <button onClick={() => setShowForm(false)}
                  className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5">Cancel</button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="py-3 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto text-gray-400" /></div>
          ) : payments.length === 0 ? (
            <p className="text-[10px] text-gray-400 text-center py-2">No payments recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] min-w-[520px]">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left font-semibold text-gray-400 px-2 py-1.5 whitespace-nowrap">Type</th>
                    <th className="text-left font-semibold text-gray-400 px-2 py-1.5 whitespace-nowrap">Mode</th>
                    <th className="text-right font-semibold text-amber-500 px-2 py-1.5 whitespace-nowrap">Amount (₹)</th>
                    <th className="text-left font-semibold text-gray-400 px-2 py-1.5 whitespace-nowrap">Status</th>
                    <th className="text-left font-semibold text-gray-400 px-2 py-1.5 whitespace-nowrap">Transaction ID</th>
                    <th className="text-left font-semibold text-gray-400 px-2 py-1.5 whitespace-nowrap">Date</th>
                    <th className="text-left font-semibold text-gray-400 px-2 py-1.5">Remarks</th>
                    {isAdmin && <th className="px-2 py-1.5" />}
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id} className="border-b border-gray-100 hover:bg-white/60">
                      <td className="px-2 py-2 text-gray-700 font-medium">{p.payment_type ?? "—"}</td>
                      <td className="px-2 py-2 text-gray-600">{p.payment_mode ?? "—"}</td>
                      <td className="px-2 py-2 text-right font-semibold text-amber-700">
                        ₹{parseFloat(p.payment_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-2 py-2">
                        <span className={`inline-block px-1.5 py-0.5 rounded-full border font-semibold ${PAYMENT_STATUS_COLORS[p.payment_status ?? ""] ?? "bg-gray-100 text-gray-500 border-gray-200"}`}>
                          {p.payment_status ?? "—"}
                        </span>
                      </td>
                      <td className="px-2 py-2 font-mono text-gray-500">{p.transaction_id ?? "—"}</td>
                      <td className="px-2 py-2 text-gray-500 whitespace-nowrap">
                        {p.payment_date ? new Date(p.payment_date).toLocaleDateString("en-IN") : "—"}
                      </td>
                      <td className="px-2 py-2 text-gray-500 max-w-[120px] truncate" title={p.remarks ?? ""}>{p.remarks ?? "—"}</td>
                      {isAdmin && (
                        <td className="px-2 py-2 text-right">
                          <button onClick={() => handleDelete(p.id)} disabled={deletingId === p.id}
                            className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50">
                            {deletingId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
