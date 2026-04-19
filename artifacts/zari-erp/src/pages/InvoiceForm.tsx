import { useState, useEffect, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { Save, ArrowLeft, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/AppLayout";

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
const TYPES = ["Proforma", "Advance", "Partial", "Material Recovery", "Artwork Charges", "Courier Charges", "Final Invoice", "Custom"] as const;
const TYPE_COLORS: Record<string, string> = {
  "Proforma": "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
  "Advance": "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100",
  "Partial": "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
  "Material Recovery": "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100",
  "Artwork Charges": "bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100",
  "Courier Charges": "bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100",
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

interface LineItem { id: string; description: string; category: string; quantity: number; unitPrice: number; total: number }
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

const blank = () => ({ id: crypto.randomUUID(), description: "", category: "", quantity: 1, unitPrice: 0, total: 0 });

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

  const [items, setItems] = useState<LineItem[]>([blank()]);

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

  // Load supporting data
  useEffect(() => {
    customFetch<any>("/api/clients?limit=500").then(j => setClients(j.data ?? [])).catch(() => {});
    customFetch<any>("/api/vendors?limit=500").then(j => setVendors(j.data ?? [])).catch(() => {});
    customFetch<any>("/api/settings/currencies").then(j => setCurrencies((j.data ?? []).filter((c: any) => c.is_active || c.is_base))).catch(() => {});
    customFetch<any>("/api/settings/exchange-rates").then(j => {
      const map: Record<string, number> = {};
      for (const r of (j.data ?? [])) map[r.currency_code] = parseFloat(r.rate);
      setExchangeRates(map);
    }).catch(() => {});
    // Fetch saved bank accounts, auto-fill the default one for new invoices
    if (!isEdit) {
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
    }).catch(() => setRefOrderOptions([])).finally(() => setRefOrdersLoading(false));
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

  async function handleSave() {
    if (!form.invoiceDate) { toast({ title: "Invoice date is required", variant: "destructive" }); return; }
    if (form.invoiceDirection === "Client" && !form.clientName && !form.clientId) {
      toast({ title: "Client is required for client invoices", variant: "destructive" }); return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
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

            {/* Line Items */}
            <div className={`${card} overflow-hidden`}>
              <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-bold text-gray-900 text-sm">Line Items</h2>
                <button
                  onClick={() => setItems(prev => [...prev, blank()])}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#C6AF4B]/40 transition"
                  style={{ color: G }}
                >
                  <Plus size={13} /> Add Item
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {["Description", "Category", "Qty", "Unit Price", "Total", ""].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-gray-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(it => (
                      <tr key={it.id} className="border-b border-gray-50">
                        <td className="px-3 py-2 w-[35%]">
                          <input value={it.description} onChange={e => updateItem(it.id, "description", e.target.value)} className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#C6AF4B]" placeholder="Item description" />
                        </td>
                        <td className="px-3 py-2 w-[18%]">
                          <input value={it.category} onChange={e => updateItem(it.id, "category", e.target.value)} className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#C6AF4B]" placeholder="Category" />
                        </td>
                        <td className="px-3 py-2 w-[10%]">
                          <input type="number" min="0" value={it.quantity} onChange={e => updateItem(it.id, "quantity", parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#C6AF4B] text-right" />
                        </td>
                        <td className="px-3 py-2 w-[16%]">
                          <input type="number" min="0" step="0.01" value={it.unitPrice} onChange={e => updateItem(it.id, "unitPrice", parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#C6AF4B] text-right" />
                        </td>
                        <td className="px-3 py-2 w-[14%] font-semibold text-gray-900 text-right pr-4">
                          {it.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2 w-[7%]">
                          {items.length > 1 && (
                            <button onClick={() => setItems(prev => prev.filter(x => x.id !== it.id))} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

            {/* Bank Details */}
            <div className={`${card} p-6`}>
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
                  <p className="text-xs text-gray-400 mt-1">Selecting will fill the fields below. You can still edit them manually.</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div><label className={lbl}>Bank Name</label><input value={form.bankName} onChange={e => setF("bankName", e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Account No</label><input value={form.bankAccount} onChange={e => setF("bankAccount", e.target.value)} className={inp} /></div>
                <div><label className={lbl}>IFSC Code</label><input value={form.bankIfsc} onChange={e => setF("bankIfsc", e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Branch</label><input value={form.bankBranch} onChange={e => setF("bankBranch", e.target.value)} className={inp} /></div>
                <div><label className={lbl}>UPI</label><input value={form.bankUpi} onChange={e => setF("bankUpi", e.target.value)} className={inp} placeholder="upi@bank" /></div>
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
                    <p className="text-sm font-bold text-amber-900 mt-0.5">
                      ₹{(totals.total * parseFloat(form.exchangeRateSnapshot || "1")).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
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
                  <span className="font-medium">{totals.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="flex items-center gap-2">
                  <select value={form.discountType} onChange={e => setF("discountType", e.target.value)} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-[#C6AF4B]">
                    <option value="flat">Flat Discount</option>
                    <option value="percent">% Discount</option>
                  </select>
                  <input type="number" min="0" value={form.discountValue} onChange={e => setF("discountValue", e.target.value)} className="flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#C6AF4B] text-right" />
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between text-sm text-red-500">
                    <span>Discount</span><span>− {totals.discount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-400">CGST %</label>
                    <input type="number" min="0" value={form.cgstRate} onChange={e => setF("cgstRate", e.target.value)} className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#C6AF4B] text-right mt-1" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">SGST %</label>
                    <input type="number" min="0" value={form.sgstRate} onChange={e => setF("sgstRate", e.target.value)} className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#C6AF4B] text-right mt-1" />
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
                  <label className="text-xs text-gray-400">Shipping Amount</label>
                  <input type="number" min="0" step="0.01" value={form.shippingAmount} onChange={e => setF("shippingAmount", e.target.value)} className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#C6AF4B] text-right mt-1" />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Adjustment (+ / −)</label>
                  <input type="number" step="0.01" value={form.adjustmentAmount} onChange={e => setF("adjustmentAmount", e.target.value)} className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#C6AF4B] text-right mt-1" />
                </div>

                <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
                  <span className="font-bold text-gray-900">Total</span>
                  <span className="text-lg font-bold" style={{ color: G }}>
                    {totals.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })} {form.currencyCode}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment */}
            <div className={`${card} p-5`}>
              <h2 className="font-bold text-gray-900 text-sm mb-4 border-b border-gray-100 pb-3">Payment Tracking</h2>
              <div className="space-y-3">
                <div>
                  <label className={lbl}>Amount Received</label>
                  <input type="number" min="0" step="0.01" value={form.receivedAmount} onChange={e => setF("receivedAmount", e.target.value)} className={inp} />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Pending</span>
                  <span className={`font-bold ${Math.max(0, totals.total - parseFloat(form.receivedAmount || "0")) > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                    {Math.max(0, totals.total - parseFloat(form.receivedAmount || "0")).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white shadow-sm transition disabled:opacity-60"
              style={{ backgroundColor: G }}
            >
              {saving ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={15} />}
              {saving ? "Saving…" : "Save Invoice"}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
