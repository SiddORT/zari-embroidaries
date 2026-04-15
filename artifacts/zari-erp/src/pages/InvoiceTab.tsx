import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Trash2, Printer, Save, Download, Loader2 } from "lucide-react";
import { useInvoice, useNextInvoiceNo, useCreateInvoice, useUpdateInvoice, useDeleteInvoice, type InvoiceLineItem } from "@/hooks/useInvoice";
import {
  useSwatchBom, useSwatchPOs, useSwatchPRs,
  useArtisanTimesheets, useOutsourceJobs, useCustomCharges,
} from "@/hooks/useCosting";
import { useToast } from "@/hooks/use-toast";

// ── helpers ──────────────────────────────────────────────────────────────────
function rupee(n: number) {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function uid() { return Math.random().toString(36).slice(2, 10); }
function pf(v: unknown) { return parseFloat(String(v)) || 0; }

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

const inputCls = "w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/20 bg-white placeholder:text-gray-300";
const printInputCls = "w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/20 bg-white placeholder:text-gray-300 print:border-transparent print:bg-transparent print:px-0 print:py-0";

function blankItem(): InvoiceLineItem {
  return { id: uid(), description: "", category: "Other", quantity: 1, unitPrice: 0, total: 0 };
}

// ── Build line items from costing data ───────────────────────────────────────
function buildItemsFromCosting(
  bomRows: ReturnType<typeof useSwatchBom>["data"],
  pos: ReturnType<typeof useSwatchPOs>["data"],
  prs: ReturnType<typeof useSwatchPRs>["data"],
  artisanTimesheets: ReturnType<typeof useArtisanTimesheets>["data"],
  outsourceJobs: ReturnType<typeof useOutsourceJobs>["data"],
  customCharges: ReturnType<typeof useCustomCharges>["data"],
): InvoiceLineItem[] {
  const items: InvoiceLineItem[] = [];

  (bomRows ?? []).forEach(r => {
    const consumedQty = pf(r.consumedQty);
    if (consumedQty <= 0) return;
    const avgPrice = pf(r.avgUnitPrice);
    const posWithRow = (pos ?? []).filter(po => (po.bomItems ?? []).some(i => i.bomRowId === r.id));
    const prsForRow = (prs ?? []).filter(pr => {
      if (pr.bomRowId != null) return pr.bomRowId === r.id;
      return posWithRow.some(po => po.id === pr.poId);
    });
    const prQty = prsForRow.reduce((s, pr) => s + pf(pr.receivedQty), 0);
    const prTotal = prsForRow.reduce((s, pr) => s + pf(pr.receivedQty) * pf(pr.actualPrice), 0);
    const stockNum = pf(r.currentStock);
    const weightedAvg = (stockNum + prQty) > 0 ? (stockNum * avgPrice + prTotal) / (stockNum + prQty) : avgPrice;
    const total = parseFloat((consumedQty * weightedAvg).toFixed(2));
    items.push({ id: uid(), description: `${r.materialName} (${r.materialCode})`, category: "Material", quantity: parseFloat(consumedQty.toFixed(3)), unitPrice: parseFloat(weightedAvg.toFixed(2)), total });
  });

  (artisanTimesheets ?? []).forEach(r => {
    const hours = pf(r.totalHours);
    const rate = pf(r.hourlyRate);
    const total = pf(r.totalRate);
    items.push({ id: uid(), description: `Artisan Labour – ${r.shiftType} shift (${hours.toFixed(1)} hrs × ${r.noOfArtisans} artisans)`, category: "Labour", quantity: parseFloat((hours * r.noOfArtisans).toFixed(2)), unitPrice: rate, total });
  });

  (outsourceJobs ?? []).forEach(r => {
    const total = pf(r.totalCost);
    items.push({ id: uid(), description: `Outsource – ${r.vendorName} (HSN ${r.hsnCode})`, category: "Outsource", quantity: 1, unitPrice: total, total });
  });

  (customCharges ?? []).forEach(r => {
    items.push({ id: uid(), description: r.description, category: "Custom", quantity: pf(r.quantity), unitPrice: pf(r.unitPrice), total: pf(r.totalAmount) });
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

  const { data: bomRows = [], isLoading: lb } = useSwatchBom(swatchOrderId);
  const { data: pos = [], isLoading: lp } = useSwatchPOs(swatchOrderId);
  const { data: prs = [], isLoading: lr } = useSwatchPRs(swatchOrderId);
  const { data: artisanTimesheets = [], isLoading: la } = useArtisanTimesheets(swatchOrderId);
  const { data: outsourceJobs = [], isLoading: lo } = useOutsourceJobs(swatchOrderId);
  const { data: customCharges = [], isLoading: lc } = useCustomCharges(swatchOrderId);

  const costingLoading = lb || lp || lr || la || lo || lc;
  const autoImportedRef = useRef(false);

  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    invoiceDate: today,
    dueDate: "",
    clientName: propClientName ?? "",
    clientAddress: "",
    clientGstin: "",
    clientEmail: "",
    clientPhone: "",
    clientState: "",
    discountType: "flat" as "flat" | "percent",
    discountValue: "0",
    cgstRate: "0",
    sgstRate: "0",
    bankName: "",
    bankAccount: "",
    bankIfsc: "",
    bankBranch: "",
    bankUpi: "",
    notes: "",
    paymentTerms: "Payment due within 30 days of invoice date.",
    status: "Draft",
  });

  const [items, setItems] = useState<InvoiceLineItem[]>([blankItem()]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Populate from existing saved invoice
  useEffect(() => {
    if (invoice === undefined) return;
    if (invoice === null) return;
    setForm({
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate ?? "",
      clientName: invoice.clientName ?? propClientName ?? "",
      clientAddress: invoice.clientAddress ?? "",
      clientGstin: invoice.clientGstin ?? "",
      clientEmail: invoice.clientEmail ?? "",
      clientPhone: invoice.clientPhone ?? "",
      clientState: invoice.clientState ?? "",
      discountType: (invoice.discountType ?? "flat") as "flat" | "percent",
      discountValue: invoice.discountValue ?? "0",
      cgstRate: invoice.cgstRate ?? "0",
      sgstRate: invoice.sgstRate ?? "0",
      bankName: invoice.bankName ?? "",
      bankAccount: invoice.bankAccount ?? "",
      bankIfsc: invoice.bankIfsc ?? "",
      bankBranch: invoice.bankBranch ?? "",
      bankUpi: invoice.bankUpi ?? "",
      notes: invoice.notes ?? "",
      paymentTerms: invoice.paymentTerms ?? "Payment due within 30 days of invoice date.",
      status: invoice.status ?? "Draft",
    });
    const savedItems = invoice.items as InvoiceLineItem[];
    setItems(savedItems.length > 0 ? savedItems : [blankItem()]);
    setDirty(false);
    autoImportedRef.current = true;
  }, [invoice]);

  // Auto-import from cost sheet when no existing invoice
  useEffect(() => {
    if (loadingInvoice || costingLoading) return;
    if (invoice !== null) return;
    if (autoImportedRef.current) return;
    autoImportedRef.current = true;
    const imported = buildItemsFromCosting(bomRows, pos, prs, artisanTimesheets, outsourceJobs, customCharges);
    if (imported.length > 0) {
      setItems(imported);
      setDirty(true);
    }
  }, [loadingInvoice, costingLoading, invoice, bomRows, pos, prs, artisanTimesheets, outsourceJobs, customCharges]);

  const setField = useCallback(<K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    setDirty(true);
  }, []);

  function addItem() { setItems(p => [...p, blankItem()]); setDirty(true); }
  function removeItem(id: string) { setItems(p => p.filter(i => i.id !== id)); setDirty(true); }
  function updateItem(id: string, field: keyof InvoiceLineItem, raw: string | number) {
    setItems(p => p.map(i => {
      if (i.id !== id) return i;
      const u = { ...i, [field]: field === "description" || field === "category" ? raw : pf(raw) };
      // Auto-compute total only when qty or unitPrice changed; leave total alone when editing it directly
      if (field === "quantity" || field === "unitPrice") {
        u.total = parseFloat((u.quantity * u.unitPrice).toFixed(2));
      }
      return u;
    }));
    setDirty(true);
  }

  function handleImport() {
    const imported = buildItemsFromCosting(bomRows, pos, prs, artisanTimesheets, outsourceJobs, customCharges);
    if (imported.length === 0) {
      toast({ title: "Nothing to import", description: "Add costing entries first (consumption, labour, outsource, custom charges).", variant: "destructive" });
      return;
    }
    setItems(imported);
    setDirty(true);
    toast({ title: "Imported from Cost Sheet", description: `${imported.length} line items loaded.` });
  }

  // ── Calculations ───────────────────────────────────────────────────────────
  const subtotal = items.reduce((s, i) => s + (i.total || 0), 0);
  const discountAmt = form.discountType === "percent"
    ? subtotal * pf(form.discountValue) / 100
    : pf(form.discountValue);
  const afterDiscount = subtotal - discountAmt;
  const cgstAmt = afterDiscount * pf(form.cgstRate) / 100;
  const sgstAmt = afterDiscount * pf(form.sgstRate) / 100;
  const grandTotal = afterDiscount + cgstAmt + sgstAmt;

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
          #invoice-print { position: fixed; top: 0; left: 0; width: 100%; font-size: 10px; }
          .no-print { display: none !important; }
          input, textarea, select { border: none !important; background: transparent !important; padding: 0 !important; resize: none !important; outline: none !important; box-shadow: none !important; }
        }
      `}</style>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="no-print flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Invoice</h2>
            <p className="text-xs text-gray-400">{invoiceNo} · {swatchName ?? orderCode}</p>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${STATUS_COLORS[form.status]}`}>{form.status}</span>
          {dirty && <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">Unsaved</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleImport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-gray-300 bg-white text-gray-500 text-xs font-medium hover:bg-gray-50 transition-colors">
            <Download className="h-3.5 w-3.5" /> Re-import from Cost Sheet
          </button>
          <button onClick={() => { void handleSave(); }} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-900 text-[#C9B45C] text-xs font-semibold hover:bg-black transition-colors">
            <Printer className="h-3.5 w-3.5" /> Print / PDF
          </button>
        </div>
      </div>

      {/* ── Invoice Document ─────────────────────────────────────────────── */}
      <div id="invoice-print" className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-gray-900 via-[#C9B45C] to-gray-900" />

        <div className="p-8 space-y-7">

          {/* ── Header ───────────────────────────────────────────────────── */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-2xl font-black tracking-wider text-gray-900">ZARI</span>
                <span className="text-xs font-light tracking-[0.3em] text-gray-400 uppercase">Embroideries</span>
              </div>
              <p className="text-[10px] text-gray-400 leading-relaxed">Enterprise Resource Planning</p>
            </div>
            <div className="text-right space-y-1">
              <p className="text-3xl font-black text-gray-900 tracking-tight">INVOICE</p>
              <p className="text-sm font-mono font-bold text-[#C9B45C]">{invoiceNo}</p>
              <div className="no-print">
                <select value={form.status} onChange={e => setField("status", e.target.value)}
                  className={`text-[10px] px-2 py-1 rounded-lg border font-semibold cursor-pointer focus:outline-none ${STATUS_COLORS[form.status]}`}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="hidden print:block">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${STATUS_COLORS[form.status]}`}>{form.status}</span>
              </div>
            </div>
          </div>

          {/* ── Client Section ───────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-5 bg-gray-50/60 rounded-2xl border border-gray-100 p-5">

            {/* FROM — Company */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#C9B45C] mb-3">From</p>
              <p className="text-sm font-black text-gray-900 mb-0.5">ZARI Embroideries</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                [Your Company Address]<br />
                City, State — PIN<br />
                GSTIN: [Your GSTIN]<br />
                Phone: [Your Phone]
              </p>
            </div>

            {/* BILL TO — Client */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#C9B45C] mb-3">Bill To</p>
              <div className="space-y-2">
                <input className={`${printInputCls} font-semibold text-gray-900`} placeholder="Client Name *"
                  value={form.clientName} onChange={e => setField("clientName", e.target.value)} />
                <textarea rows={2} className={`${printInputCls} resize-none`} placeholder="Full Address"
                  value={form.clientAddress} onChange={e => setField("clientAddress", e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  <input className={printInputCls} placeholder="State"
                    value={form.clientState} onChange={e => setField("clientState", e.target.value)} />
                  <input className={printInputCls} placeholder="GSTIN"
                    value={form.clientGstin} onChange={e => setField("clientGstin", e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input className={printInputCls} placeholder="Email"
                    value={form.clientEmail} onChange={e => setField("clientEmail", e.target.value)} />
                  <input className={printInputCls} placeholder="Phone"
                    value={form.clientPhone} onChange={e => setField("clientPhone", e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* ── Invoice Metadata ─────────────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-4 text-xs border-y border-gray-100 py-4">
            <div>
              <p className="text-[10px] text-gray-400 font-medium mb-1">Invoice No</p>
              <p className="font-mono font-bold text-gray-900">{invoiceNo}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-medium mb-1">Invoice Date</p>
              <input type="date" className={inputCls} value={form.invoiceDate} onChange={e => setField("invoiceDate", e.target.value)} />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-medium mb-1">Due Date</p>
              <input type="date" className={inputCls} value={form.dueDate} onChange={e => setField("dueDate", e.target.value)} />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-medium mb-1">Order Ref</p>
              <p className="font-mono text-gray-600">{orderCode ?? "—"}</p>
            </div>
          </div>

          {/* ── Line Items ───────────────────────────────────────────────── */}
          <div>
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
                  <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}>
                    <td className="px-3 py-2 text-gray-400 border-b border-gray-100">{idx + 1}</td>
                    <td className="px-2 py-1 border-b border-gray-100">
                      <input
                        className="w-full px-2 py-1 text-xs text-gray-900 border border-transparent rounded-lg focus:border-gray-300 focus:outline-none bg-transparent hover:bg-white focus:bg-white transition-colors"
                        value={item.description} placeholder="Description…"
                        onChange={e => updateItem(item.id, "description", e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-1 border-b border-gray-100">
                      <select value={item.category} onChange={e => updateItem(item.id, "category", e.target.value)}
                        className={`w-full text-[10px] px-1.5 py-1 rounded-lg border font-medium focus:outline-none cursor-pointer ${CAT_COLORS[item.category] ?? CAT_COLORS.Other}`}>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1 border-b border-gray-100">
                      <input type="number" min="0" step="0.001"
                        className="w-full px-2 py-1 text-xs text-right text-gray-900 border border-transparent rounded-lg focus:border-gray-300 focus:outline-none bg-transparent hover:bg-white focus:bg-white transition-colors"
                        value={item.quantity} onChange={e => updateItem(item.id, "quantity", e.target.value)} />
                    </td>
                    <td className="px-2 py-1 border-b border-gray-100">
                      <input type="number" min="0" step="0.01"
                        className="w-full px-2 py-1 text-xs text-right text-gray-900 border border-transparent rounded-lg focus:border-gray-300 focus:outline-none bg-transparent hover:bg-white focus:bg-white transition-colors"
                        value={item.unitPrice} onChange={e => updateItem(item.id, "unitPrice", e.target.value)} />
                    </td>
                    <td className="px-2 py-1 border-b border-gray-100">
                      <input type="number" min="0" step="0.01"
                        className="w-full px-2 py-1 text-xs text-right font-semibold text-gray-900 border border-transparent rounded-lg focus:border-[#C9B45C] focus:ring-1 focus:ring-[#C9B45C]/30 focus:outline-none bg-transparent hover:bg-amber-50/40 focus:bg-amber-50/40 transition-colors"
                        value={item.total} onChange={e => updateItem(item.id, "total", e.target.value)} />
                    </td>
                    <td className="px-1 py-1 border-b border-gray-100 no-print">
                      <button onClick={() => removeItem(item.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors rounded">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Notes + Totals ───────────────────────────────────────────── */}
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
              <div className="bg-gray-50/60 rounded-xl border border-gray-100 overflow-hidden text-xs">
                <table className="w-full">
                  <tbody>
                    {/* Subtotal */}
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-2.5 text-gray-500 font-medium">Subtotal</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{rupee(subtotal)}</td>
                    </tr>

                    {/* Discount */}
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
                        <div className="flex items-center justify-end gap-1.5">
                          <input type="number" min="0" step="0.01"
                            className="w-20 px-2 py-1 text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-900/20 text-xs"
                            value={form.discountValue} onChange={e => setField("discountValue", e.target.value)} />
                          {discountAmt > 0 && <span className="text-red-400 text-[10px] whitespace-nowrap">− {rupee(discountAmt)}</span>}
                        </div>
                      </td>
                    </tr>

                    {/* CGST */}
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-2 text-gray-500 font-medium">CGST %</td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <input type="number" min="0" max="100" step="0.5"
                            className="w-16 px-2 py-1 text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-900/20 text-xs"
                            value={form.cgstRate} onChange={e => setField("cgstRate", e.target.value)} />
                          <span className="text-gray-400 text-[10px] whitespace-nowrap">= {rupee(cgstAmt)}</span>
                        </div>
                      </td>
                    </tr>

                    {/* SGST */}
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-2 text-gray-500 font-medium">SGST %</td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <input type="number" min="0" max="100" step="0.5"
                            className="w-16 px-2 py-1 text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-900/20 text-xs"
                            value={form.sgstRate} onChange={e => setField("sgstRate", e.target.value)} />
                          <span className="text-gray-400 text-[10px] whitespace-nowrap">= {rupee(sgstAmt)}</span>
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

              {invoice && (
                <div className="no-print mt-2 flex justify-end">
                  <button onClick={() => {
                    if (!confirm("Delete this invoice? Cannot be undone.")) return;
                    deleteInvoice.mutate(invoice.id);
                    toast({ title: "Invoice deleted" });
                  }} className="text-[10px] text-red-400 hover:text-red-600 underline transition-colors">
                    Delete invoice
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Bank Details ─────────────────────────────────────────────── */}
          <div className="border-t border-gray-100 pt-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Bank Details</p>
            <div className="grid grid-cols-5 gap-3">
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Bank Name</p>
                <input className={inputCls} placeholder="e.g. SBI" value={form.bankName} onChange={e => setField("bankName", e.target.value)} />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Account No</p>
                <input className={inputCls} placeholder="Account number" value={form.bankAccount} onChange={e => setField("bankAccount", e.target.value)} />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">IFSC Code</p>
                <input className={inputCls} placeholder="IFSC" value={form.bankIfsc} onChange={e => setField("bankIfsc", e.target.value)} />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Branch</p>
                <input className={inputCls} placeholder="Branch name" value={form.bankBranch} onChange={e => setField("bankBranch", e.target.value)} />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">UPI ID</p>
                <input className={inputCls} placeholder="UPI ID (optional)" value={form.bankUpi} onChange={e => setField("bankUpi", e.target.value)} />
              </div>
            </div>
          </div>

          {/* ── Signature ────────────────────────────────────────────────── */}
          <div className="pt-4 border-t border-gray-100 grid grid-cols-3 gap-8 text-center">
            {["Prepared By", "Checked By", "Authorized Signatory"].map(label => (
              <div key={label}>
                <div className="h-10 border-b border-gray-300 mb-1" />
                <p className="text-[10px] text-gray-400 font-medium">{label}</p>
              </div>
            ))}
          </div>

        </div>
        <div className="h-1 bg-gradient-to-r from-gray-900 via-[#C9B45C] to-gray-900" />
      </div>
    </>
  );
}
