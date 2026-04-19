import { useState, useEffect, useCallback, Fragment } from "react";
import { useLocation, useParams } from "wouter";
import { Save, ArrowLeft, Plus, Trash2, CheckCircle2, Eye, FileText, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/AppLayout";
import InvoicePreviewModal from "@/components/InvoicePreviewModal";
import type { PreviewInvoice } from "@/components/InvoicePreviewModal";

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

const ITEM_CATEGORIES = ["Material", "Fabric", "Item", "Artwork", "Outsource", "Artisan", "Custom", "Shipping"] as const;
const HSN_CATEGORIES = new Set(["Material", "Fabric", "Item"]);

const DIRECTIONS = ["Client", "Vendor"] as const;
const TYPES = ["Proforma", "Advance", "Partial", "Final Invoice", "Custom"] as const;
const TYPE_COLORS: Record<string, string> = {
  "Proforma": "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
  "Advance": "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100",
  "Partial": "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
  "Final Invoice": "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
  "Custom": "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100",
};
const STATUSES = ["Draft", "Sent", "Paid", "Partial", "Cancelled"] as const;
const REF_TYPES = ["Swatch", "Style", "Quotation", "Purchase Receipt", "Shipping", "Artwork", "Manual"] as const;
const REF_LABELS: Record<string, string> = {
  "Swatch": "Swatch Order No",
  "Style": "Style Order No",
  "Quotation": "Quotation No",
  "Purchase Receipt": "PO / Receipt No",
  "Shipping": "AWB / Tracking No",
  "Artwork": "Artwork Ref No",
  "Manual": "Reference ID / Order No",
};

interface LineItem {
  id: string; description: string; category: string;
  quantity: number; unitPrice: number; total: number;
  hsnCode: string; hsnGstPct: string; showHsn: boolean;
}
interface HsnItem { id: number; hsnCode: string; govtDescription: string; gstPercentage: string }
interface FabricMaster { id: number; fabricCode: string; fabricType: string; quality: string; colorName: string; hsnCode: string }
interface MaterialMaster { id: number; materialCode: string; itemType: string; quality: string; colorName: string; hsnCode: string }
interface Client {
  id: number; brandName: string; contactName: string; email: string; contactNo: string;
  gstNo?: string; address1?: string; address2?: string; city?: string; state?: string; pincode?: string;
}
interface Vendor {
  id: number; brandName: string; contactName: string; email?: string; contactNo?: string;
  gstNo?: string; address1?: string; address2?: string; city?: string; state?: string; pincode?: string;
}
interface Currency { code: string; name: string; symbol: string }
interface BankAccount {
  id: number; bank_name: string; account_no: string; ifsc_code: string;
  branch: string; account_name: string; bank_upi: string; is_default: boolean;
}

const blank = (): LineItem => ({ id: crypto.randomUUID(), description: "", category: "Item", quantity: 1, unitPrice: 0, total: 0, hsnCode: "", hsnGstPct: "", showHsn: true });

function calcTotals(items: LineItem[], shipping: number, adjustment: number, discountType: string, discountValue: number, cgst: number, sgst: number) {
  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const discount = discountType === "percent" ? (subtotal * discountValue) / 100 : discountValue;
  const taxable = subtotal - discount;
  const cgstAmt = (taxable * cgst) / 100;
  const sgstAmt = (taxable * sgst) / 100;
  const total = taxable + cgstAmt + sgstAmt + shipping + adjustment;
  return { subtotal, discount, taxable, cgstAmt, sgstAmt, total };
}

export default function InvoiceForm() {
  const [, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const isEdit = !!params.id && params.id !== "new";
  const { toast } = useToast();

  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [refOrderOptions, setRefOrderOptions] = useState<{ value: string; label: string }[]>([]);
  const [refOrdersLoading, setRefOrdersLoading] = useState(false);
  const [refOrderFullData, setRefOrderFullData] = useState<{ id: number; orderCode: string }[]>([]);
  const [loadingCostSheet, setLoadingCostSheet] = useState(false);
  const [showCostSheetConfirm, setShowCostSheetConfirm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [hsnList, setHsnList] = useState<HsnItem[]>([]);
  const [showHsnOnInvoice, setShowHsnOnInvoice] = useState(true);
  const [fabricMaster, setFabricMaster] = useState<FabricMaster[]>([]);
  const [materialMaster, setMaterialMaster] = useState<MaterialMaster[]>([]);

  const [form, setForm] = useState({
    invoiceNo: "",
    invoiceDirection: "Client",
    invoiceType: "Final Invoice",
    invoiceStatus: "Draft",
    clientId: "",
    vendorId: "",
    referenceType: "Manual",
    referenceId: "",
    currencyCode: "INR",
    exchangeRateSnapshot: "1",
    invoiceDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    clientName: "",
    clientAddress: "",
    clientGstin: "",
    clientEmail: "",
    clientPhone: "",
    clientState: "",
    discountType: "flat",
    discountValue: "0",
    cgstRate: "0",
    sgstRate: "0",
    shippingAmount: "0",
    adjustmentAmount: "0",
    receivedAmount: "0",
    bankName: "",
    bankAccount: "",
    bankIfsc: "",
    bankBranch: "",
    bankUpi: "",
    paymentTerms: "",
    remarks: "",
    notes: "",
  });

  const [items, setItems] = useState<LineItem[]>([]);

  const totals = calcTotals(
    items,
    parseFloat(form.shippingAmount || "0"),
    parseFloat(form.adjustmentAmount || "0"),
    form.discountType,
    parseFloat(form.discountValue || "0"),
    parseFloat(form.cgstRate || "0"),
    parseFloat(form.sgstRate || "0"),
  );

  const rate = parseFloat(form.exchangeRateSnapshot || "1");
  const baseCurrencyAmount = totals.total * rate;

  const CURRENCY_SYMBOLS: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "د.إ", SAR: "﷼" };
  const sym = CURRENCY_SYMBOLS[form.currencyCode] ?? form.currencyCode;
  const toInvCcy = (inrVal: number) => (rate > 0 ? inrVal / rate : inrVal);

  // Load supporting data
  useEffect(() => {
    customFetch<any>("/api/clients?limit=500").then(j => setClients(j.data ?? [])).catch(() => {});
    customFetch<any>("/api/vendors?limit=500").then(j => setVendors(j.data ?? [])).catch(() => {});
    customFetch<any>("/api/hsn/all").then(rows => setHsnList(Array.isArray(rows) ? rows : [])).catch(() => {});
    customFetch<any>("/api/fabrics/all").then(rows => setFabricMaster(Array.isArray(rows) ? rows : [])).catch(() => {});
    customFetch<any>("/api/materials/all").then(rows => setMaterialMaster(Array.isArray(rows) ? rows : [])).catch(() => {});
    customFetch<any>("/api/settings/currencies").then(j => {
      const all = j.data ?? [];
      const active = all.filter((c: any) => c.is_active || c.is_base);
      setCurrencies(active);
      // For new invoices, default to the base currency
      if (!isEdit) {
        const base = active.find((c: any) => c.is_base);
        if (base) setForm(f => ({ ...f, currencyCode: base.code }));
      }
    }).catch(() => {});
    customFetch<any>("/api/settings/exchange-rates").then(j => {
      const map: Record<string, number> = {};
      for (const r of (j.data ?? [])) map[r.currency_code] = parseFloat(r.rate);
      setExchangeRates(map);
    }).catch(() => {});
    // Fetch saved bank accounts, auto-fill the default one for new invoices
    if (!isEdit) {
      // Auto-apply GST settings (CGST + SGST)
      customFetch<any>("/api/settings/gst").then(j => {
        const g = j.data;
        if (!g) return;
        const totalGst = parseFloat(g.default_service_gst_rate ?? "0");
        const half = (totalGst / 2).toFixed(2);
        setForm(f => ({
          ...f,
          cgstRate: half,
          sgstRate: half,
        }));
      }).catch(() => {});

      customFetch<any>("/api/settings/bank-accounts").then(j => {
        const accounts: BankAccount[] = j.data ?? [];
        setBankAccounts(accounts);
        const def = accounts.find(a => a.is_default) ?? accounts[0];
        if (def) {
          setForm(f => ({
            ...f,
            bankName: def.bank_name,
            bankAccount: def.account_no,
            bankIfsc: def.ifsc_code,
            bankBranch: def.branch,
            bankUpi: def.bank_upi,
          }));
        }
      }).catch(() => {});
    } else {
      customFetch<any>("/api/settings/bank-accounts").then(j => setBankAccounts(j.data ?? [])).catch(() => {});
    }
  }, [isEdit]);

  // Load order options when reference type is Swatch or Style
  useEffect(() => {
    if (form.referenceType !== "Swatch" && form.referenceType !== "Style") {
      setRefOrderOptions([]);
      setRefOrderFullData([]);
      return;
    }
    setRefOrdersLoading(true);
    const endpoint = form.referenceType === "Swatch"
      ? "/api/swatch-orders?limit=200"
      : "/api/style-orders?limit=200";
    customFetch<any>(endpoint).then(j => {
      const rows = j.data ?? [];
      const opts = form.referenceType === "Swatch"
        ? rows.map((r: any) => ({ value: r.orderCode, label: `${r.orderCode} — ${r.swatchName ?? ""}`.trim() }))
        : rows.map((r: any) => ({ value: r.orderCode, label: `${r.orderCode} — ${r.styleName ?? r.styleNo ?? ""}`.trim() }));
      setRefOrderOptions(opts);
      setRefOrderFullData(rows.map((r: any) => ({ id: r.id, orderCode: r.orderCode })));
    }).catch(() => { setRefOrderOptions([]); setRefOrderFullData([]); }).finally(() => setRefOrdersLoading(false));
  }, [form.referenceType]);

  // Auto-set exchange rate when currency changes
  useEffect(() => {
    if (form.currencyCode === "INR") {
      setForm(f => ({ ...f, exchangeRateSnapshot: "1" }));
    } else if (exchangeRates[form.currencyCode]) {
      const rate = exchangeRates[form.currencyCode];
      // rate is 1 INR = X foreign; we want 1 foreign = ? INR => 1/rate
      setForm(f => ({ ...f, exchangeRateSnapshot: (1 / rate).toFixed(4) }));
    }
  }, [form.currencyCode, exchangeRates]);

  // Load existing invoice if editing
  useEffect(() => {
    if (!isEdit) {
      customFetch<any>("/api/invoices/next-number").then(j => setForm(f => ({ ...f, invoiceNo: j.data ?? "" }))).catch(() => {});
      return;
    }
    customFetch<any>(`/api/invoices/${params.id}`).then(j => {
      const inv = j.data;
      if (!inv) return;
      setForm({
        invoiceNo: inv.invoiceNo ?? "",
        invoiceDirection: inv.invoiceDirection ?? "Client",
        invoiceType: inv.invoiceType ?? "Final Invoice",
        invoiceStatus: inv.invoiceStatus ?? "Draft",
        clientId: String(inv.clientId ?? ""),
        vendorId: String(inv.vendorId ?? ""),
        referenceType: inv.referenceType ?? "Manual",
        referenceId: inv.referenceId ?? "",
        currencyCode: inv.currencyCode ?? "INR",
        exchangeRateSnapshot: String(inv.exchangeRateSnapshot ?? "1"),
        invoiceDate: (inv.invoiceDate ?? "").slice(0, 10),
        dueDate: (inv.dueDate ?? "").slice(0, 10),
        clientName: inv.clientName ?? "",
        clientAddress: inv.clientAddress ?? "",
        clientGstin: inv.clientGstin ?? "",
        clientEmail: inv.clientEmail ?? "",
        clientPhone: inv.clientPhone ?? "",
        clientState: inv.clientState ?? "",
        discountType: inv.discountType ?? "flat",
        discountValue: String(inv.discountValue ?? "0"),
        cgstRate: String(inv.cgstRate ?? "0"),
        sgstRate: String(inv.sgstRate ?? "0"),
        shippingAmount: String(inv.shippingAmount ?? "0"),
        adjustmentAmount: String(inv.adjustmentAmount ?? "0"),
        receivedAmount: String(inv.receivedAmount ?? "0"),
        bankName: inv.bankName ?? "",
        bankAccount: inv.bankAccount ?? "",
        bankIfsc: inv.bankIfsc ?? "",
        bankBranch: inv.bankBranch ?? "",
        bankUpi: inv.bankUpi ?? "",
        paymentTerms: inv.paymentTerms ?? "",
        remarks: inv.remarks ?? "",
        notes: inv.notes ?? "",
      });
      if (Array.isArray(inv.items) && inv.items.length > 0) setItems(inv.items);
    }).catch(() => {});
  }, [isEdit, params.id]);

  function setF(key: string, val: string) { setForm(f => ({ ...f, [key]: val })); }

  function updateItem(id: string, field: keyof LineItem, val: any) {
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it;
      const updated = { ...it, [field]: val };
      if (field === "quantity" || field === "unitPrice") updated.total = updated.quantity * updated.unitPrice;
      return updated;
    }));
  }

  async function handleSave(overrideStatus?: string) {
    if (!form.invoiceDate) { toast({ title: "Invoice date is required", variant: "destructive" }); return; }
    if (form.invoiceDirection === "Client" && !form.clientName && !form.clientId) {
      toast({ title: "Client is required for client invoices", variant: "destructive" }); return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        ...(overrideStatus ? { invoiceStatus: overrideStatus } : {}),
        items,
        totalAmount: String(totals.total.toFixed(2)),
        subtotalAmount: String(totals.subtotal.toFixed(2)),
        invoiceCurrencyAmount: String(totals.total.toFixed(2)),
        baseCurrencyAmount: String(baseCurrencyAmount.toFixed(2)),
        pendingAmount: String(Math.max(0, totals.total - parseFloat(form.receivedAmount || "0")).toFixed(2)),
      };

      if (isEdit) {
        await customFetch(`/api/invoices/${params.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await customFetch("/api/invoices", { method: "POST", body: JSON.stringify(payload) });
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        navigate("/accounts/invoices");
      }, 1500);
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function doLoadFromCostSheet() {
    if (!form.referenceId) return;
    const order = refOrderFullData.find(o => o.orderCode === form.referenceId);
    if (!order) { toast({ title: "Order not found", variant: "destructive" }); return; }

    setLoadingCostSheet(true);
    setShowCostSheetConfirm(false);
    try {
      const j = await customFetch<any>(
        `/api/costing/invoice-items?type=${encodeURIComponent(form.referenceType)}&orderId=${order.id}`
      );
      const rows: any[] = j.data ?? [];
      if (rows.length === 0) {
        toast({ title: "No cost-sheet items found", description: "Add materials, artisan timesheets, outsource jobs or custom charges to the cost sheet first.", variant: "destructive" });
        return;
      }

      const loaded: LineItem[] = rows.map((r: any) => ({
        id: crypto.randomUUID(),
        description: r.description ?? "",
        category: r.category ?? "Item",
        quantity: r.quantity ?? 1,
        unitPrice: r.unitPrice ?? 0,
        total: r.total ?? 0,
        hsnCode: r.hsnCode ?? "",
        hsnGstPct: r.hsnGstPct ?? "",
        showHsn: !!(r.hsnCode),
      }));

      // If order has a shipping record, append it as a line item
      const shippingAmt = parseFloat(j.shippingAmount ?? "0") || 0;
      if (shippingAmt > 0) {
        loaded.push({
          id: crypto.randomUUID(),
          description: "Shipping & Handling",
          category: "Shipping",
          quantity: 1,
          unitPrice: shippingAmt,
          total: shippingAmt,
          hsnCode: "",
          hsnGstPct: "",
          showHsn: false,
        });
      }

      setItems(loaded);

      const totalLoaded = loaded.length;
      toast({
        title: `${totalLoaded} item${totalLoaded !== 1 ? "s" : ""} loaded from cost sheet`,
        description: shippingAmt > 0
          ? `Includes shipping ₹${shippingAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })} as a line item.`
          : undefined,
      });
    } catch (e: any) {
      toast({ title: "Failed to load cost sheet", description: e.message, variant: "destructive" });
    } finally {
      setLoadingCostSheet(false);
    }
  }

  function handleLoadFromCostSheet() {
    // Section 6 — duplicate prevention: if items already exist, confirm before replacing
    if (items.length > 0) {
      setShowCostSheetConfirm(true);
    } else {
      doLoadFromCostSheet();
    }
  }

  const card = "bg-white rounded-2xl border border-gray-100 shadow-sm";
  const inp = "w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-[#C6AF4B] bg-white";
  const lbl = "block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide";
  const selClass = `${inp} cursor-pointer`;

  return (
    <AppLayout>
      <div className="py-6 px-6 max-w-screen-xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/accounts/invoices")} className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{isEdit ? "Edit Invoice" : "New Invoice"}</h1>
            <p className="text-sm text-gray-400 mt-0.5">{form.invoiceNo || "Invoice number will be auto-generated"}</p>
          </div>
        </div>

        {success && (
          <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-sm">
            <CheckCircle2 size={16} /> Invoice saved successfully
          </div>
        )}

        <div className="grid grid-cols-3 gap-5">
          {/* LEFT — Main form */}
          <div className="col-span-2 space-y-5">

            {/* Invoice Header */}
            <div className={`${card} p-6`}>
              <h2 className="font-bold text-gray-900 text-sm mb-4 border-b border-gray-100 pb-3">Invoice Details</h2>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={lbl}>Invoice No</label>
                  <input value={form.invoiceNo} readOnly className={`${inp} bg-gray-50 text-gray-500 cursor-not-allowed`} />
                </div>
                <div>
                  <label className={lbl}>Invoice Date *</label>
                  <input type="date" value={form.invoiceDate} onChange={e => setF("invoiceDate", e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Due Date</label>
                  <input type="date" value={form.dueDate} onChange={e => setF("dueDate", e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Direction *</label>
                  <select value={form.invoiceDirection} onChange={e => setF("invoiceDirection", e.target.value)} className={selClass}>
                    {DIRECTIONS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div className="col-span-3">
                  <label className={lbl}>Invoice Type *</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {TYPES.map(t => {
                      const active = form.invoiceType === t;
                      const col = TYPE_COLORS[t] ?? "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100";
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setF("invoiceType", t)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${col} ${active ? "ring-2 ring-offset-1 ring-current opacity-100 shadow-sm" : "opacity-70"}`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className={lbl}>Status</label>
                  <select value={form.invoiceStatus} onChange={e => setF("invoiceStatus", e.target.value)} className={selClass}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Party */}
            <div className={`${card} p-6`}>
              <h2 className="font-bold text-gray-900 text-sm mb-4 border-b border-gray-100 pb-3">
                {form.invoiceDirection === "Vendor" ? "Vendor Details" : "Client Details"}
              </h2>
              {form.invoiceDirection === "Client" ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>Client (from master)</label>
                    <select
                      value={form.clientId}
                      onChange={e => {
                        const id = e.target.value;
                        setF("clientId", id);
                        if (id) {
                          customFetch<any>(`/api/clients/${id}`).then(j => {
                            const c: Client = j.data ?? j;
                            if (!c) return;
                            const addr = [c.address1, c.address2, c.city, c.state, c.pincode].filter(Boolean).join(", ");
                            setForm(f => ({
                              ...f,
                              clientId: id,
                              clientName: c.brandName ?? f.clientName,
                              clientAddress: addr || f.clientAddress,
                              clientGstin: c.gstNo ?? f.clientGstin,
                              clientEmail: c.email ?? f.clientEmail,
                              clientPhone: c.contactNo ?? f.clientPhone,
                              clientState: c.state ?? f.clientState,
                            }));
                          }).catch(() => {
                            const c = clients.find(x => String(x.id) === id);
                            if (c) setF("clientName", c.brandName);
                          });
                        }
                      }}
                      className={selClass}
                    >
                      <option value="">— Select Client —</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.brandName}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Client Name *</label>
                    <input value={form.clientName} onChange={e => setF("clientName", e.target.value)} className={inp} placeholder="Client name" />
                  </div>
                  <div className="col-span-2">
                    <label className={lbl}>Address</label>
                    <textarea value={form.clientAddress} onChange={e => setF("clientAddress", e.target.value)} rows={2} className={`${inp} resize-none`} placeholder="Billing address" />
                  </div>
                  <div>
                    <label className={lbl}>GSTIN</label>
                    <input value={form.clientGstin} onChange={e => setF("clientGstin", e.target.value)} className={inp} placeholder="22AAAAA0000A1Z5" />
                  </div>
                  <div>
                    <label className={lbl}>State</label>
                    <input value={form.clientState} onChange={e => setF("clientState", e.target.value)} className={inp} placeholder="State" />
                  </div>
                  <div>
                    <label className={lbl}>Email</label>
                    <input value={form.clientEmail} onChange={e => setF("clientEmail", e.target.value)} className={inp} placeholder="client@email.com" />
                  </div>
                  <div>
                    <label className={lbl}>Phone</label>
                    <input value={form.clientPhone} onChange={e => setF("clientPhone", e.target.value)} className={inp} placeholder="+91 98765 43210" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>Vendor (from master)</label>
                    <select
                      value={form.vendorId}
                      onChange={e => {
                        const id = e.target.value;
                        setF("vendorId", id);
                        if (id) {
                          customFetch<any>(`/api/vendors/${id}`).then(j => {
                            const v: Vendor = j.data ?? j;
                            if (!v) return;
                            const addr = [v.address1, v.address2, v.city, v.state, v.pincode].filter(Boolean).join(", ");
                            setForm(f => ({
                              ...f,
                              vendorId: id,
                              clientName: v.brandName ?? f.clientName,
                              clientAddress: addr || f.clientAddress,
                              clientGstin: v.gstNo ?? f.clientGstin,
                              clientEmail: v.email ?? f.clientEmail,
                              clientPhone: v.contactNo ?? f.clientPhone,
                              clientState: v.state ?? f.clientState,
                            }));
                          }).catch(() => {
                            const v = vendors.find(x => String(x.id) === id);
                            if (v) setF("clientName", v.brandName);
                          });
                        }
                      }}
                      className={selClass}
                    >
                      <option value="">— Select Vendor —</option>
                      {vendors.map(v => <option key={v.id} value={v.id}>{v.brandName}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Vendor Name</label>
                    <input value={form.clientName} onChange={e => setF("clientName", e.target.value)} className={inp} placeholder="Vendor name" />
                  </div>
                  <div className="col-span-2">
                    <label className={lbl}>Address</label>
                    <textarea value={form.clientAddress} onChange={e => setF("clientAddress", e.target.value)} rows={2} className={`${inp} resize-none`} placeholder="Billing address" />
                  </div>
                  <div>
                    <label className={lbl}>GSTIN</label>
                    <input value={form.clientGstin} onChange={e => setF("clientGstin", e.target.value)} className={inp} placeholder="22AAAAA0000A1Z5" />
                  </div>
                  <div>
                    <label className={lbl}>State</label>
                    <input value={form.clientState} onChange={e => setF("clientState", e.target.value)} className={inp} placeholder="State" />
                  </div>
                  <div>
                    <label className={lbl}>Email</label>
                    <input value={form.clientEmail} onChange={e => setF("clientEmail", e.target.value)} className={inp} placeholder="vendor@email.com" />
                  </div>
                  <div>
                    <label className={lbl}>Phone</label>
                    <input value={form.clientPhone} onChange={e => setF("clientPhone", e.target.value)} className={inp} placeholder="+91 98765 43210" />
                  </div>
                </div>
              )}
            </div>

            {/* Reference */}
            <div className={`${card} p-6`}>
              <h2 className="font-bold text-gray-900 text-sm mb-4 border-b border-gray-100 pb-3">Reference Linking</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Reference Type</label>
                  <select value={form.referenceType} onChange={e => setF("referenceType", e.target.value)} className={selClass}>
                    {REF_TYPES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>{REF_LABELS[form.referenceType] ?? "Reference ID"}</label>
                  {(form.referenceType === "Swatch" || form.referenceType === "Style") ? (
                    <select
                      value={form.referenceId}
                      onChange={e => setF("referenceId", e.target.value)}
                      className={selClass}
                      disabled={refOrdersLoading}
                    >
                      <option value="">
                        {refOrdersLoading ? "Loading…" : `— Select ${REF_LABELS[form.referenceType]} —`}
                      </option>
                      {refOrderOptions.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={form.referenceId}
                      onChange={e => setF("referenceId", e.target.value)}
                      className={inp}
                      placeholder={`Enter ${REF_LABELS[form.referenceType] ?? "Reference ID"}`}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Remarks & Notes */}
            <div className={`${card} p-6`}>
              <h2 className="font-bold text-gray-900 text-sm mb-4 border-b border-gray-100 pb-3">Remarks & Notes</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Remarks</label>
                  <textarea value={form.remarks} onChange={e => setF("remarks", e.target.value)} rows={3} className={`${inp} resize-none`} placeholder="Internal remarks" />
                </div>
                <div>
                  <label className={lbl}>Notes (printed on invoice)</label>
                  <textarea value={form.notes} onChange={e => setF("notes", e.target.value)} rows={3} className={`${inp} resize-none`} placeholder="Payment terms, thank you note…" />
                </div>
                <div>
                  <label className={lbl}>Payment Terms</label>
                  <input value={form.paymentTerms} onChange={e => setF("paymentTerms", e.target.value)} className={inp} placeholder="e.g. Net 30, Advance 50%" />
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT — Sidebar */}
          <div className="space-y-5">
            {/* Currency */}
            <div className={`${card} p-5`}>
              <h2 className="font-bold text-gray-900 text-sm mb-4 border-b border-gray-100 pb-3">Currency</h2>
              <div className="space-y-4">
                <div>
                  <label className={lbl}>Invoice Currency</label>
                  <select value={form.currencyCode} onChange={e => setF("currencyCode", e.target.value)} className={selClass}>
                    {currencies.length > 0
                      ? currencies.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)
                      : <option value="INR">INR — Indian Rupee</option>
                    }
                  </select>
                </div>
                <div>
                  <label className={lbl}>Exchange Rate (1 {form.currencyCode} = ? INR)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={form.exchangeRateSnapshot}
                    onChange={e => setF("exchangeRateSnapshot", e.target.value)}
                    className={inp}
                    placeholder="1.0000"
                  />
                  <p className="text-xs text-gray-400 mt-1">Rate is locked at save and cannot change later.</p>
                </div>
                {form.currencyCode !== "INR" && (
                  <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5">
                    <p className="text-xs text-amber-700 font-semibold">INR Equivalent</p>
                    <p className="text-xs text-amber-600 mb-0.5">1 {form.currencyCode} = ₹{parseFloat(form.exchangeRateSnapshot || "1").toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</p>
                    <p className="text-sm font-bold text-amber-900">
                      ₹{totals.total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Totals */}
            <div className={`${card} p-5`}>
              <h2 className="font-bold text-gray-900 text-sm mb-4 border-b border-gray-100 pb-3">Totals</h2>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-medium text-gray-900">{totals.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center gap-2">
                  <select value={form.discountType} onChange={e => setF("discountType", e.target.value)} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-[#C6AF4B]">
                    <option value="flat">Flat Discount</option>
                    <option value="percent">% Discount</option>
                  </select>
                  <input type="number" min="0" value={form.discountValue} onChange={e => setF("discountValue", e.target.value)} className="flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:border-[#C6AF4B] text-right" />
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between text-sm text-red-500">
                    <span>Discount</span><span>− {totals.discount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-600">CGST %</label>
                    <input type="number" min="0" value={form.cgstRate} onChange={e => setF("cgstRate", e.target.value)} className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:border-[#C6AF4B] text-right mt-1" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">SGST %</label>
                    <input type="number" min="0" value={form.sgstRate} onChange={e => setF("sgstRate", e.target.value)} className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:border-[#C6AF4B] text-right mt-1" />
                  </div>
                </div>
                {(totals.cgstAmt > 0 || totals.sgstAmt > 0) && (
                  <>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>CGST</span><span>{totals.cgstAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>SGST</span><span>{totals.sgstAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </>
                )}
                <div>
                  <label className="text-xs text-gray-600">Shipping Amount</label>
                  <input type="number" min="0" step="0.01" value={form.shippingAmount} onChange={e => setF("shippingAmount", e.target.value)} className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:border-[#C6AF4B] text-right mt-1" />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Adjustment (+ / −)</label>
                  <input type="number" step="0.01" value={form.adjustmentAmount} onChange={e => setF("adjustmentAmount", e.target.value)} className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:border-[#C6AF4B] text-right mt-1" />
                </div>
                {(() => {
                  const hsnGstTotal = items.reduce((s, it) => {
                    if (HSN_CATEGORIES.has(it.category) && it.hsnGstPct) {
                      return s + (it.total * parseFloat(it.hsnGstPct)) / 100;
                    }
                    return s;
                  }, 0);
                  if (hsnGstTotal <= 0) return null;
                  return (
                    <div className="flex justify-between text-sm text-gray-600 border-t border-dashed border-gray-100 pt-2">
                      <span className="flex items-center gap-1">
                        Item GST <span className="text-xs text-gray-400">(from HSN)</span>
                      </span>
                      <span className="font-medium">{hsnGstTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                  );
                })()}
                <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
                  <span className="font-bold text-gray-900">Total ({form.currencyCode})</span>
                  <span className="text-lg font-bold" style={{ color: G }}>
                    {sym}{toInvCcy(totals.total).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Bank Details */}
            <div className={`${card} p-5`}>
              <h2 className="font-bold text-gray-900 text-sm mb-4 border-b border-gray-100 pb-3">Bank Details</h2>
              {bankAccounts.length > 0 && (
                <div className="mb-4">
                  <label className={lbl}>Select Saved Bank Account</label>
                  <select
                    className={selClass}
                    value=""
                    onChange={e => {
                      const id = parseInt(e.target.value);
                      const b = bankAccounts.find(a => a.id === id);
                      if (b) setForm(f => ({
                        ...f,
                        bankName: b.bank_name,
                        bankAccount: b.account_no,
                        bankIfsc: b.ifsc_code,
                        bankBranch: b.branch,
                        bankUpi: b.bank_upi,
                      }));
                    }}
                  >
                    <option value="">— Pick a bank account —</option>
                    {bankAccounts.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.bank_name} · {b.account_no}{b.is_default ? " (Default)" : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Selecting fills the fields below. You can still edit manually.</p>
                </div>
              )}
              <div className="space-y-3">
                <div><label className={lbl}>Bank Name</label><input value={form.bankName} onChange={e => setF("bankName", e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Account No</label><input value={form.bankAccount} onChange={e => setF("bankAccount", e.target.value)} className={inp} /></div>
                <div><label className={lbl}>IFSC Code</label><input value={form.bankIfsc} onChange={e => setF("bankIfsc", e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Branch</label><input value={form.bankBranch} onChange={e => setF("bankBranch", e.target.value)} className={inp} /></div>
                <div><label className={lbl}>UPI</label><input value={form.bankUpi} onChange={e => setF("bankUpi", e.target.value)} className={inp} placeholder="upi@bank" /></div>
              </div>
            </div>

          </div>
        </div>

        {/* Line Items — full width */}
        <div className={`${card} overflow-hidden`}>
          <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-900 text-sm">Line Items</h2>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showHsnOnInvoice}
                  onChange={e => setShowHsnOnInvoice(e.target.checked)}
                  className="rounded"
                />
                Show HSN on printed invoice
              </label>
              {(form.referenceType === "Swatch" || form.referenceType === "Style") && form.referenceId ? (
                <button
                  onClick={handleLoadFromCostSheet}
                  disabled={loadingCostSheet}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition disabled:opacity-60"
                >
                  {loadingCostSheet
                    ? <><span className="h-3 w-3 border-2 border-emerald-400/30 border-t-emerald-600 rounded-full animate-spin" /> Loading…</>
                    : <><Download size={13} /> Load from Cost Sheet</>
                  }
                </button>
              ) : (
                <button
                  disabled
                  title="Select a Swatch or Style reference first"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed"
                >
                  <Download size={13} /> Load from Cost Sheet
                </button>
              )}
              <button
                onClick={() => setItems(prev => [...prev, blank()])}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#C6AF4B]/40 transition"
                style={{ color: G }}
              >
                <Plus size={13} /> Add Item
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-gray-400 w-[22%]">Description</th>
                  <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-gray-400 w-[11%]">Category</th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide text-gray-400 w-[7%]">Qty</th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide text-gray-400 w-[10%]">Rate {sym}</th>
                  <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-gray-400 w-[11%]">HSN Code</th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide text-gray-400 w-[7%]">GST %</th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide text-gray-400 w-[9%]">GST Amt {sym}</th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide text-gray-400 w-[9%]">Amount {sym}</th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide text-gray-400 w-[10%]">Total w/ GST {sym}</th>
                  <th className="w-[4%]"></th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-6 py-10 text-center">
                      <p className="text-sm text-gray-400 mb-1">No line items yet</p>
                      <p className="text-xs text-gray-300">
                        Select a Swatch or Style reference and click <strong>Load from Cost Sheet</strong>, or click <strong>+ Add Item</strong> to add manually.
                      </p>
                    </td>
                  </tr>
                )}
                {items.map(it => {
                  const gstPct = parseFloat(it.hsnGstPct || "0");
                  const itemGst = gstPct > 0 ? (it.total * gstPct) / 100 : 0;
                  return (
                    <Fragment key={it.id}>
                      <tr className="border-b border-gray-50 hover:bg-gray-50/40 transition-colors">
                        {/* Description */}
                        <td className="px-3 py-2">
                          {it.category === "Fabric" ? (
                            <select
                              value={it.description}
                              onChange={e => {
                                const label = e.target.value;
                                const fab = fabricMaster.find(f => `${f.fabricCode} · ${f.fabricType} · ${f.quality} · ${f.colorName}` === label);
                                if (fab) {
                                  const hsn = hsnList.find(h => h.hsnCode === fab.hsnCode);
                                  setItems(prev => prev.map(x => x.id !== it.id ? x : {
                                    ...x, description: label, hsnCode: fab.hsnCode, hsnGstPct: hsn?.gstPercentage ?? fab.hsnCode ? String(parseFloat(hsn?.gstPercentage ?? "0")) : "",
                                  }));
                                } else {
                                  updateItem(it.id, "description", label);
                                }
                              }}
                              className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-900 bg-white focus:outline-none focus:border-[#C6AF4B] cursor-pointer"
                            >
                              <option value="">— Select Fabric —</option>
                              {fabricMaster.map(f => {
                                const label = `${f.fabricCode} · ${f.fabricType} · ${f.quality} · ${f.colorName}`;
                                return <option key={f.id} value={label}>{label}</option>;
                              })}
                            </select>
                          ) : (it.category === "Material" || it.category === "Item") ? (
                            <select
                              value={it.description}
                              onChange={e => {
                                const label = e.target.value;
                                const mat = materialMaster.find(m => `${m.materialCode} · ${m.itemType} · ${m.quality} · ${m.colorName}` === label);
                                if (mat) {
                                  const hsn = hsnList.find(h => h.hsnCode === mat.hsnCode);
                                  setItems(prev => prev.map(x => x.id !== it.id ? x : {
                                    ...x, description: label, hsnCode: mat.hsnCode, hsnGstPct: hsn?.gstPercentage ?? "",
                                  }));
                                } else {
                                  updateItem(it.id, "description", label);
                                }
                              }}
                              className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-900 bg-white focus:outline-none focus:border-[#C6AF4B] cursor-pointer"
                            >
                              <option value="">— Select {it.category} —</option>
                              {materialMaster.map(m => {
                                const label = `${m.materialCode} · ${m.itemType} · ${m.quality} · ${m.colorName}`;
                                return <option key={m.id} value={label}>{label}</option>;
                              })}
                            </select>
                          ) : (
                            <input value={it.description} onChange={e => updateItem(it.id, "description", e.target.value)} className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-900 bg-white focus:outline-none focus:border-[#C6AF4B]" placeholder="Item description" />
                          )}
                        </td>
                        {/* Category */}
                        <td className="px-3 py-2">
                          <select
                            value={it.category}
                            onChange={e => {
                              const cat = e.target.value;
                              setItems(prev => prev.map(x => x.id !== it.id ? x : { ...x, category: cat }));
                            }}
                            className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-900 bg-white focus:outline-none focus:border-[#C6AF4B] cursor-pointer"
                          >
                            {ITEM_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        {/* Qty */}
                        <td className="px-3 py-2">
                          <input type="number" min="0" value={it.quantity} onChange={e => updateItem(it.id, "quantity", parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-900 bg-white focus:outline-none focus:border-[#C6AF4B] text-right" />
                        </td>
                        {/* Rate */}
                        <td className="px-3 py-2">
                          <input
                            type="number" min="0" step="0.0001"
                            value={parseFloat(toInvCcy(it.unitPrice).toFixed(4))}
                            onChange={e => updateItem(it.id, "unitPrice", (parseFloat(e.target.value) || 0) * rate)}
                            className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-900 bg-white focus:outline-none focus:border-[#C6AF4B] text-right"
                          />
                        </td>
                        {/* HSN Code */}
                        <td className="px-3 py-2">
                          <input
                            value={it.hsnCode}
                            onChange={e => {
                              const code = e.target.value;
                              const hsn = hsnList.find(h => h.hsnCode === code);
                              setItems(prev => prev.map(x => x.id !== it.id ? x : {
                                ...x, hsnCode: code,
                                hsnGstPct: hsn ? hsn.gstPercentage : x.hsnGstPct,
                              }));
                            }}
                            list={`hsn-list-${it.id}`}
                            className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-900 bg-white focus:outline-none focus:border-[#C6AF4B]"
                            placeholder="e.g. 63019090"
                          />
                          <datalist id={`hsn-list-${it.id}`}>
                            {hsnList.map(h => (
                              <option key={h.id} value={h.hsnCode}>{h.govtDescription} — {h.gstPercentage}%</option>
                            ))}
                          </datalist>
                        </td>
                        {/* GST % */}
                        <td className="px-3 py-2">
                          <input
                            type="number" min="0" max="100" step="0.01"
                            value={it.hsnGstPct}
                            onChange={e => updateItem(it.id, "hsnGstPct", e.target.value)}
                            className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-900 bg-white focus:outline-none focus:border-[#C6AF4B] text-right"
                            placeholder="0"
                          />
                        </td>
                        {/* GST Amount */}
                        <td className="px-3 py-2 text-right text-xs text-gray-600">
                          {gstPct > 0
                            ? <span className="font-medium text-amber-700">{toInvCcy(itemGst).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                            : <span className="text-gray-300">—</span>
                          }
                        </td>
                        {/* Amount */}
                        <td className="px-3 py-2 font-semibold text-gray-900 text-right text-xs">
                          {toInvCcy(it.total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        {/* Total w/ GST */}
                        <td className="px-3 py-2 text-right text-xs font-bold text-[#C9B45C]">
                          {toInvCcy(it.total + itemGst).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        {/* Delete */}
                        <td className="px-2 py-2">
                          <button onClick={() => setItems(prev => prev.filter(x => x.id !== it.id))} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
              {items.length > 0 && (() => {
                const totalAmt = items.reduce((s, i) => s + i.total, 0);
                const totalGst = items.reduce((s, i) => {
                  const pct = parseFloat(i.hsnGstPct || "0");
                  return s + (pct > 0 ? (i.total * pct) / 100 : 0);
                }, 0);
                const grandTotal = totalAmt + totalGst;
                const fmt = (n: number) => toInvCcy(n).toLocaleString("en-IN", { minimumFractionDigits: 2 });
                return (
                  <tfoot>
                    <tr className="border-t-2 border-gray-900 bg-gray-900">
                      <td colSpan={6} className="px-3 py-2.5 text-right text-[10px] font-bold text-gray-300 uppercase tracking-wide">Grand Total (Amt + GST) {sym}</td>
                      <td className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500">{fmt(totalGst)}</td>
                      <td className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500">{fmt(totalAmt)}</td>
                      <td className="px-3 py-2.5 text-right text-sm font-bold text-[#C9B45C]">{fmt(grandTotal)}</td>
                      <td />
                    </tr>
                  </tfoot>
                );
              })()}
            </table>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3 pt-1 pb-4">
          <button
            onClick={() => navigate("/accounts/invoices")}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSave("Draft")}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition disabled:opacity-60"
            >
              {saving ? <span className="h-3.5 w-3.5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" /> : <FileText size={14} />}
              Save as Draft
            </button>
            <button
              onClick={() => setShowPreview(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition"
            >
              <Eye size={14} /> Preview Invoice
            </button>
            <button
              onClick={() => handleSave()}
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm transition disabled:opacity-60"
              style={{ backgroundColor: G }}
            >
              {saving ? <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
              {isEdit ? "Save Changes" : "Generate Invoice"}
            </button>
          </div>
        </div>

      </div>

      {/* Invoice Preview Modal */}
      {showPreview && (
        <InvoicePreviewModal
          formSnapshot={{
            invoiceNo: form.invoiceNo || "DRAFT",
            invoiceDate: form.invoiceDate,
            dueDate: form.dueDate,
            invoiceType: form.invoiceType,
            currencyCode: form.currencyCode,
            exchangeRate: parseFloat(form.exchangeRateSnapshot || "1"),
            clientName: form.clientName,
            clientAddress: form.clientAddress,
            clientGstin: form.clientGstin,
            clientEmail: form.clientEmail,
            clientPhone: form.clientPhone,
            clientState: form.clientState,
            items: items.map(i => ({ description: i.description, hsnCode: i.hsnCode, quantity: i.quantity, unit: i.unit, unitPrice: i.unitPrice, total: i.total })),
            cgstRate: parseFloat(form.cgstRate || "0"),
            sgstRate: parseFloat(form.sgstRate || "0"),
            discountType: form.discountType,
            discountValue: parseFloat(form.discountValue || "0"),
            shippingAmount: parseFloat(form.shippingAmount || "0"),
            adjustmentAmount: parseFloat(form.adjustmentAmount || "0"),
            receivedAmount: parseFloat(form.receivedAmount || "0"),
            paymentTerms: form.paymentTerms,
            notes: form.notes,
            bankName: form.bankName,
            bankAccount: form.bankAccount,
            bankIfsc: form.bankIfsc,
            bankBranch: form.bankBranch,
            bankUpi: form.bankUpi,
            referenceType: form.referenceType,
            referenceId: form.referenceId,
          } as PreviewInvoice}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* Cost Sheet Duplicate Confirmation Modal */}
      {showCostSheetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-md mx-4 p-6">
            <h3 className="font-bold text-gray-900 text-base mb-2">Replace existing line items?</h3>
            <p className="text-sm text-gray-500 mb-5">
              Cost sheet items are already loaded. Reloading will clear the current {items.length} line item{items.length !== 1 ? "s" : ""} and replace them with the latest cost sheet data.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCostSheetConfirm(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={doLoadFromCostSheet}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white transition"
                style={{ backgroundColor: G }}
              >
                Yes, Reload
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
