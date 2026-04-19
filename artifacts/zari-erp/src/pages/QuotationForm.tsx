import { useState, useEffect, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft, Plus, Trash2, Save, Upload, X, Image as ImageIcon,
  ChevronDown,
} from "lucide-react";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import TopNavbar from "@/components/layout/TopNavbar";
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

interface ClientOption {
  id: number;
  brand_name: string;
  contact_name: string;
  state: string | null;
}

const emptyDesign = (): Design => ({ designName: "", hsnCode: "", designImage: "", remarks: "" });
const emptyCharge = (): Charge => ({ chargeName: "", hsnCode: "", unit: "", quantity: "1", price: "0" });

export default function QuotationForm() {
  const { id } = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const isEdit = !!id && id !== "new";
  const qc = useQueryClient();
  const { data: meData } = useGetMe();
  const { mutateAsync: logout } = useLogout();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const user = meData?.data;

  // Client
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientState, setClientState] = useState("");

  // Header
  const [requirementSummary, setRequirementSummary] = useState("");
  const [estimatedWeight, setEstimatedWeight] = useState("");
  const [estimatedShippingCharges, setEstimatedShippingCharges] = useState("0");
  const [internalNotes, setInternalNotes] = useState("");
  const [clientNotes, setClientNotes] = useState("");

  // Designs
  const [designs, setDesigns] = useState<Design[]>([emptyDesign()]);

  // Charges
  const [charges, setCharges] = useState<Charge[]>([emptyCharge()]);

  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(isEdit);

  // Computed
  const subtotal = charges.reduce((s, c) => s + (parseFloat(c.quantity) || 0) * (parseFloat(c.price) || 0), 0);
  const shipping = parseFloat(estimatedShippingCharges) || 0;
  const gstAmount = parseFloat((subtotal * 0.18).toFixed(2));
  const total = subtotal + gstAmount + shipping;
  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  // Load clients
  useEffect(() => {
    customFetch(`/clients?limit=500`)
      .then((r) => r.json())
      .then((j) => setClients((j.data ?? j) as ClientOption[]))
      .catch(() => {});
  }, []);

  // Load existing quotation for edit
  useEffect(() => {
    if (!isEdit) return;
    setLoadingData(true);
    customFetch(`/quotations/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.data) return;
        const d = j.data;
        setClientId(d.client_id ? String(d.client_id) : "");
        setClientName(d.client_name || "");
        setClientState(d.client_state || "");
        setRequirementSummary(d.requirement_summary || "");
        setEstimatedWeight(d.estimated_weight || "");
        setEstimatedShippingCharges(d.estimated_shipping_charges || "0");
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

  const filteredClients = clientSearch
    ? clients.filter(
        (c) =>
          c.brand_name.toLowerCase().includes(clientSearch.toLowerCase()) ||
          c.contact_name.toLowerCase().includes(clientSearch.toLowerCase())
      )
    : clients;

  function selectClient(c: ClientOption) {
    setClientId(String(c.id));
    setClientName(c.brand_name);
    setClientState(c.state || "");
    setClientSearch("");
  }

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

  async function handleSave() {
    if (!clientName.trim()) {
      toast({ title: "Validation", description: "Client name is required", variant: "destructive" }); return;
    }
    const validDesigns = designs.filter((d) => d.designName.trim());
    const validCharges = charges.filter((c) => c.chargeName.trim());

    setSaving(true);
    try {
      const payload = {
        clientId: clientId || null,
        clientName: clientName.trim(),
        clientState: clientState.trim(),
        requirementSummary: requirementSummary.trim(),
        estimatedWeight: parseFloat(estimatedWeight) || 0,
        estimatedShippingCharges: parseFloat(estimatedShippingCharges) || 0,
        internalNotes: internalNotes.trim(),
        clientNotes: clientNotes.trim(),
        designs: validDesigns,
        charges: validCharges,
      };

      const r = await customFetch(
        isEdit ? `/quotations/${id}` : `/quotations`,
        { method: isEdit ? "PUT" : "POST", body: JSON.stringify(payload) }
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Save failed");

      toast({ title: "Saved", description: j.message || "Quotation saved successfully" });
      navigate(isEdit ? `/quotation/${id}` : `/quotation/${j.data.id}`);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout({});
      localStorage.removeItem("zarierp_token");
      qc.clear();
      navigate("/login");
    } catch { setIsLoggingOut(false); }
  }

  if (loadingData) {
    return (
      <div className="min-h-screen bg-[#F8F6F0]">
        <TopNavbar username={user?.name || ""} role={user?.role || ""} onLogout={handleLogout} isLoggingOut={isLoggingOut} />
        <div className="pt-24 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#C6AF4B]" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F6F0]">
      <TopNavbar username={user?.name || ""} role={user?.role || ""} onLogout={handleLogout} isLoggingOut={isLoggingOut} />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-24 pb-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate("/quotation")} className="p-2 rounded-xl hover:bg-gray-100 transition">
            <ArrowLeft size={18} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{isEdit ? "Edit Quotation" : "New Quotation"}</h1>
            <p className="text-sm text-gray-500">Fill in the details below</p>
          </div>
        </div>

        {/* Client Section */}
        <div className={`${card} p-5 mb-5`}>
          <h2 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wide" style={{ color: G }}>Client Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative col-span-2 sm:col-span-1">
              <label className={labelCls}>Client *</label>
              <input
                type="text"
                placeholder="Search client…"
                className={inputCls}
                value={clientSearch || clientName}
                onChange={(e) => { setClientSearch(e.target.value); setClientName(e.target.value); setClientId(""); }}
              />
              {clientSearch && filteredClients.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                  {filteredClients.slice(0, 15).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => selectClient(c)}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-[#C6AF4B]/10 flex justify-between"
                    >
                      <span className="font-medium">{c.brand_name}</span>
                      <span className="text-gray-400 text-xs">{c.state || ""}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className={labelCls}>Client State (for GST)</label>
              <input
                type="text"
                placeholder="e.g. Maharashtra"
                className={inputCls}
                value={clientState}
                onChange={(e) => setClientState(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Requirement Summary */}
        <div className={`${card} p-5 mb-5`}>
          <h2 className="text-sm font-bold mb-4 uppercase tracking-wide" style={{ color: G }}>Requirement Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="col-span-2">
              <label className={labelCls}>Requirement Summary</label>
              <textarea
                rows={3}
                className={inputCls}
                placeholder="Brief description of the embroidery requirement…"
                value={requirementSummary}
                onChange={(e) => setRequirementSummary(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Estimated Weight (kg)</label>
              <input
                type="number"
                min="0"
                step="0.001"
                className={inputCls}
                value={estimatedWeight}
                onChange={(e) => setEstimatedWeight(e.target.value)}
              />
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

        {/* Designs */}
        <div className={`${card} p-5 mb-5`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: G }}>Designs / Reference Images</h2>
            <button
              onClick={() => setDesigns((prev) => [...prev, emptyDesign()])}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#C6AF4B]/40 hover:bg-[#C6AF4B]/10 text-[#C6AF4B] transition"
            >
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
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="e.g. Floral Embroidery on Kurta"
                      value={d.designName}
                      onChange={(e) => setDesigns((p) => p.map((x, j) => j === i ? { ...x, designName: e.target.value } : x))}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>HSN Code</label>
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="e.g. 5810"
                      value={d.hsnCode}
                      onChange={(e) => setDesigns((p) => p.map((x, j) => j === i ? { ...x, hsnCode: e.target.value } : x))}
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className={labelCls}>Remarks</label>
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="Additional notes about this design"
                      value={d.remarks}
                      onChange={(e) => setDesigns((p) => p.map((x, j) => j === i ? { ...x, remarks: e.target.value } : x))}
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className={labelCls}>Reference Image</label>
                    {d.designImage ? (
                      <div className="flex items-center gap-3">
                        <img src={d.designImage} alt="design" className="h-16 w-16 object-cover rounded-lg border border-gray-200" />
                        <button
                          onClick={() => setDesigns((p) => p.map((x, j) => j === i ? { ...x, designImage: "" } : x))}
                          className="text-red-400 hover:text-red-600 text-xs"
                        >
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

        {/* Custom Charges */}
        <div className={`${card} p-5 mb-5`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: G }}>Custom Charges</h2>
            <button
              onClick={() => setCharges((prev) => [...prev, emptyCharge()])}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#C6AF4B]/40 hover:bg-[#C6AF4B]/10 text-[#C6AF4B] transition"
            >
              <Plus size={13} /> Add Charge
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-500 pb-2 pr-2">Charge Name</th>
                  <th className="text-left text-xs font-semibold text-gray-500 pb-2 pr-2 w-24">HSN</th>
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
                        <input
                          type="text"
                          className={inputCls}
                          placeholder="e.g. Embroidery Charges"
                          value={c.chargeName}
                          onChange={(e) => setCharges((p) => p.map((x, j) => j === i ? { ...x, chargeName: e.target.value } : x))}
                        />
                      </td>
                      <td className="pr-2 py-1.5">
                        <input type="text" className={inputCls} value={c.hsnCode} onChange={(e) => setCharges((p) => p.map((x, j) => j === i ? { ...x, hsnCode: e.target.value } : x))} />
                      </td>
                      <td className="pr-2 py-1.5">
                        <input type="text" className={inputCls} placeholder="pcs / m / kg" value={c.unit} onChange={(e) => setCharges((p) => p.map((x, j) => j === i ? { ...x, unit: e.target.value } : x))} />
                      </td>
                      <td className="pr-2 py-1.5">
                        <input type="number" min="0" step="0.001" className={inputCls} value={c.quantity} onChange={(e) => setCharges((p) => p.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))} />
                      </td>
                      <td className="pr-2 py-1.5">
                        <input type="number" min="0" step="0.01" className={inputCls} value={c.price} onChange={(e) => setCharges((p) => p.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} />
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
            <div className="w-56">
              <label className={labelCls}>Shipping Charges (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputCls}
                value={estimatedShippingCharges}
                onChange={(e) => setEstimatedShippingCharges(e.target.value)}
              />
            </div>
          </div>

          {/* Totals */}
          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="flex flex-col items-end gap-1 text-sm">
              <div className="flex justify-between w-56">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-semibold">{fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between w-56">
                <span className="text-gray-500">GST @ 18%</span>
                <span className="font-semibold">{fmt(gstAmount)}</span>
              </div>
              <div className="flex justify-between w-56">
                <span className="text-gray-500">Shipping</span>
                <span className="font-semibold">{fmt(shipping)}</span>
              </div>
              <div className="flex justify-between w-56 pt-1 border-t border-gray-200 mt-1">
                <span className="font-bold text-gray-900">Total</span>
                <span className="font-bold text-[#C6AF4B] text-lg">{fmt(total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={() => navigate(isEdit ? `/quotation/${id}` : "/quotation")}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 hover:bg-gray-50 text-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm disabled:opacity-60 transition"
            style={{ background: G }}
          >
            <Save size={15} />
            {saving ? "Saving…" : "Save Quotation"}
          </button>
        </div>
      </div>
    </div>
  );
}
