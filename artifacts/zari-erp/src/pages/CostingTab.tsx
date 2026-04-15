import { useState, useRef } from "react";
import {
  Plus, Trash2, ChevronDown, ChevronUp, Loader2,
  ShoppingCart, FileText, CreditCard, X, CheckCircle2,
  ArrowRight, Paperclip,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAllVendors } from "@/hooks/useVendors";
import { useAllMaterials } from "@/hooks/useMaterials";
import { useAllFabrics } from "@/hooks/useFabrics";
import {
  useSwatchBom, useAddBomRow, useDeleteBomRow,
  useSwatchPOs, useCreatePO, useUpdatePO, useDeletePO,
  useSwatchPRs, useCreatePR, useDeletePR,
  usePrPayments, useAddPayment, useDeletePayment,
  type BomRecord, type PurchaseOrderRecord, type PurchaseReceiptRecord, type PrPaymentRecord,
} from "@/hooks/useCosting";

const PO_STATUSES = ["Draft", "Pending Approval", "Approved", "In Process", "Closed"];
const PO_STATUS_COLORS: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-600",
  "Pending Approval": "bg-amber-100 text-amber-700",
  Approved: "bg-green-100 text-green-700",
  "In Process": "bg-blue-100 text-blue-700",
  Closed: "bg-gray-200 text-gray-500",
};
const PR_STATUS_COLORS: Record<string, string> = {
  Open: "bg-blue-100 text-blue-700",
  Closed: "bg-gray-200 text-gray-500",
};

function SectionHeader({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <span className="text-gray-400">{icon}</span>
        <h3 className="text-sm font-bold text-gray-900 tracking-tight">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <tr><td colSpan={99} className="px-4 py-6 text-center text-xs text-gray-400 italic">{text}</td></tr>
  );
}

function StatusBadge({ status, map }: { status: string; map: Record<string, string> }) {
  const cls = map[status] ?? "bg-gray-100 text-gray-600";
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>{status}</span>;
}


