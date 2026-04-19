import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Plus, Trash2, Save, Upload, X, User, Phone, Mail, MapPin, CreditCard } from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import AppLayout from "@/components/layout/AppLayout";
import { useAllClients } from "@/hooks/useClients";
import { useUnitTypes } from "@/hooks/useLookups";
import { useToast } from "@/hooks/use-toast";

const G = "#C6AF4B";
const card = "rounded-2xl bg-white border border-[#C6AF4B]/15 shadow-[0_2px_16px_rgba(198,175,75,0.12),0_1px_3px_rgba(0,0,0,0.06)]";
const inputCls = "w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 text-gray-900 bg-white";
const labelCls = "block text-xs font-semibold text-gray-500 mb-1";

interface Design {
  id?: number;
  designName: string;
  hsnCode: string;
  designImage: string;
  remarks: string;
}

interface Charge {
  id?: number;
  chargeName: string;
  hsnCode: string;
  unit: string;
  quantity: string;
  price: string;
}

interface HsnRecord {
  id: number;
  hsnCode: string;
  gstPercentage: string;
  govtDescription: string;
}

const emptyDesign = (): Design => ({ designName: "", hsnCode: "", designImage: "", remarks: "" });
const emptyCharge = (): Charge => ({ chargeName: "", hsnCode: "", unit: "", quantity: "1", price: "0" });

