import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Printer, Save, Download, RefreshCw, Loader2, FileText, AlertCircle } from "lucide-react";
import { useInvoice, useNextInvoiceNo, useCreateInvoice, useUpdateInvoice, useDeleteInvoice, type InvoiceLineItem } from "@/hooks/useInvoice";
import {
  useSwatchBom, useSwatchPOs, useSwatchPRs,
  useSwatchConsumptionLog, useArtisanTimesheets,
  useOutsourceJobs, useCustomCharges,
} from "@/hooks/useCosting";
import { useToast } from "@/hooks/use-toast";

// ── helpers ──────────────────────────────────────────────────────────────────
function rupee(n: number) { return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function uid() { return Math.random().toString(36).slice(2, 10); }

const CATEGORIES = ["Material", "Labour", "Outsource", "Custom", "Other"];

const CAT_COLORS: Record<string, string> = {
  Material:  "bg-blue-50 text-blue-700 border-blue-200",
  Labour:    "bg-green-50 text-green-700 border-green-200",
  Outsource: "bg-purple-50 text-purple-700 border-purple-200",
  Custom:    "bg-amber-50 text-amber-700 border-amber-200",
  Other:     "bg-gray-100 text-gray-600 border-gray-200",
};

const STATUSES = ["Draft", "Sent", "Paid", "Cancelled"];
const STATUS_COLORS: Record<string, string> = {
  Draft:     "bg-gray-100 text-gray-700 border-gray-300",
  Sent:      "bg-blue-50 text-blue-700 border-blue-300",
  Paid:      "bg-emerald-50 text-emerald-700 border-emerald-300",
  Cancelled: "bg-red-50 text-red-600 border-red-300",
};

const inputCls = "w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20 bg-white";

function blankItem(desc = "", cat = "Other", qty = 1, unitPrice = 0): InvoiceLineItem {
  return { id: uid(), description: desc, category: cat, quantity: qty, unitPrice, total: qty * unitPrice };
}

// ── compute items from costing data ──────────────────────────────────────────
function buildItemsFromCosting(
  bomRows: ReturnType<typeof useSwatchBom>["data"],
  pos: ReturnType<typeof useSwatchPOs>["data"],
  prs: ReturnType<typeof useSwatchPRs>["data"],
  artisanTimesheets: ReturnType<typeof useArtisanTimesheets>["data"],
  outsourceJobs: ReturnType<typeof useOutsourceJobs>["data"],
  customCharges: ReturnType<typeof useCustomCharges>["data"],
): InvoiceLineItem[] {
  const items: InvoiceLineItem[] = [];

  // Material consumed rows
  (bomRows ?? []).forEach(r => {
    const consumedQty = parseFloat(r.consumedQty ?? "0");
    if (consumedQty <= 0) return;
    const avgPrice = parseFloat(r.avgUnitPrice ?? "0");
    // Weighted avg with PO/PR
    const poLineItems = (pos ?? []).flatMap(po => po.bomItems ?? []).filter(i => i.bomRowId === r.id);
    const posWithRow = (pos ?? []).filter(po => (po.bomItems ?? []).some(i => i.bomRowId === r.id));
    const prsForRow = (prs ?? []).filter(pr => {
      if (pr.bomRowId != null) return pr.bomRowId === r.id;
      return posWithRow.some(po => po.id === pr.poId);
    });
    const prQty = prsForRow.reduce((s, pr) => s + (parseFloat(pr.receivedQty) || 0), 0);
    const prTotal = prsForRow.reduce((s, pr) => s + (parseFloat(pr.receivedQty) || 0) * (parseFloat(pr.actualPrice) || 0), 0);
    const stockNum = parseFloat(r.currentStock || "0");
    const weightedAvg = (stockNum + prQty) > 0 ? (stockNum * avgPrice + prTotal) / (stockNum + prQty) : avgPrice;
    const total = consumedQty * weightedAvg;
    items.push(blankItem(`${r.materialName} (${r.materialCode})`, "Material", parseFloat(consumedQty.toFixed(3)), parseFloat(weightedAvg.toFixed(2))));
    // Correct the total
    items[items.length - 1].total = parseFloat(total.toFixed(2));
  });

  // Artisan labour
  (artisanTimesheets ?? []).forEach(r => {
    const total = parseFloat(r.totalRate);
    const hours = parseFloat(r.totalHours);
    const rate = parseFloat(r.hourlyRate);
    items.push({ id: uid(), description: `Artisan Labour – ${r.shiftType} shift (${hours.toFixed(1)} hrs × ${r.noOfArtisans} artisans)`, category: "Labour", quantity: hours * r.noOfArtisans, unitPrice: rate, total });
  });

  // Outsource jobs
  (outsourceJobs ?? []).forEach(r => {
    items.push({ id: uid(), description: `Outsource – ${r.vendorName} (HSN ${r.hsnCode})`, category: "Outsource", quantity: 1, unitPrice: parseFloat(r.totalCost), total: parseFloat(r.totalCost) });
  });

  // Custom charges
  (customCharges ?? []).forEach(r => {
    items.push({ id: uid(), description: r.description, category: "Custom", quantity: parseFloat(r.quantity), unitPrice: parseFloat(r.unitPrice), total: parseFloat(r.totalAmount) });
  });

  return items;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function InvoiceTab({
  swatchOrderId, orderCode, swatchName, clientName: propClientName,
}: {
  swatchOrderId: number;
  orderCode?: string;
  swatchName?: string;
  clientName?: string;
}) {
  const { toast } = useToast();

  const { data: invoice, isLoading: loadingInvoice } = useInvoice(swatchOrderId);
  const { data: nextNo } = useNextInvoiceNo();
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const deleteInvoice = useDeleteInvoice();

  // Costing data for import
  const { data: bomRows = [] } = useSwatchBom(swatchOrderId);
  const { data: pos = [] } = useSwatchPOs(swatchOrderId);
  const { data: prs = [] } = useSwatchPRs(swatchOrderId);
  const { data: artisanTimesheets = [] } = useArtisanTimesheets(swatchOrderId);
  const { data: outsourceJobs = [] } = useOutsourceJobs(swatchOrderId);
  const { data: customCharges = [] } = useCustomCharges(swatchOrderId);

  // ── Form state ─────────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    invoiceDate: today,
    dueDate: "",
    clientName: propClientName ?? "",
    clientAddress: "",
    clientGstin: "",
    clientEmail: "",
    discountType: "flat" as "flat" | "percent",
    discountValue: "0",
    taxLabel: "GST",
    taxRate: "0",
    notes: "",
    paymentTerms: "Payment due within 30 days of invoice date.",
    status: "Draft",
  });
  const [items, setItems] = useState<InvoiceLineItem[]>([blankItem()]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Populate from existing invoice
  useEffect(() => {
    if (!invoice) return;
    setForm({
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate ?? "",
      clientName: invoice.clientName ?? "",
      clientAddress: invoice.clientAddress ?? "",
      clientGstin: invoice.clientGstin ?? "",
      clientEmail: invoice.clientEmail ?? "",
      discountType: (invoice.discountType ?? "flat") as "flat" | "percent",
      discountValue: invoice.discountValue ?? "0",
      taxLabel: invoice.taxLabel ?? "GST",
      taxRate: invoice.taxRate ?? "0",
      notes: invoice.notes ?? "",
      paymentTerms: invoice.paymentTerms ?? "Payment due within 30 days of invoice date.",
      status: invoice.status ?? "Draft",
    });
    setItems((invoice.items as InvoiceLineItem[]).length > 0 ? invoice.items as InvoiceLineItem[] : [blankItem()]);
    setDirty(false);
  }, [invoice]);

  const setField = useCallback(<K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    setDirty(true);
  }, []);

  // ── Line item helpers ───────────────────────────────────────────────────────
  function addItem() {
    setItems(prev => [...prev, blankItem()]);
    setDirty(true);
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
    setDirty(true);
  }

  function updateItem(id: string, field: keyof InvoiceLineItem, raw: string | number) {
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      const updated = { ...i, [field]: field === "description" || field === "category" ? raw : (parseFloat(String(raw)) || 0) };
      updated.total = parseFloat((updated.quantity * updated.unitPrice).toFixed(2));
      return updated;
    }));
    setDirty(true);
  }

  // ── Import from cost sheet ─────────────────────────────────────────────────
  function importFromCostSheet() {
    const imported = buildItemsFromCosting(bomRows, pos, prs, artisanTimesheets, outsourceJobs, customCharges);
    if (imported.length === 0) {
      toast({ title: "Nothing to import", description: "Add consumption, labour, outsource, or custom charges in the Costing tab first.", variant: "destructive" });
      return;
    }
    setItems(imported);
    setDirty(true);
    toast({ title: "Imported from Cost Sheet", description: `${imported.length} line items added.` });
  }

  // ── Calculations ───────────────────────────────────────────────────────────
  const subtotal = items.reduce((s, i) => s + (i.total || 0), 0);
  const discountAmt = form.discountType === "percent"
    ? subtotal * (parseFloat(form.discountValue) || 0) / 100
    : parseFloat(form.discountValue) || 0;
  const afterDiscount = subtotal - discountAmt;
  const taxAmt = afterDiscount * (parseFloat(form.taxRate) || 0) / 100;
  const grandTotal = afterDiscount + taxAmt;

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    try {
      const payload = { ...form, swatchOrderId, items };
      if (invoice) {
        updateInvoice.mutate({ id: invoice.id, ...payload });
      } else {
        createInvoice.mutate({ ...payload, invoiceNo: nextNo ?? undefined });
      }
      setDirty(false);
      toast({ title: "Invoice saved" });
    } finally {
      setSaving(false);
    }
  }

  function handlePrint() { window.print(); }

  const invoiceNo = invoice?.invoiceNo ?? nextNo ?? "INV-—";

  if (loadingInvoice) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;
  }

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #invoice-print, #invoice-print * { visibility: visible; }
          #invoice-print { position: fixed; top: 0; left: 0; width: 100%; font-size: 11px; }
          .no-print { display: none !important; }
          input, textarea, select { border: none !important; background: transparent !important; padding: 0 !important; resize: none; }
        }
      `}</style>

      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div className="no-print flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Invoice</h2>
            <p className="text-xs text-gray-400">{invoiceNo} · {swatchName ?? orderCode}</p>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${STATUS_COLORS[form.status]}`}>{form.status}</span>
          {dirty && <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">Unsaved changes</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={importFromCostSheet}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-600 text-xs font-semibold hover:bg-gray-50 transition-colors">
            <Download className="h-3.5 w-3.5" /> Import from Cost Sheet
          </button>
          <button onClick={() => { void handleSave(); }} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-900 text-[#C9B45C] text-xs font-semibold hover:bg-black transition-colors">
            <Printer className="h-3.5 w-3.5" /> Print / PDF
          </button>
        </div>
      </div>

      {/* ── Invoice Document ───────────────────────────────────────────── */}
      <div id="invoice-print" className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">

        {/* Top accent bar */}
        <div className="h-1.5 bg-gradient-to-r from-gray-900 via-[#C9B45C] to-gray-900" />

        <div className="p-8">

          {/* ── Header ─────────────────────────────────────────────────── */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-2xl font-black tracking-wider text-gray-900">ZARI</span>
                <span className="text-xs font-light tracking-[0.3em] text-gray-400 uppercase">Embroideries</span>
              </div>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                Enterprise Resource Planning<br />
                GSTIN: [Your GSTIN here]
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-gray-900 tracking-tight">INVOICE</p>
              <p className="text-sm font-mono font-bold text-[#C9B45C] mt-1">{invoiceNo}</p>
              {/* Status selector (no-print hidden in print via style tag) */}
              <div className="no-print mt-2">
                <select value={form.status} onChange={e => setField("status", e.target.value)}
                  className={`text-[10px] px-2 py-1 rounded-lg border font-semibold cursor-pointer focus:outline-none ${STATUS_COLORS[form.status]}`}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="hidden print:block mt-1">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${STATUS_COLORS[form.status]}`}>{form.status}</span>
              </div>
            </div>
          </div>

          {/* ── Meta + Bill To ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-8 mb-8">

            {/* Bill To */}
            <div className="bg-gray-50/60 rounded-xl p-4 border border-gray-100">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Bill To</p>
              <div className="space-y-2">
                <input className={inputCls} placeholder="Client Name" value={form.clientName}
                  onChange={e => setField("clientName", e.target.value)} />
                <textarea rows={2} className={`${inputCls} resize-none`} placeholder="Address / City / State / PIN"
                  value={form.clientAddress} onChange={e => setField("clientAddress", e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  <input className={inputCls} placeholder="GSTIN" value={form.clientGstin}
                    onChange={e => setField("clientGstin", e.target.value)} />
                  <input className={inputCls} placeholder="Email" value={form.clientEmail}
                    onChange={e => setField("clientEmail", e.target.value)} />
                </div>
              </div>
            </div>

            {/* Dates + Reference */}
            <div className="space-y-3">
              <div className="bg-gray-50/60 rounded-xl p-4 border border-gray-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Invoice Details</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-medium">Invoice No</span>
                    <span className="font-mono font-bold text-gray-900">{invoiceNo}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-gray-500 font-medium shrink-0">Invoice Date</span>
                    <input type="date" className={`${inputCls} text-right`} value={form.invoiceDate}
                      onChange={e => setField("invoiceDate", e.target.value)} />
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-gray-500 font-medium shrink-0">Due Date</span>
                    <input type="date" className={`${inputCls} text-right`} value={form.dueDate}
                      onChange={e => setField("dueDate", e.target.value)} />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-medium">Order Ref</span>
                    <span className="font-mono text-gray-600">{orderCode ?? "—"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Line Items ─────────────────────────────────────────────── */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Line Items</p>
              <button onClick={addItem}
                className="no-print flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold">
                <Plus className="h-3.5 w-3.5" /> Add Row
              </button>
            </div>

            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-900 text-[#C9B45C]">
                  <th className="text-left px-3 py-2 font-semibold rounded-tl-lg w-6">#</th>
                  <th className="text-left px-3 py-2 font-semibold">Description</th>
                  <th className="text-left px-3 py-2 font-semibold w-28">Category</th>
                  <th className="text-right px-3 py-2 font-semibold w-20">Qty</th>
                  <th className="text-right px-3 py-2 font-semibold w-28">Unit Price ₹</th>
                  <th className="text-right px-3 py-2 font-semibold w-28">Total ₹</th>
                  <th className="w-8 rounded-tr-lg no-print" />
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                    <td className="px-3 py-2 text-gray-400 border-b border-gray-100">{idx + 1}</td>
                    <td className="px-2 py-1.5 border-b border-gray-100">
                      <input
                        className="w-full px-2 py-1 text-xs text-gray-800 border border-transparent rounded-lg focus:border-gray-300 focus:outline-none bg-transparent hover:bg-white focus:bg-white transition-colors"
                        value={item.description}
                        placeholder="Description…"
                        onChange={e => updateItem(item.id, "description", e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-1.5 border-b border-gray-100">
                      <select
                        value={item.category}
                        onChange={e => updateItem(item.id, "category", e.target.value)}
                        className={`w-full text-[10px] px-1.5 py-1 rounded-lg border font-medium focus:outline-none cursor-pointer ${CAT_COLORS[item.category] ?? CAT_COLORS.Other}`}
                      >
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5 border-b border-gray-100">
                      <input
                        type="number" min="0" step="0.001"
                        className="w-full px-2 py-1 text-xs text-right text-gray-800 border border-transparent rounded-lg focus:border-gray-300 focus:outline-none bg-transparent hover:bg-white focus:bg-white transition-colors"
                        value={item.quantity}
                        onChange={e => updateItem(item.id, "quantity", e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-1.5 border-b border-gray-100">
                      <input
                        type="number" min="0" step="0.01"
                        className="w-full px-2 py-1 text-xs text-right text-gray-800 border border-transparent rounded-lg focus:border-gray-300 focus:outline-none bg-transparent hover:bg-white focus:bg-white transition-colors"
                        value={item.unitPrice}
                        onChange={e => updateItem(item.id, "unitPrice", e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-gray-800 border-b border-gray-100">
                      {rupee(item.total)}
                    </td>
                    <td className="px-1 py-1.5 border-b border-gray-100 no-print">
                      <button onClick={() => removeItem(item.id)}
                        className="p-1 text-gray-300 hover:text-red-500 transition-colors rounded">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Totals + Notes side by side ────────────────────────────── */}
          <div className="grid grid-cols-2 gap-8">

            {/* Notes + Payment Terms */}
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Notes</p>
                <textarea rows={3} className={`${inputCls} resize-none`} placeholder="Thank you for your business…"
                  value={form.notes} onChange={e => setField("notes", e.target.value)} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Payment Terms</p>
                <textarea rows={2} className={`${inputCls} resize-none`} placeholder="Payment terms…"
                  value={form.paymentTerms} onChange={e => setField("paymentTerms", e.target.value)} />
              </div>
            </div>

            {/* Totals */}
            <div>
              <div className="bg-gray-50/60 rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-xs">
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-2.5 text-gray-500 font-medium">Subtotal</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-800">{rupee(subtotal)}</td>
                    </tr>

                    {/* Discount row */}
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-2 text-gray-500 font-medium">
                        <div className="flex items-center gap-2">
                          <span>Discount</span>
                          <div className="no-print flex rounded-lg border border-gray-200 overflow-hidden text-[10px]">
                            {(["flat", "percent"] as const).map(t => (
                              <button key={t} onClick={() => setField("discountType", t)}
                                className={`px-2 py-0.5 transition-colors ${form.discountType === t ? "bg-gray-900 text-[#C9B45C]" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
                                {t === "flat" ? "₹" : "%"}
                              </button>
                            ))}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <input type="number" min="0" step="0.01"
                            className="w-24 px-2 py-1 text-xs text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                            value={form.discountValue}
                            onChange={e => setField("discountValue", e.target.value)}
                          />
                          {discountAmt > 0 && <span className="text-gray-400 text-[10px] whitespace-nowrap">− {rupee(discountAmt)}</span>}
                        </div>
                      </td>
                    </tr>

                    {/* Tax row */}
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-2 text-gray-500 font-medium">
                        <div className="flex items-center gap-1.5">
                          <input className="w-16 px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                            value={form.taxLabel} onChange={e => setField("taxLabel", e.target.value)} placeholder="GST" />
                          <span className="text-gray-400 text-[10px]">%</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <input type="number" min="0" max="100" step="0.5"
                            className="w-16 px-2 py-1 text-xs text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                            value={form.taxRate}
                            onChange={e => setField("taxRate", e.target.value)}
                          />
                          <span className="text-gray-400 text-[10px] whitespace-nowrap">= {rupee(taxAmt)}</span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-900">
                      <td className="px-4 py-3 text-xs font-bold text-white tracking-wide">GRAND TOTAL</td>
                      <td className="px-4 py-3 text-right text-base font-black text-[#C9B45C]">{rupee(grandTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Delete invoice */}
              {invoice && (
                <div className="no-print mt-3 flex justify-end">
                  <button onClick={() => {
                    if (!confirm("Delete this invoice? This cannot be undone.")) return;
                    deleteInvoice.mutate(invoice.id);
                    toast({ title: "Invoice deleted" });
                  }}
                    className="text-[10px] text-red-400 hover:text-red-600 underline transition-colors">
                    Delete invoice
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Signature footer ────────────────────────────────────────── */}
          <div className="mt-10 pt-5 border-t border-gray-100 grid grid-cols-3 gap-8 text-center">
            {["Prepared By", "Checked By", "Authorized Signatory"].map(label => (
              <div key={label}>
                <div className="h-10 border-b border-gray-300 mb-1" />
                <p className="text-[10px] text-gray-400 font-medium">{label}</p>
              </div>
            ))}
          </div>

        </div>
        {/* Bottom accent bar */}
        <div className="h-1 bg-gradient-to-r from-gray-900 via-[#C9B45C] to-gray-900" />
      </div>
    </>
  );
}