// ─── BOM Section ─────────────────────────────────────────────────────────────
function BomSection({ swatchOrderId }: { swatchOrderId: number }) {
  const { toast } = useToast();
  const { data: rows = [], isLoading } = useSwatchBom(swatchOrderId);
  const addRow = useAddBomRow();
  const deleteRow = useDeleteBomRow();
  const { data: allMaterials = [] } = useAllMaterials();
  const { data: allFabrics = [] } = useAllFabrics();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    materialType: "", materialId: 0, materialCode: "", materialName: "",
    currentStock: "", avgUnitPrice: "", unitType: "", warehouseLocation: "", requiredQty: "",
  });

  const estimatedAmount = (parseFloat(form.requiredQty) || 0) * (parseFloat(form.avgUnitPrice) || 0);

  function onMaterialChange(id: string) {
    if (!id) { setForm(f => ({ ...f, materialType: "", materialId: 0, materialCode: "", materialName: "", currentStock: "", avgUnitPrice: "", unitType: "", warehouseLocation: "" })); return; }
    const m = allMaterials.find(m => String(m.id) === id);
    if (!m) return;
    setForm(f => ({
      ...f,
      materialType: "material", materialId: m.id,
      materialCode: m.materialCode,
      materialName: [m.itemType, m.quality].filter(Boolean).join(" – "),
      currentStock: m.currentStock, avgUnitPrice: m.unitPrice,
      unitType: m.unitType, warehouseLocation: m.location ?? "",
    }));
  }

  function onFabricChange(id: string) {
    if (!id) { setForm(f => ({ ...f, materialType: "", materialId: 0, materialCode: "", materialName: "", currentStock: "", avgUnitPrice: "", unitType: "", warehouseLocation: "" })); return; }
    const f = allFabrics.find(f => String(f.id) === id);
    if (!f) return;
    setForm(prev => ({
      ...prev,
      materialType: "fabric", materialId: f.id,
      materialCode: f.fabricCode,
      materialName: [f.fabricType, f.quality].filter(Boolean).join(" – "),
      currentStock: f.currentStock, avgUnitPrice: f.pricePerMeter,
      unitType: f.unitType, warehouseLocation: f.location ?? "",
    }));
  }

  async function handleAdd() {
    if (!form.materialId) { toast({ title: "Select a material or fabric first", variant: "destructive" }); return; }
    if (!form.requiredQty || parseFloat(form.requiredQty) <= 0) { toast({ title: "Required quantity must be > 0", variant: "destructive" }); return; }
    await addRow.mutateAsync({ ...form, swatchOrderId, estimatedAmount: estimatedAmount.toFixed(2) });
    setForm({ materialType: "", materialId: 0, materialCode: "", materialName: "", currentStock: "", avgUnitPrice: "", unitType: "", warehouseLocation: "", requiredQty: "" });
    setShowForm(false);
    toast({ title: "BOM row added" });
  }

  const totalEstimated = rows.reduce((s, r) => s + parseFloat(r.estimatedAmount || "0"), 0);

  const selectedMaterialId = form.materialType === "material" ? String(form.materialId) : "";
  const selectedFabricId = form.materialType === "fabric" ? String(form.materialId) : "";

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <SectionHeader icon={<FileText className="h-4 w-4" />} title="Bill of Materials (BOM)">
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-gray-900 text-[#C9B45C] hover:bg-black transition-colors">
          <Plus className="h-3.5 w-3.5" /> Add Material
        </button>
      </SectionHeader>

      {showForm && (
        <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">
                Select Material
                {form.materialType === "fabric" && <span className="ml-1 text-[9px] text-amber-500 normal-case">(clear fabric first)</span>}
              </label>
              <select
                value={selectedMaterialId}
                disabled={form.materialType === "fabric"}
                onChange={e => { onMaterialChange(e.target.value); }}
                className={`w-full mt-0.5 text-xs text-gray-900 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/10 bg-white transition-opacity ${form.materialType === "fabric" ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                <option value="">— Select material —</option>
                {allMaterials.map(m => (
                  <option key={m.id} value={m.id}>
                    {[m.itemType, m.quality].filter(Boolean).join(" – ")} ({m.materialCode})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">
                Select Fabric
                {form.materialType === "material" && <span className="ml-1 text-[9px] text-amber-500 normal-case">(clear material first)</span>}
              </label>
              <select
                value={selectedFabricId}
                disabled={form.materialType === "material"}
                onChange={e => { onFabricChange(e.target.value); }}
                className={`w-full mt-0.5 text-xs text-gray-900 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/10 bg-white transition-opacity ${form.materialType === "material" ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                <option value="">— Select fabric —</option>
                {allFabrics.map(f => (
                  <option key={f.id} value={f.id}>
                    {[f.fabricType, f.quality].filter(Boolean).join(" – ")} ({f.fabricCode})
                  </option>
                ))}
              </select>
            </div>
          </div>
          {form.materialId > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-white rounded-lg border border-gray-200 px-3 py-2">
                <p className="text-[10px] text-gray-400">Stock</p>
                <p className="font-semibold text-gray-800">{form.currentStock} {form.unitType}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 px-3 py-2">
                <p className="text-[10px] text-gray-400">Avg Price</p>
                <p className="font-semibold text-gray-800">₹{form.avgUnitPrice}/{form.unitType}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 px-3 py-2">
                <p className="text-[10px] text-gray-400">Unit</p>
                <p className="font-semibold text-gray-800">{form.unitType}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 px-3 py-2">
                <p className="text-[10px] text-gray-400">Location</p>
                <p className="font-semibold text-gray-800 truncate">{form.warehouseLocation || "—"}</p>
              </div>
            </div>
          )}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-[10px] text-gray-500 font-medium">Required Qty</label>
              <input type="number" min="0" step="any"
                value={form.requiredQty}
                onChange={e => setForm(f => ({ ...f, requiredQty: e.target.value }))}
                className="w-full mt-0.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                placeholder="0" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-gray-500 font-medium">Estimated Amount</label>
              <div className="mt-0.5 text-xs border border-gray-100 rounded-xl px-3 py-2 bg-gray-50 font-semibold text-gray-700">
                ₹{estimatedAmount.toFixed(2)}
              </div>
            </div>
            <button onClick={handleAdd} disabled={addRow.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-900 text-[#C9B45C] text-xs font-semibold hover:bg-black transition-colors disabled:opacity-60">
              {addRow.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add
            </button>
            <button onClick={() => setShowForm(false)} className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100">
              {["Code", "Material / Fabric", "Stock", "Avg Price", "Unit", "Location", "Req Qty", "Est. Amount", ""].map(h => (
                <th key={h} className="text-left text-[10px] font-semibold text-gray-400 px-3 py-2 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="px-4 py-6 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto text-gray-400" /></td></tr>
            ) : rows.length === 0 ? (
              <EmptyRow text="No BOM rows yet. Add a material above." />
            ) : rows.map(r => (
              <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-3 py-2.5 font-mono text-[10px] text-gray-500">{r.materialCode}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] px-1 py-0.5 rounded font-bold shrink-0 ${r.materialType === "fabric" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                      {r.materialType === "fabric" ? "FAB" : "MAT"}
                    </span>
                    <span className="text-gray-800 font-medium">{r.materialName}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-gray-600">{r.currentStock}</td>
                <td className="px-3 py-2.5 text-gray-600">₹{r.avgUnitPrice}</td>
                <td className="px-3 py-2.5 text-gray-500">{r.unitType}</td>
                <td className="px-3 py-2.5 text-gray-500 max-w-[100px] truncate">{r.warehouseLocation || "—"}</td>
                <td className="px-3 py-2.5 font-semibold text-gray-800">{r.requiredQty}</td>
                <td className="px-3 py-2.5 font-semibold text-gray-900">₹{parseFloat(r.estimatedAmount).toFixed(2)}</td>
                <td className="px-3 py-2.5">
                  <button onClick={() => deleteRow.mutate(r.id)} disabled={deleteRow.isPending}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length > 0 && (
              <tr className="bg-gray-50">
                <td colSpan={7} className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Total Estimated</td>
                <td className="px-3 py-2 font-bold text-gray-900 text-sm">₹{totalEstimated.toFixed(2)}</td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Payment Row ──────────────────────────────────────────────────────────────
function PaymentRow({ pay, onDelete }: { pay: PrPaymentRecord; onDelete: () => void }) {
  const PAYMENT_STATUS_COLORS: Record<string, string> = {
    Pending: "bg-amber-100 text-amber-700",
    Processing: "bg-blue-100 text-blue-700",
    Completed: "bg-green-100 text-green-700",
    Failed: "bg-red-100 text-red-700",
  };
  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/50">
      <td className="px-3 py-2.5 text-gray-700 font-medium">{pay.paymentType}</td>
      <td className="px-3 py-2.5 text-gray-600">{pay.paymentMode || "—"}</td>
      <td className="px-3 py-2.5 font-semibold text-gray-900">₹{pay.amount}</td>
      <td className="px-3 py-2.5 text-gray-500">{pay.paymentDate ? new Date(pay.paymentDate).toLocaleDateString() : "—"}</td>
      <td className="px-3 py-2.5 text-gray-500">{pay.transactionStatus || "—"}</td>
      <td className="px-3 py-2.5"><StatusBadge status={pay.paymentStatus} map={PAYMENT_STATUS_COLORS} /></td>
      <td className="px-3 py-2.5">
        {pay.attachment ? (
          <a href={pay.attachment.data} download={pay.attachment.name}
            className="flex items-center gap-1 text-[10px] text-blue-600 hover:underline">
            <Paperclip className="h-3 w-3" />{pay.attachment.name}
          </a>
        ) : <span className="text-gray-300">—</span>}
      </td>
      <td className="px-3 py-2.5">
        <button onClick={onDelete} className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}

// ─── PR Accordion (inside PO) ─────────────────────────────────────────────────
function PrAccordion({ pr, swatchOrderId }: { pr: PurchaseReceiptRecord; swatchOrderId: number }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [showPayForm, setShowPayForm] = useState(false);
  const deletePR = useDeletePR();
  const { data: payments = [] } = usePrPayments(open ? pr.id : null);
  const addPay = useAddPayment();
  const delPay = useDeletePayment();
  const fileRef = useRef<HTMLInputElement>(null);

  const [payForm, setPayForm] = useState({
    paymentType: "Partial", paymentDate: new Date().toISOString().slice(0, 10),
    paymentMode: "", amount: "", transactionStatus: "", paymentStatus: "Pending", attachment: null as null | { name: string; type: string; data: string; size: number },
  });

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPayForm(f => ({ ...f, attachment: { name: file.name, type: file.type, data: ev.target?.result as string, size: file.size } }));
    reader.readAsDataURL(file);
  }

  async function handleAddPayment() {
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) { toast({ title: "Enter a valid amount", variant: "destructive" }); return; }
    await addPay.mutateAsync({ prId: pr.id, ...payForm });
    setPayForm({ paymentType: "Partial", paymentDate: new Date().toISOString().slice(0, 10), paymentMode: "", amount: "", transactionStatus: "", paymentStatus: "Pending", attachment: null });
    setShowPayForm(false);
    toast({ title: "Payment recorded" });
  }

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50">
        <span className="text-[10px] font-mono font-bold text-gray-600">{pr.prNumber}</span>
        <span className="text-xs text-gray-700 flex-1">Qty: <span className="font-semibold">{pr.receivedQty}</span> · Price: <span className="font-semibold">₹{pr.actualPrice}</span> · {pr.warehouseLocation || "No location"}</span>
        <StatusBadge status={pr.status} map={PR_STATUS_COLORS} />
        <button onClick={() => deletePR.mutate(pr.id)} disabled={deletePR.isPending}
          className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
          <Trash2 className="h-3 w-3" />
        </button>
        <button onClick={() => setOpen(v => !v)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-200 transition-colors">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {open && (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payments</p>
            <button onClick={() => setShowPayForm(v => !v)}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-gray-900 text-[#C9B45C] hover:bg-black transition-colors">
              <CreditCard className="h-3 w-3" /> Record Payment
            </button>
          </div>

          {showPayForm && (
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-gray-500 font-medium">Type</label>
                  <select value={payForm.paymentType} onChange={e => setPayForm(f => ({ ...f, paymentType: e.target.value }))}
                    className="w-full mt-0.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none">
                    {["Advance", "Partial", "Full"].map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-medium">Mode</label>
                  <input value={payForm.paymentMode} onChange={e => setPayForm(f => ({ ...f, paymentMode: e.target.value }))}
                    className="w-full mt-0.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
                    placeholder="Bank / UPI / Cash…" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-medium">Amount (₹)</label>
                  <input type="number" min="0" step="any" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                    className="w-full mt-0.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
                    placeholder="0.00" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-medium">Date</label>
                  <input type="date" value={payForm.paymentDate} onChange={e => setPayForm(f => ({ ...f, paymentDate: e.target.value }))}
                    className="w-full mt-0.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-medium">Transaction Status</label>
                  <input value={payForm.transactionStatus} onChange={e => setPayForm(f => ({ ...f, transactionStatus: e.target.value }))}
                    className="w-full mt-0.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
                    placeholder="e.g. TXN123456" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-medium">Payment Status</label>
                  <select value={payForm.paymentStatus} onChange={e => setPayForm(f => ({ ...f, paymentStatus: e.target.value }))}
                    className="w-full mt-0.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none">
                    {["Pending", "Processing", "Completed", "Failed"].map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors">
                  <Paperclip className="h-3 w-3" /> {payForm.attachment ? payForm.attachment.name : "Attach file"}
                </button>
                {payForm.attachment && <button onClick={() => setPayForm(f => ({ ...f, attachment: null }))} className="text-gray-400 hover:text-red-500"><X className="h-3 w-3" /></button>}
                <input ref={fileRef} type="file" className="hidden" onChange={onFile} />
                <button onClick={handleAddPayment} disabled={addPay.isPending}
                  className="ml-auto flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gray-900 text-[#C9B45C] text-xs font-semibold hover:bg-black transition-colors disabled:opacity-60">
                  {addPay.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Save
                </button>
                <button onClick={() => setShowPayForm(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600"><X className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          )}

          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                {["Type", "Mode", "Amount", "Date", "Txn Status", "Pay Status", "Attachment", ""].map(h => (
                  <th key={h} className="text-left text-[10px] font-semibold text-gray-400 px-3 py-1.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.length === 0
                ? <EmptyRow text="No payments recorded" />
                : payments.map(p => <PaymentRow key={p.id} pay={p} onDelete={() => delPay.mutate(p.id)} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── PO Card ─────────────────────────────────────────────────────────────────
function PoCard({ po, swatchOrderId, onCreatePR }: { po: PurchaseOrderRecord; swatchOrderId: number; onCreatePR: (poId: number, vendorName: string) => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const updatePO = useUpdatePO();
  const deletePO = useDeletePO();
  const { data: prs = [] } = useSwatchPRs(open ? swatchOrderId : -1);
  const poPrs = prs.filter(p => p.poId === po.id);

  const canAdvance = po.status !== "Closed";
  const nextStatus = PO_STATUSES[PO_STATUSES.indexOf(po.status) + 1];
  const canCreatePR = ["Approved", "In Process"].includes(po.status);

  async function advance() {
    if (!nextStatus) return;
    await updatePO.mutateAsync({ id: po.id, status: nextStatus });
    toast({ title: `PO moved to ${nextStatus}` });
  }

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono font-bold text-gray-700">{po.poNumber}</span>
            <StatusBadge status={po.status} map={PO_STATUS_COLORS} />
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{po.vendorName} · {new Date(po.poDate).toLocaleDateString()}</p>
          {po.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{po.notes}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {canAdvance && nextStatus && (
            <button onClick={advance} disabled={updatePO.isPending}
              className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium transition-colors disabled:opacity-50">
              {updatePO.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3" />}
              → {nextStatus}
            </button>
          )}
          {canCreatePR && (
            <button onClick={() => onCreatePR(po.id, po.vendorName)}
              className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-medium hover:bg-blue-100 transition-colors">
              <Plus className="h-3 w-3" /> Create PR
            </button>
          )}
          <button onClick={() => deletePO.mutate(po.id)} disabled={deletePO.isPending}
            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setOpen(v => !v)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-100 p-4 space-y-3 bg-gray-50/40">
          {poPrs.length === 0
            ? <p className="text-xs text-gray-400 italic text-center py-2">No purchase receipts yet. {canCreatePR ? 'Use "Create PR" above.' : `Advance PO to Approved first.`}</p>
            : poPrs.map(pr => <PrAccordion key={pr.id} pr={pr} swatchOrderId={swatchOrderId} />)}
        </div>
      )}
    </div>
  );
}

// ─── PO Section ───────────────────────────────────────────────────────────────
function PoSection({ swatchOrderId }: { swatchOrderId: number }) {
  const { toast } = useToast();
  const { data: pos = [], isLoading } = useSwatchPOs(swatchOrderId);
  const { data: allPrs = [] } = useSwatchPRs(swatchOrderId);
  const { data: vendors = [] } = useAllVendors();
  const createPO = useCreatePO();
  const createPR = useCreatePR();

  const [showPoForm, setShowPoForm] = useState(false);
  const [poForm, setPoForm] = useState({ vendorId: "", notes: "" });

  const [prModal, setPrModal] = useState<{ poId: number; vendorName: string } | null>(null);
  const [prForm, setPrForm] = useState({ receivedQty: "", actualPrice: "", warehouseLocation: "" });

  async function handleCreatePO() {
    if (!poForm.vendorId) { toast({ title: "Select a vendor", variant: "destructive" }); return; }
    await createPO.mutateAsync({ swatchOrderId, vendorId: Number(poForm.vendorId), notes: poForm.notes || undefined });
    setPoForm({ vendorId: "", notes: "" });
    setShowPoForm(false);
    toast({ title: "Purchase Order created" });
  }

  async function handleCreatePR() {
    if (!prModal) return;
    if (!prForm.receivedQty || parseFloat(prForm.receivedQty) <= 0) { toast({ title: "Enter received quantity", variant: "destructive" }); return; }
    if (!prForm.actualPrice || parseFloat(prForm.actualPrice) <= 0) { toast({ title: "Enter actual price", variant: "destructive" }); return; }
    await createPR.mutateAsync({ poId: prModal.poId, swatchOrderId, ...prForm });
    setPrForm({ receivedQty: "", actualPrice: "", warehouseLocation: "" });
    setPrModal(null);
    toast({ title: "Purchase Receipt created" });
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <SectionHeader icon={<ShoppingCart className="h-4 w-4" />} title="Purchase Orders">
        <button onClick={() => setShowPoForm(v => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-gray-900 text-[#C9B45C] hover:bg-black transition-colors">
          <Plus className="h-3.5 w-3.5" /> Create PO
        </button>
      </SectionHeader>

      {showPoForm && (
        <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-gray-500 font-medium">Vendor *</label>
              <select value={poForm.vendorId} onChange={e => setPoForm(f => ({ ...f, vendorId: e.target.value }))}
                className="w-full mt-0.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/10">
                <option value="">Select vendor…</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.brandName}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 font-medium">Notes (optional)</label>
              <input value={poForm.notes} onChange={e => setPoForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full mt-0.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                placeholder="Add notes…" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreatePO} disabled={createPO.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-900 text-[#C9B45C] text-xs font-semibold hover:bg-black transition-colors disabled:opacity-60">
              {createPO.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Create PO
            </button>
            <button onClick={() => setShowPoForm(false)} className="px-4 py-2 rounded-xl text-xs text-gray-500 hover:bg-gray-100 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="py-6 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" /></div>
      ) : pos.length === 0 ? (
        <p className="text-xs text-gray-400 italic text-center py-6">No Purchase Orders yet.</p>
      ) : (
        <div className="space-y-2">
          {pos.map(po => (
            <PoCard key={po.id} po={po} swatchOrderId={swatchOrderId}
              onCreatePR={(poId, vendorName) => setPrModal({ poId, vendorName })} />
          ))}
        </div>
      )}

      {prModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-gray-900">Create Purchase Receipt</h4>
              <button onClick={() => setPrModal(null)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-xs text-gray-500">Vendor: <span className="font-semibold text-gray-700">{prModal.vendorName}</span></p>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-gray-500 font-medium">Received Quantity *</label>
                <input type="number" min="0" step="any" value={prForm.receivedQty}
                  onChange={e => setPrForm(f => ({ ...f, receivedQty: e.target.value }))}
                  className="w-full mt-0.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  placeholder="0" />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 font-medium">Actual Price (₹) *</label>
                <input type="number" min="0" step="any" value={prForm.actualPrice}
                  onChange={e => setPrForm(f => ({ ...f, actualPrice: e.target.value }))}
                  className="w-full mt-0.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  placeholder="0.00" />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 font-medium">Warehouse Location</label>
                <input value={prForm.warehouseLocation}
                  onChange={e => setPrForm(f => ({ ...f, warehouseLocation: e.target.value }))}
                  className="w-full mt-0.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  placeholder="e.g. Rack A-3" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={handleCreatePR} disabled={createPR.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gray-900 text-[#C9B45C] text-xs font-semibold hover:bg-black transition-colors disabled:opacity-60">
                {createPR.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Create PR
              </button>
              <button onClick={() => setPrModal(null)}
                className="px-4 py-2.5 rounded-xl text-xs text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Costing Tab ─────────────────────────────────────────────────────────
export default function CostingTab({ swatchOrderId }: { swatchOrderId: number }) {
  return (
    <div className="space-y-5">
      <BomSection swatchOrderId={swatchOrderId} />
      <PoSection swatchOrderId={swatchOrderId} />
    </div>
  );
}