export default function QuotationForm() {
  const { id } = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const isEdit = !!id && id !== "new";
  const qc = useQueryClient();
  const { toast } = useToast();

  const token = localStorage.getItem("zarierp_token");
  const { data: user, isLoading: loadingUser } = useGetMe({ enabled: !!token });
  const logoutMutation = useLogout();

  // ── Master Data ────────────────────────────────────────────────────────────
  const { data: allClients = [], isLoading: loadingClients } = useAllClients();
  const { data: unitTypesData = [] } = useUnitTypes();
  const unitOptions = unitTypesData.filter((u) => u.isActive).map((u) => u.name);
  const [allHsn, setAllHsn] = useState<HsnRecord[]>([]);
  const [loadingHsn, setLoadingHsn] = useState(true);

  useEffect(() => {
    customFetch<HsnRecord[]>(`/api/hsn/all`)
      .then((h) => setAllHsn(Array.isArray(h) ? h : []))
      .catch(console.error)
      .finally(() => setLoadingHsn(false));
  }, []);

  // ── Client State ──────────────────────────────────────────────────────────
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const selectedClient = allClients.find((c) => String(c.id) === selectedClientId) ?? null;

  // Derive state for GST from billing address
  const clientState =
    selectedClient?.addresses?.find((a) => a.isBillingDefault)?.state ??
    selectedClient?.addresses?.[0]?.state ??
    "";
  // ── Form State ─────────────────────────────────────────────────────────────
  const [requirementSummary, setRequirementSummary] = useState("");
  const [estimatedWeight, setEstimatedWeight] = useState("");
  const [shippingRatePerKg, setShippingRatePerKg] = useState("0");
  const [internalNotes, setInternalNotes] = useState("");
  const [clientNotes, setClientNotes] = useState("");
  const [gstTaxType, setGstTaxType] = useState("IGST");
  const [gstRate, setGstRate] = useState("18");
  const [coverPage, setCoverPage] = useState("classic");
  const [designs, setDesigns] = useState<Design[]>([emptyDesign()]);
  const [charges, setCharges] = useState<Charge[]>([emptyCharge()]);
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(isEdit);

  // Auto-set GST type from client state (only when client changes and user hasn't overridden)
  useEffect(() => {
    if (!clientState) return;
    setGstTaxType(clientState.toLowerCase() === "maharashtra" ? "CGST+SGST" : "IGST");
  }, [clientState]);

  // ── Computed Totals ────────────────────────────────────────────────────────
  const estimatedShippingCharges = (parseFloat(estimatedWeight) || 0) * (parseFloat(shippingRatePerKg) || 0);
  const subtotal = charges.reduce((s, c) => s + (parseFloat(c.quantity) || 0) * (parseFloat(c.price) || 0), 0);
  const shipping = estimatedShippingCharges;
  const gstAmount = parseFloat((subtotal * (parseFloat(gstRate) || 0) / 100).toFixed(2));
  const total = subtotal + gstAmount + shipping;
  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  // ── Load Existing Quotation (edit mode) ────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return;
    setLoadingData(true);
    customFetch<{ data: any }>(`/api/quotations/${id}`)
      .then((j) => {
        if (!j.data) return;
        const d = j.data;
        if (d.client_id) setSelectedClientId(String(d.client_id));
        setRequirementSummary(d.requirement_summary || "");
        setEstimatedWeight(d.estimated_weight || "");
        const weight = parseFloat(d.estimated_weight) || 0;
        const savedShipping = parseFloat(d.estimated_shipping_charges) || 0;
        setShippingRatePerKg(weight > 0 ? String((savedShipping / weight).toFixed(2)) : "0");
        if (d.gst_type) setGstTaxType(d.gst_type);
        if (d.gst_rate != null) setGstRate(String(d.gst_rate));
        if (d.cover_page) setCoverPage(d.cover_page);
        setInternalNotes(d.internal_notes || "");
        setClientNotes(d.client_notes || "");
        setDesigns(
          d.designs?.length
            ? d.designs.map((x: any) => ({
                id: x.id, designName: x.design_name, hsnCode: x.hsn_code || "",
                designImage: x.design_image || "", remarks: x.remarks || "",
              }))
            : [emptyDesign()]
        );
        setCharges(
          d.charges?.length
            ? d.charges.map((x: any) => ({
                id: x.id, chargeName: x.charge_name, hsnCode: x.hsn_code || "",
                unit: x.unit || "", quantity: String(x.quantity), price: String(x.price),
              }))
            : [emptyCharge()]
        );
      })
      .catch(() => toast({ title: "Error", description: "Failed to load quotation", variant: "destructive" }))
      .finally(() => setLoadingData(false));
  }, [id, isEdit]);

  // ── Image helper ──────────────────────────────────────────────────────────
  async function toBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleDesignImage(idx: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await toBase64(file);
    setDesigns((prev) => prev.map((d, i) => i === idx ? { ...d, designImage: b64 } : d));
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!selectedClientId) {
      toast({ title: "Validation", description: "Please select a client", variant: "destructive" }); return;
    }
    const resolvedClient = allClients.find((c) => String(c.id) === selectedClientId);
    const validDesigns = designs.filter((d) => d.designName.trim());
    const validCharges = charges.filter((c) => c.chargeName.trim());
    setSaving(true);
    try {
      const j = await customFetch<{ message?: string; data?: { id: number } }>(
        isEdit ? `/api/quotations/${id}` : `/api/quotations`,
        {
          method: isEdit ? "PUT" : "POST",
          body: JSON.stringify({
            clientId: selectedClientId,
            clientName: resolvedClient?.brandName || "",
            clientState: clientState,
            requirementSummary: requirementSummary.trim(),
            estimatedWeight: parseFloat(estimatedWeight) || 0,
            estimatedShippingCharges: estimatedShippingCharges,
            gstType: gstTaxType,
            gstRate: parseFloat(gstRate) || 18,
            coverPage,
            internalNotes: internalNotes.trim(),
            clientNotes: clientNotes.trim(),
            designs: validDesigns,
            charges: validCharges,
          }),
        }
      );
      toast({ title: "Saved", description: j.message || "Quotation saved successfully" });
      navigate(isEdit ? `/quotation/${id}` : `/quotation/${j.data?.id}`);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        localStorage.removeItem("zarierp_token");
        qc.removeQueries({ queryKey: getGetMeQueryKey() });
        navigate("/login");
      },
    });
  }

  const masterLoading = loadingClients || loadingHsn;

  if (loadingUser || masterLoading || loadingData) {
    return (
      <AppLayout username={user?.username ?? ""} role={user?.role ?? ""} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#C6AF4B]" />
        </div>
      </AppLayout>
    );
  }

  if (!user) { navigate("/login"); return null; }

  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <div className="max-w-5xl mx-auto">

        {/* Page Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate("/quotation")} className="p-2 rounded-xl hover:bg-gray-100 transition">
            <ArrowLeft size={18} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{isEdit ? "Edit Quotation" : "New Quotation"}</h1>
            <p className="text-sm text-gray-500">Fill in the details below</p>
          </div>
        </div>

        {/* ─── Client Details ─────────────────────────────────────────────── */}
        <div className={`${card} p-5 mb-5`}>
          <h2 className="text-sm font-bold mb-4 uppercase tracking-wide" style={{ color: G }}>Client Details</h2>

          {/* Client Dropdown */}
          <div className="max-w-md mb-4">
            <label className={labelCls}>Select Client *</label>
            <select
              className={inputCls}
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
            >
              <option value="">— Select a client —</option>
              {allClients.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.brandName} ({c.clientCode})
                </option>
              ))}
            </select>
          </div>

          {/* Client Detail Card (read-only, shown after selection) */}
          {selectedClient && (
            <div className="border border-[#C6AF4B]/20 rounded-xl bg-[#C6AF4B]/[0.04] p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="font-bold text-gray-900 text-base">{selectedClient.brandName}</p>
                  <p className="text-xs text-gray-400 font-mono">{selectedClient.clientCode}</p>
                </div>
                {clientState && (
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    clientState.toLowerCase() === "maharashtra"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-indigo-100 text-indigo-700"
                  }`}>
                    {gstType}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <User size={13} className="text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">Contact Person</p>
                    <p className="font-medium text-gray-800">{selectedClient.contactName}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Phone size={13} className="text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">Phone</p>
                    <p className="font-medium text-gray-800">{selectedClient.contactNo}</p>
                    {selectedClient.altContactNo && <p className="text-xs text-gray-500">{selectedClient.altContactNo}</p>}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Mail size={13} className="text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">Email</p>
                    <p className="font-medium text-gray-800 break-all">{selectedClient.email}</p>
                    {selectedClient.altEmail && <p className="text-xs text-gray-500 break-all">{selectedClient.altEmail}</p>}
                  </div>
                </div>
                {clientState && (
                  <div className="flex items-start gap-2">
                    <MapPin size={13} className="text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-400">State / City</p>
                      <p className="font-medium text-gray-800">
                        {[
                          selectedClient.addresses?.find((a) => a.isBillingDefault)?.city ?? selectedClient.addresses?.[0]?.city,
                          clientState,
                        ].filter(Boolean).join(", ")}
                      </p>
                    </div>
                  </div>
                )}
                {selectedClient.invoiceCurrency && (
                  <div className="flex items-start gap-2">
                    <CreditCard size={13} className="text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-400">Invoice Currency</p>
                      <p className="font-medium text-gray-800">{selectedClient.invoiceCurrency}</p>
                    </div>
                  </div>
                )}
                {selectedClient.country && (
                  <div className="flex items-start gap-2">
                    <span className="text-gray-400 text-xs mt-0.5 shrink-0">🌐</span>
                    <div>
                      <p className="text-xs text-gray-400">Country</p>
                      <p className="font-medium text-gray-800">{selectedClient.country}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── Requirement Details ────────────────────────────────────────── */}
        <div className={`${card} p-5 mb-5`}>
          <h2 className="text-sm font-bold mb-4 uppercase tracking-wide" style={{ color: G }}>Requirement Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="col-span-2">
              <label className={labelCls}>Requirement Summary</label>
              <textarea rows={3} className={inputCls} placeholder="Brief description of the embroidery requirement…"
                value={requirementSummary} onChange={(e) => setRequirementSummary(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Estimated Weight (kg)</label>
              <input type="number" min="0" step="0.001" className={inputCls}
                value={estimatedWeight} onChange={(e) => setEstimatedWeight(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Internal Notes</label>
              <textarea rows={2} className={inputCls} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Client Notes (visible to client)</label>
              <textarea rows={2} className={inputCls} value={clientNotes} onChange={(e) => setClientNotes(e.target.value)} />
            </div>
          </div>
        </div>

        {/* ─── Designs / Reference Images ─────────────────────────────────── */}
        <div className={`${card} p-5 mb-5`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: G }}>Designs / Reference Images</h2>
            <button onClick={() => setDesigns((prev) => [...prev, emptyDesign()])}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#C6AF4B]/40 hover:bg-[#C6AF4B]/10 text-[#C6AF4B] transition">
              <Plus size={13} /> Add Design
            </button>
          </div>
          <div className="space-y-4">
            {designs.map((d, i) => (
              <div key={i} className="border border-gray-100 rounded-xl p-4 bg-gray-50/40">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-500">Design {i + 1}</span>
                  {designs.length > 1 && (
                    <button onClick={() => setDesigns((prev) => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Design Name *</label>
                    <input type="text" className={inputCls} placeholder="e.g. Floral Embroidery on Kurta"
                      value={d.designName}
                      onChange={(e) => setDesigns((p) => p.map((x, j) => j === i ? { ...x, designName: e.target.value } : x))} />
                  </div>
                  <div>
                    <label className={labelCls}>HSN Code</label>
                    <select className={inputCls} value={d.hsnCode}
                      onChange={(e) => setDesigns((p) => p.map((x, j) => j === i ? { ...x, hsnCode: e.target.value } : x))}>
                      <option value="">— Select HSN —</option>
                      {allHsn.map((h) => (
                        <option key={h.id} value={h.hsnCode}>
                          {h.hsnCode}{h.govtDescription ? ` — ${h.govtDescription.length > 40 ? h.govtDescription.slice(0, 40) + "…" : h.govtDescription}` : ""} ({h.gstPercentage}%)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <label className={labelCls}>Remarks</label>
                    <input type="text" className={inputCls} placeholder="Additional notes about this design"
                      value={d.remarks}
                      onChange={(e) => setDesigns((p) => p.map((x, j) => j === i ? { ...x, remarks: e.target.value } : x))} />
                  </div>
                  <div className="sm:col-span-3">
                    <label className={labelCls}>Reference Image</label>
                    {d.designImage ? (
                      <div className="flex items-center gap-3">
                        <img src={d.designImage} alt="design" className="h-16 w-16 object-cover rounded-lg border border-gray-200" />
                        <button onClick={() => setDesigns((p) => p.map((x, j) => j === i ? { ...x, designImage: "" } : x))}
                          className="text-red-400 hover:text-red-600 text-xs">
                          Remove
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-gray-300 cursor-pointer hover:bg-[#C6AF4B]/5 text-sm text-gray-500 w-fit">
                        <Upload size={14} />
                        <span>Upload Image</span>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleDesignImage(i, e)} />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Custom Charges ──────────────────────────────────────────────── */}
        <div className={`${card} p-5 mb-5`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: G }}>Custom Charges</h2>
            <button onClick={() => setCharges((prev) => [...prev, emptyCharge()])}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#C6AF4B]/40 hover:bg-[#C6AF4B]/10 text-[#C6AF4B] transition">
              <Plus size={13} /> Add Charge
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[680px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-500 pb-2 pr-2">Charge Name</th>
                  <th className="text-left text-xs font-semibold text-gray-500 pb-2 pr-2 w-44">HSN Code</th>
                  <th className="text-left text-xs font-semibold text-gray-500 pb-2 pr-2 w-24">Unit</th>
                  <th className="text-left text-xs font-semibold text-gray-500 pb-2 pr-2 w-20">Qty</th>
                  <th className="text-left text-xs font-semibold text-gray-500 pb-2 pr-2 w-28">Price (₹)</th>
                  <th className="text-right text-xs font-semibold text-gray-500 pb-2 w-24">Amount</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {charges.map((c, i) => {
                  const amt = (parseFloat(c.quantity) || 0) * (parseFloat(c.price) || 0);
                  return (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="pr-2 py-1.5">
                        <input type="text" className={inputCls} placeholder="e.g. Embroidery Charges"
                          value={c.chargeName}
                          onChange={(e) => setCharges((p) => p.map((x, j) => j === i ? { ...x, chargeName: e.target.value } : x))} />
                      </td>
                      <td className="pr-2 py-1.5">
                        <select className={inputCls} value={c.hsnCode}
                          onChange={(e) => setCharges((p) => p.map((x, j) => j === i ? { ...x, hsnCode: e.target.value } : x))}>
                          <option value="">— HSN —</option>
                          {allHsn.map((h) => (
                            <option key={h.id} value={h.hsnCode}>
                              {h.hsnCode} ({h.gstPercentage}%)
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="pr-2 py-1.5">
                        <select className={inputCls} value={c.unit}
                          onChange={(e) => setCharges((p) => p.map((x, j) => j === i ? { ...x, unit: e.target.value } : x))}>
                          <option value="">— Unit —</option>
                          {unitOptions.map((u) => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </td>
                      <td className="pr-2 py-1.5">
                        <input type="number" min="0" step="0.001" className={inputCls} value={c.quantity}
                          onChange={(e) => setCharges((p) => p.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))} />
                      </td>
                      <td className="pr-2 py-1.5">
                        <input type="number" min="0" step="0.01" className={inputCls} value={c.price}
                          onChange={(e) => setCharges((p) => p.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} />
                      </td>
                      <td className="text-right py-1.5 font-semibold text-gray-800">{fmt(amt)}</td>
                      <td className="py-1.5 pl-2">
                        {charges.length > 1 && (
                          <button onClick={() => setCharges((p) => p.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Shipping */}
          <div className="flex justify-end mt-4">
            <div className="flex items-end gap-3">
              <div className="w-36">
                <label className={labelCls}>Weight (kg)</label>
                <input type="number" min="0" step="0.001" className={inputCls}
                  value={estimatedWeight} onChange={(e) => setEstimatedWeight(e.target.value)} />
              </div>
              <div className="w-36">
                <label className={labelCls}>Rate / kg (₹)</label>
                <input type="number" min="0" step="0.01" className={inputCls}
                  value={shippingRatePerKg} onChange={(e) => setShippingRatePerKg(e.target.value)} />
              </div>
              <div className="w-36">
                <label className={labelCls}>Shipping Total</label>
                <div className="px-3 py-2 text-sm rounded-xl border border-gray-200 bg-gray-50 text-gray-700 font-semibold">
                  {fmt(estimatedShippingCharges)}
                </div>
              </div>
            </div>
          </div>

          {/* Totals */}
          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="flex flex-col items-end gap-2 text-sm">
              <div className="flex justify-between w-72">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-semibold">{fmt(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between w-72 gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <select
                    className="text-xs rounded-lg border border-gray-200 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 bg-white text-gray-900"
                    value={gstTaxType} onChange={(e) => setGstTaxType(e.target.value)}>
                    <option value="GST">GST</option>
                    <option value="CGST+SGST">CGST+SGST</option>
                    <option value="IGST">IGST</option>
                  </select>
                  <div className="flex items-center gap-1">
                    <input type="number" min="0" max="100" step="0.01"
                      className="w-16 text-xs rounded-lg border border-gray-200 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 bg-white text-gray-900"
                      value={gstRate} onChange={(e) => setGstRate(e.target.value)} />
                    <span className="text-gray-500 text-xs">%</span>
                  </div>
                </div>
                <span className="font-semibold">{fmt(gstAmount)}</span>
              </div>
              <div className="flex justify-between w-72">
                <span className="text-gray-500">Shipping</span>
                <span className="font-semibold">{fmt(shipping)}</span>
              </div>
              <div className="flex justify-between w-72 pt-1 border-t border-gray-200 mt-1">
                <span className="font-bold text-gray-900">Total</span>
                <span className="font-bold text-[#C6AF4B] text-lg">{fmt(total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Cover Page ──────────────────────────────────────────────────── */}
        <div className={`${card} p-5 mb-5`}>
          <h2 className="text-sm font-bold uppercase tracking-wide mb-4" style={{ color: G }}>Cover Page Style</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                id: "classic",
                label: "Classic",
                preview: (
                  <div className="h-20 rounded-lg overflow-hidden border border-gray-100">
                    <div className="h-8 w-full" style={{ background: "#C6AF4B" }} />
                    <div className="p-1.5 space-y-1">
                      <div className="h-1.5 w-3/4 rounded bg-gray-300" />
                      <div className="h-1.5 w-1/2 rounded bg-gray-200" />
                      <div className="h-1.5 w-2/3 rounded bg-gray-200" />
                    </div>
                  </div>
                ),
              },
              {
                id: "modern",
                label: "Modern",
                preview: (
                  <div className="h-20 rounded-lg overflow-hidden border border-gray-100">
                    <div className="h-20 w-full flex flex-col justify-end p-2" style={{ background: "linear-gradient(135deg,#1a1a2e 60%,#C6AF4B)" }}>
                      <div className="h-1.5 w-3/4 rounded bg-white/60 mb-1" />
                      <div className="h-1 w-1/2 rounded bg-white/30" />
                    </div>
                  </div>
                ),
              },
              {
                id: "corporate",
                label: "Corporate",
                preview: (
                  <div className="h-20 rounded-lg overflow-hidden border border-gray-100">
                    <div className="h-10 w-full bg-gray-900 flex items-center px-2">
                      <div className="h-2 w-2 rounded-full bg-[#C6AF4B] mr-1.5" />
                      <div className="h-1.5 w-1/2 rounded bg-white/50" />
                    </div>
                    <div className="p-1.5 space-y-1 bg-gray-50">
                      <div className="h-1.5 w-3/4 rounded bg-gray-300" />
                      <div className="h-1.5 w-1/2 rounded bg-gray-200" />
                    </div>
                  </div>
                ),
              },
              {
                id: "minimal",
                label: "Minimal",
                preview: (
                  <div className="h-20 rounded-lg overflow-hidden border border-gray-100 bg-white flex flex-col items-center justify-center gap-1.5 p-2">
                    <div className="h-1.5 w-12 rounded bg-gray-800" />
                    <div className="h-px w-16 bg-[#C6AF4B]" />
                    <div className="h-1 w-8 rounded bg-gray-300" />
                    <div className="h-1 w-10 rounded bg-gray-200" />
                  </div>
                ),
              },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setCoverPage(opt.id)}
                className={`rounded-xl border-2 p-2 text-left transition focus:outline-none ${
                  coverPage === opt.id
                    ? "border-[#C6AF4B] shadow-md"
                    : "border-gray-200 hover:border-[#C6AF4B]/40"
                }`}
              >
                {opt.preview}
                <p className={`text-xs font-semibold mt-2 text-center ${coverPage === opt.id ? "text-[#C6AF4B]" : "text-gray-600"}`}>
                  {opt.label}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* ─── Actions ─────────────────────────────────────────────────────── */}
        <div className="flex justify-end gap-3">
          <button onClick={() => navigate(isEdit ? `/quotation/${id}` : "/quotation")}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 hover:bg-gray-50 text-gray-700">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm disabled:opacity-60 transition"
            style={{ background: G }}>
            <Save size={15} />
            {saving ? "Saving…" : "Save Quotation"}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
